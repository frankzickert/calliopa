#!/usr/bin/env python3
"""Higgsfield Seedance 2.0 Mini video client.

The general service. Jobs go through the account-authenticated `higgsfield`
CLI, so there is no API key and no S3 reference publication — the CLI uploads
local files itself. Request contract, output JSON and exit codes match
scripts/open-router-seedance.

Seedance takes a first frame, a last frame and reference images at the same
time. A single accepted panel belongs in --start-image; boards and identity
plates belong in --image-reference. The storyboard sibling service refuses
frames outright.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable


SCRIPT_DIR = Path(__file__).resolve().parent
BASE_PATH = SCRIPT_DIR.parent / "open-router-seedance" / "seedance.py"
BASE_MODULE_NAME = "_calliopa_higgsfield_seedance_shared"
# The model is a PARAMETER, not a constant — author's instruction 2026-08-17, after the
# 0102 cold-open ran seedance_2_5 through the raw CLI because this was hard-coded.
# 2.0 Mini stays the default (the portrait/free-work route).
DEFAULT_MODEL = "seedance_2_0_mini"
EXECUTABLE = "higgsfield"

# Verified against `higgsfield model get seedance_2_0_mini --json` on 2026-08-16.
DURATION_RANGE = range(4, 16)
# Larger models run longer: `higgsfield generate cost seedance_2_5 --duration 30` is accepted and
# 31 is refused server-side ("Input should be less than or equal to 30"), verified 2026-08-28.
DURATION_RANGE_LARGE = range(4, 31)
MAX_IMAGES = 9          # image_references + start_image + end_image
MAX_VIDEOS = 3
MAX_AUDIOS = 3
MAX_ATTACHMENTS = 12
RESOLUTIONS = ("480p", "720p")
GENRES = ("auto", "action", "horror", "comedy", "noir", "drama", "epic")
BITRATE_MODES = ("standard", "high")

VIDEO_SUFFIXES = (".mp4", ".mov", ".webm", ".m4v", ".mkv")
COMPLETED_STATES = {"completed", "complete", "succeeded", "success", "done", "finished", "ready"}
FAILED_STATES = {
    "failed", "failure", "error", "errored", "cancelled", "canceled", "expired",
    "rejected", "moderated", "nsfw", "timeout", "timed_out",
}
MEDIA_FLAGS = {"image": "--image-references", "video": "--video-references", "audio": "--audio-references"}


def _load_base() -> Any:
    spec = importlib.util.spec_from_file_location(BASE_MODULE_NAME, BASE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load shared Seedance runtime from {BASE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[BASE_MODULE_NAME] = module
    spec.loader.exec_module(module)
    return module


base = _load_base()

# Mini renders 480p as well as 720p, at 40% of the credit cost. The pixel
# dimensions are the preset's nominal values, as in the OpenRouter service.
FORMATS = {
    "portrait-720p": {"resolution": "720p", "aspect_ratio": "9:16", "width": 720, "height": 1280},
    "landscape-720p": {"resolution": "720p", "aspect_ratio": "16:9", "width": 1280, "height": 720},
    "portrait-480p": {"resolution": "480p", "aspect_ratio": "9:16", "width": 480, "height": 854},
    "landscape-480p": {"resolution": "480p", "aspect_ratio": "16:9", "width": 854, "height": 480},
    # 1080p exists on larger models only (seedance_2_5 verified 2026-08-17); the
    # validate() gate below refuses it on the mini rather than letting the CLI fail.
    "portrait-1080p": {"resolution": "1080p", "aspect_ratio": "9:16", "width": 1080, "height": 1920},
    "landscape-1080p": {"resolution": "1080p", "aspect_ratio": "16:9", "width": 1920, "height": 1080},
}
base.FORMATS.update(FORMATS)


@dataclass(frozen=True)
class HiggsfieldRequest(base.VideoRequest):
    start_alias: str | None = None
    end_alias: str | None = None
    genre: str | None = None
    bitrate_mode: str | None = None
    model: str = DEFAULT_MODEL
    # The vendor takes an aspect ratio and a resolution, and always has: `model get` reports six
    # ratios for this model, of which the `FORMATS` presets name two. The preset stays as the
    # shorthand it is and fills whichever of these is not given. BO_0279_002
    aspect_ratio: str | None = None
    resolution: str | None = None

    @property
    def shape(self) -> tuple[str, str]:
        """The resolution and aspect ratio this request actually asks for."""
        preset = base.FORMATS[self.format]
        return (self.resolution or preset["resolution"], self.aspect_ratio or preset["aspect_ratio"])

    def frame_aliases(self) -> tuple[str, ...]:
        return tuple(alias for alias in (self.start_alias, self.end_alias) if alias)

    def reference_material(self) -> tuple[Any, ...]:
        frames = set(self.frame_aliases())
        return tuple(item for item in self.references if item.alias not in frames)

    def duration_range(self) -> range:
        return DURATION_RANGE if self.model == DEFAULT_MODEL else DURATION_RANGE_LARGE

    def validate(self) -> None:
        super().validate()
        if self.job_id:
            return
        aliases = {item.alias for item in self.references}
        for label, alias in (("start_alias", self.start_alias), ("end_alias", self.end_alias)):
            if alias and alias not in aliases:
                raise base.InvalidRequest(f"{label} @{alias} has no attached reference")
        if self.start_alias and self.start_alias == self.end_alias:
            raise base.InvalidRequest("one image cannot be both the first and the last frame")
        for item in self.references:
            if item.alias in self.frame_aliases() and item.media_type != "image":
                raise base.InvalidRequest(f"@{item.alias} is a frame and must be an image")
        counts = {kind: 0 for kind in MEDIA_FLAGS}
        for item in self.references:
            counts[item.media_type] += 1
        if counts["image"] > MAX_IMAGES:
            raise base.InvalidRequest(
                f"Seedance 2.0 Mini accepts at most {MAX_IMAGES} images, counting the first and last frame"
            )
        if counts["video"] > MAX_VIDEOS:
            raise base.InvalidRequest(f"at most {MAX_VIDEOS} video references are allowed")
        if counts["audio"] > MAX_AUDIOS:
            raise base.InvalidRequest(f"at most {MAX_AUDIOS} audio references are allowed")
        if len(self.references) > MAX_ATTACHMENTS:
            raise base.InvalidRequest(f"at most {MAX_ATTACHMENTS} attachments are allowed in total")
        if counts["audio"] and not (counts["image"] or counts["video"]):
            raise base.InvalidRequest("an audio reference needs at least one image or video attached")
        if any(base._is_url(item.source) for item in self.references):
            raise base.InvalidRequest(
                "the Higgsfield CLI uploads local files itself; pass reference paths, not URLs"
            )
        if self.seed is not None and self.model == DEFAULT_MODEL:
            raise base.InvalidRequest("seedance_2_0_mini declares no seed parameter; remove --seed")
        if self.shape[0] == "1080p" and self.model == DEFAULT_MODEL:
            raise base.InvalidRequest(
                "seedance_2_0_mini renders 480p and 720p; 1080p needs --model seedance_2_5"
            )
        if self.genre is not None and self.genre not in GENRES:
            raise base.InvalidRequest(f"unknown genre {self.genre!r}; choose one of {sorted(GENRES)}")
        if self.bitrate_mode is not None and self.bitrate_mode not in BITRATE_MODES:
            raise base.InvalidRequest(
                f"unknown bitrate_mode {self.bitrate_mode!r}; choose one of {sorted(BITRATE_MODES)}"
            )


def attachment_legend(request: HiggsfieldRequest) -> str:
    """Name every attachment by its alias, its role and its file.

    The OpenRouter service rewrites @alias into Seedance's native @Image N
    slots. That syntax is not verified on this carrier, so the author's aliases
    are left in the prompt untouched and the legend explains them instead.
    """
    lines = []
    counters = {kind: 0 for kind in MEDIA_FLAGS}
    for item in request.references:
        name = Path(item.source).name
        if item.alias == request.start_alias:
            role = "the FIRST FRAME of the film, attached as the start frame"
        elif item.alias == request.end_alias:
            role = "the LAST FRAME of the film, attached as the end frame"
        else:
            counters[item.media_type] += 1
            role = f"{item.media_type} reference {counters[item.media_type]}, attached as reference material only"
        lines.append(f"- @{item.alias} = {role} ({name})")
    return "The attached files, in the order they are attached:\n" + "\n".join(lines)


def expanded_prompt(request: HiggsfieldRequest) -> str:
    if not request.references:
        return request.prompt.strip()
    return attachment_legend(request) + "\n\n" + request.prompt.strip()


def build_payload(
    request: HiggsfieldRequest,
    publisher: Any = None,
    published: list[Any] | None = None,
) -> dict[str, Any]:
    resolution, aspect_ratio = request.shape
    preset = base.FORMATS[request.format]
    frames = set(request.frame_aliases())
    payload: dict[str, Any] = {
        "model": getattr(request, "model", DEFAULT_MODEL),
        "prompt": expanded_prompt(request),
        "duration": request.duration,
        "resolution": resolution,
        "aspect_ratio": aspect_ratio,
        "generate_audio": request.generate_audio,
        "image_references": [],
        "video_references": [],
        "audio_references": [],
    }
    for item in request.references:
        if item.alias in frames:
            continue
        payload[f"{item.media_type}_references"].append(item.source)
    for alias, key in ((request.start_alias, "start_image"), (request.end_alias, "end_image")):
        if not alias:
            continue
        payload[key] = next(item.source for item in request.references if item.alias == alias)
    if request.genre:
        payload["genre"] = request.genre
    if request.bitrate_mode:
        payload["bitrate_mode"] = request.bitrate_mode
    # Larger Seedance models gate references behind an explicit mode; the mini has no
    # mode parameter. Verified against `higgsfield model get seedance_2_5` 2026-08-17:
    # t2v rejects reference media, so any attachment implies omni_reference.
    if payload["model"] != DEFAULT_MODEL:
        has_refs = any(payload[f"{kind}_references"] for kind in MEDIA_FLAGS) \
            or "start_image" in payload or "end_image" in payload
        if has_refs:
            payload["mode"] = "omni_reference"
    if not any(payload[f"{kind}_references"] for kind in MEDIA_FLAGS) \
            and "start_image" not in payload and "end_image" not in payload:
        raise base.InvalidRequest("at least one attachment is required")
    return payload


base.build_payload = build_payload


def build_argv(payload: dict[str, Any], executable: str = EXECUTABLE) -> list[str]:
    """Translate a payload into the exact `higgsfield generate create` argv."""
    argv = [executable, "generate", "create", str(payload["model"]), "--json"]
    argv += ["--prompt", str(payload["prompt"])]
    argv += ["--duration", str(payload["duration"])]
    argv += ["--resolution", str(payload["resolution"])]
    argv += ["--aspect_ratio", str(payload["aspect_ratio"])]
    argv += ["--generate_audio", "true" if payload["generate_audio"] else "false"]
    if payload.get("mode"):
        argv += ["--mode", str(payload["mode"])]
    if payload.get("genre"):
        argv += ["--genre", str(payload["genre"])]
    if payload.get("bitrate_mode"):
        argv += ["--bitrate_mode", str(payload["bitrate_mode"])]
    if payload.get("start_image"):
        argv += ["--start-image", str(payload["start_image"])]
    if payload.get("end_image"):
        argv += ["--end-image", str(payload["end_image"])]
    for kind, flag in MEDIA_FLAGS.items():
        for source in payload.get(f"{kind}_references", []):
            argv += [flag, str(source)]
    return argv


def _walk_strings(value: Any, path: tuple[str, ...] = ()) -> list[tuple[tuple[str, ...], str]]:
    if isinstance(value, str):
        return [(path, value)]
    if isinstance(value, dict):
        found = []
        for key, item in value.items():
            found.extend(_walk_strings(item, path + (str(key),)))
        return found
    if isinstance(value, (list, tuple)):
        found = []
        for index, item in enumerate(value):
            found.extend(_walk_strings(item, path + (str(index),)))
        return found
    return []


def job_id_of(response: Any) -> str | None:
    """Pull a job id out of `generate create --json`, whatever it wraps it in."""
    if isinstance(response, str):
        return response.strip() or None
    if isinstance(response, list):
        for item in response:
            found = job_id_of(item)
            if found:
                return found
        return None
    if not isinstance(response, dict):
        return None
    for key in ("id", "job_id", "jobId", "job_set_id", "request_id"):
        value = response.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    for key in ("job", "jobs", "data", "result", "results"):
        if key in response:
            found = job_id_of(response[key])
            if found:
                return found
    return None


def status_of(job: Any) -> tuple[str, str]:
    """Return (normalized_status, reported_status)."""
    reported = ""
    if isinstance(job, dict):
        for key in ("status", "state", "job_status"):
            value = job.get(key)
            if isinstance(value, str) and value.strip():
                reported = value.strip()
                break
    lowered = reported.lower()
    if lowered in COMPLETED_STATES:
        return "completed", reported
    if lowered in FAILED_STATES:
        return "failed", reported
    return "in_progress", reported


def video_url_of(job: Any) -> str | None:
    """Find the rendered clip in a completed job, whatever the field is named."""
    candidates = []
    for path, value in _walk_strings(job):
        if not value.startswith(("http://", "https://")):
            continue
        if Path(urllib.parse.urlparse(value).path).suffix.lower() not in VIDEO_SUFFIXES:
            continue
        key = path[-1].lower() if path else ""
        score = 0
        if any(hint in key for hint in ("raw", "video", "result", "output")):
            score -= 2
        if any(hint in key for hint in ("preview", "thumb", "watermark", "min")):
            score += 2
        candidates.append((score, len(path), value))
    if not candidates:
        return None
    candidates.sort()
    return candidates[0][2]


class HiggsfieldTransport:
    """Drive the account-authenticated `higgsfield` CLI as a job transport."""

    def __init__(
        self,
        executable: str = EXECUTABLE,
        *,
        runner: Callable[[list[str], float], tuple[int, str, str]] | None = None,
        fetcher: Callable[[str, float], bytes] | None = None,
        environment: dict[str, str] | None = None,
    ) -> None:
        self.executable = executable
        self.runner = runner or self._run
        self.fetcher = fetcher or self._fetch
        self.environment = environment
        self.result_urls: dict[str, str] = {}

    def _run(self, argv: list[str], timeout: float) -> tuple[int, str, str]:
        if shutil.which(argv[0]) is None:
            raise base.TransportError(
                f"the {argv[0]!r} CLI is not on PATH; install it with `npm i -g @higgsfield/cli`",
                code="cli_missing", status=127,
            )
        try:
            completed = subprocess.run(
                argv, capture_output=True, text=True, timeout=timeout, check=False,
                env=self.environment,
            )
        except subprocess.TimeoutExpired as exc:
            raise base.TransportError(
                f"the higgsfield CLI did not answer within {timeout:g}s", code="cli_timeout"
            ) from exc
        except OSError as exc:
            raise base.TransportError(f"could not run the higgsfield CLI: {exc}",
                                      code="cli_missing", status=127) from exc
        return completed.returncode, completed.stdout, completed.stderr

    def _fetch(self, url: str, timeout: float) -> bytes:
        request = urllib.request.Request(url, headers={"User-Agent": "calliopa-higgsfield-seedance/1.0"})
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            raise base.TransportError(f"downloading the clip returned HTTP {exc.code}",
                                      status=exc.code, code="download_failed") from exc
        except (urllib.error.URLError, TimeoutError, socket.timeout) as exc:
            raise base.TransportError(f"downloading the clip failed: {getattr(exc, 'reason', exc)}",
                                      code="connection_error") from exc

    def _invoke(self, argv: list[str], timeout: float, stage: str) -> Any:
        returncode, stdout, stderr = self.runner(argv, timeout)
        if returncode != 0:
            raise self._error(returncode, stdout, stderr, stage)
        text = stdout.strip()
        if not text:
            if stderr.strip():
                raise self._error(returncode, stdout, stderr, stage)
            raise base.TransportError(f"the higgsfield CLI printed nothing during {stage}", code="api_error")
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise base.TransportError(
                f"the higgsfield CLI returned invalid JSON during {stage}: {text[:400]}", code="api_error"
            ) from exc

    @staticmethod
    def _error(returncode: int, stdout: str, stderr: str, stage: str) -> base.TransportError:
        detail = (stderr or stdout).strip()[:1200] or f"the higgsfield CLI exited {returncode} during {stage}"
        message = re.sub(r"^Error:\s*", "", detail).strip()
        code = "api_error"
        error_type = ""
        embedded = re.search(r'\{.*"error_type"\s*:\s*"([^"]+)".*\}', message)
        if embedded:
            error_type = embedded.group(1)
            message = error_type
        lowered = (error_type or message).lower()
        if "basic_plan_required" in lowered or "plan_required" in lowered:
            code = "plan_required"
            message = (
                "the Higgsfield free plan cannot submit jobs through the CLI; "
                "upgrade the account to Basic or above"
            )
        elif "session expired" in lowered or "not authenticated" in lowered or "auth login" in lowered:
            code = "unauthenticated"
        elif "no workspace selected" in lowered:
            code = "no_workspace"
        elif "credit" in lowered or "insufficient" in lowered:
            code = "insufficient_credits"
        elif "job not found" in lowered:
            code = "job_not_found"
        elif lowered.startswith(("missing required params", "invalid values", "unknown params")) \
                or "no model with job_type" in lowered:
            code = "invalid_request"
        elif "no response received" in lowered or "connection" in lowered or "timeout" in lowered:
            code = "connection_error"
        elif "moderat" in lowered or "nsfw" in lowered or "policy" in lowered:
            code = "moderation_blocked"
        status = None if code in {"connection_error", "cli_timeout"} else returncode
        return base.TransportError(message, status=status, code=code)

    def submit(self, payload: dict[str, Any], timeout: float) -> dict[str, Any]:
        response = self._invoke(build_argv(payload, self.executable), timeout, "submission")
        job_id = job_id_of(response)
        if not job_id:
            raise base.TransportError(
                "the higgsfield CLI accepted the job but no job id was found in its response: "
                + json.dumps(response)[:600],
                code="api_error",
            )
        normalized, reported = status_of(response if isinstance(response, dict) else {})
        return {"id": job_id, "status": normalized if reported else "queued"}

    def poll(self, job_id: str, timeout: float) -> dict[str, Any]:
        response = self._invoke([self.executable, "generate", "get", job_id, "--json"], timeout, "poll")
        job = response[0] if isinstance(response, list) and response else response
        normalized, reported = status_of(job)
        summary: dict[str, Any] = {"id": job_id, "status": normalized}
        if reported and reported.lower() != normalized:
            summary["reported_status"] = reported
        if normalized == "completed":
            url = video_url_of(job)
            if not url:
                raise base.TransportError(
                    "the job finished but no video URL was found in its response: " + json.dumps(job)[:800],
                    code="api_error", status=200,
                )
            self.result_urls[job_id] = url
            summary["video_url"] = url
        if normalized == "failed":
            summary["error"] = reported or "the job reached a terminal failure state"
        return summary

    def download(self, job_id: str, timeout: float) -> bytes:
        url = self.result_urls.get(job_id)
        if not url:
            raise base.TransportError(
                f"no rendered clip URL is known for job {job_id}; poll it first", code="api_error"
            )
        content = self.fetcher(url, timeout)
        if not content:
            raise base.TransportError("the rendered clip downloaded as zero bytes", code="api_error")
        return content


def classify(error: base.TransportError) -> tuple[bool, str, str]:
    """Decide retryability from the CLI's own vocabulary, not HTTP status."""
    code = str(error.code or "api_error").lower()
    if code in {"cli_timeout", "connection_error"}:
        return True, code, "a transient connection or CLI failure occurred"
    if code == "plan_required":
        return False, code, "the Higgsfield account plan must change before any job can be submitted"
    if code == "unauthenticated":
        return False, code, "run `higgsfield auth login` before trying again"
    if code == "no_workspace":
        return False, code, "run `higgsfield workspace set <workspace_id>` before trying again"
    if code == "insufficient_credits":
        return False, code, "add Higgsfield credits before trying again"
    if code == "cli_missing":
        return False, code, "install the higgsfield CLI before trying again"
    if code == "moderation_blocked":
        return False, code, "the prompt or reference material must change"
    if code == "invalid_request":
        return False, code, "the request must change before it can succeed"
    if code == "job_not_found":
        return False, code, "that job id does not exist"
    if code == "download_failed" and error.status is not None and error.status >= 500:
        return True, "upstream_error", f"HTTP {error.status} may be transient"
    return False, code, "the failure is not classified as transient"


base.classify = classify


class HiggsfieldGenerator(base.SeedanceGenerator):
    def _summary(self, request: HiggsfieldRequest) -> dict[str, Any]:
        summary = super()._summary(request)
        summary.update({
            "model": getattr(request, "model", DEFAULT_MODEL),
            "service": "higgsfield-cli",
            "generation_mode": "image-to-video" if request.frame_aliases() else "reference-to-video",
            "expanded_prompt": expanded_prompt(request),
        })
        if request.start_alias:
            summary["start_frame"] = f"@{request.start_alias}"
        if request.end_alias:
            summary["end_frame"] = f"@{request.end_alias}"
        summary["reference_aliases"] = [f"@{item.alias}" for item in request.reference_material()]
        if request.genre:
            summary["genre"] = request.genre
        if request.bitrate_mode:
            summary["bitrate_mode"] = request.bitrate_mode
        return summary


START_ROLES = frozenset({"start", "start_image", "first_frame"})
END_ROLES = frozenset({"end", "end_image", "last_frame"})
REFERENCE_ROLES = frozenset({"reference", "image", "material"})


def request_from_dict(data: dict[str, Any], known_roles: frozenset[str] = frozenset()) -> HiggsfieldRequest:
    """Build a request from JSON. `known_roles` are extra roles a specialised
    service understands and will validate itself."""
    request = base.request_from_dict(data)
    start = data.get("start_alias") or data.get("start_image")
    end = data.get("end_alias") or data.get("end_image")
    for item in data.get("references", []):
        if not isinstance(item, dict) or "alias" not in item:
            continue
        role = str(item.get("role", "")).lower()
        if role in START_ROLES:
            start = item["alias"]
        elif role in END_ROLES:
            end = item["alias"]
        elif role and role not in REFERENCE_ROLES | known_roles:
            raise base.InvalidRequest(f"unknown reference role {role!r}")
    genre = data.get("genre")
    bitrate_mode = data.get("bitrate_mode")
    return HiggsfieldRequest(
        **request.__dict__,
        start_alias=str(start).removeprefix("@") if start else None,
        end_alias=str(end).removeprefix("@") if end else None,
        genre=str(genre) if genre else None,
        bitrate_mode=str(bitrate_mode) if bitrate_mode else None,
        model=str(data.get("model", DEFAULT_MODEL)),
    )


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Generate Seedance 2.0 Mini clips through the Higgsfield account CLI; emits one JSON object."
        )
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--prompt")
    source.add_argument("--prompt-file", type=Path)
    source.add_argument("--request-json", metavar="PATH|-", help="load request JSON; use - for stdin")
    source.add_argument("--job-id", help="resume polling/downloading an existing paid job")
    parser.add_argument("--prompt-section", help="use the first fenced prompt under this Markdown section")
    parser.add_argument("--start-image", metavar="@ALIAS=PATH", help="the film's first frame")
    parser.add_argument("--end-image", metavar="@ALIAS=PATH", help="the film's last frame")
    parser.add_argument("--image-reference", action="append", default=[], metavar="@ALIAS=PATH",
                        help="identity/style/composition material, never a frame")
    parser.add_argument("--video-reference", action="append", default=[], metavar="@ALIAS=PATH")
    parser.add_argument("--audio-reference", action="append", default=[], metavar="@ALIAS=PATH")
    parser.add_argument("--duration", type=int, help=f"seconds, {DURATION_RANGE.start}-{DURATION_RANGE.stop - 1} on the mini, up to {DURATION_RANGE_LARGE.stop - 1} on seedance_2_5")
    parser.add_argument("--output", type=Path, default=Path("generated.mp4"))
    parser.add_argument("--format", choices=sorted(FORMATS), default="portrait-720p",
                        help="shorthand for an aspect ratio and a resolution together")
    parser.add_argument("--aspect-ratio", help="overrides the format's aspect ratio")
    parser.add_argument("--resolution", help="overrides the format's resolution")
    parser.add_argument("--model", default=DEFAULT_MODEL,
                        help="Higgsfield job type (seedance_2_0_mini, seedance_2_5, ...); "
                             "2.0 Mini is the default — the portrait/free-work route")
    parser.add_argument("--no-audio", action="store_true")
    parser.add_argument("--genre", choices=sorted(GENRES), default=None)
    parser.add_argument("--bitrate-mode", choices=sorted(BITRATE_MODES), default=None)
    parser.add_argument("--max-retries-per-10-seconds", type=int, default=2)
    parser.add_argument("--max-auto-wait-seconds", type=float, default=10.0)
    parser.add_argument("--timeout-seconds", type=float, default=180.0)
    parser.add_argument("--poll-interval-seconds", type=float, default=10.0)
    parser.add_argument("--max-poll-seconds", type=float, default=900.0)
    parser.add_argument("--higgsfield-bin", default=os.environ.get("HIGGSFIELD_BIN", EXECUTABLE))
    parser.add_argument("--dry-run", action="store_true",
                        help="print the exact CLI invocation and spend nothing")
    return parser


def _cli_request(args: argparse.Namespace) -> HiggsfieldRequest:
    if args.request_json:
        raw = sys.stdin.read() if args.request_json == "-" else Path(args.request_json).read_text(encoding="utf-8")
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise base.InvalidRequest("request JSON must be an object")
        return request_from_dict(data)

    if args.prompt_section and not args.prompt_file:
        raise base.InvalidRequest("--prompt-section requires --prompt-file")
    prompt = args.prompt or (
        base.read_prompt_file(args.prompt_file, args.prompt_section) if args.prompt_file else ""
    )
    if not args.job_id and args.duration is None:
        raise base.InvalidRequest("--duration is required for a new clip")
    references: list[Any] = []
    start_alias = end_alias = None
    if args.start_image:
        frame = base.Reference.parse(args.start_image, "image")
        start_alias = frame.alias
        references.append(frame)
    if args.end_image:
        frame = base.Reference.parse(args.end_image, "image")
        end_alias = frame.alias
        references.append(frame)
    for kind in MEDIA_FLAGS:
        references.extend(base.Reference.parse(value, kind) for value in getattr(args, f"{kind}_reference"))
    original = base.VideoRequest(
        prompt, args.duration or 4, args.output, tuple(references), args.format,
        not args.no_audio, None, args.max_retries_per_10_seconds, args.max_auto_wait_seconds,
        args.timeout_seconds, args.poll_interval_seconds, args.max_poll_seconds, args.job_id,
    )
    return HiggsfieldRequest(
        **original.__dict__, start_alias=start_alias, end_alias=end_alias,
        genre=args.genre, bitrate_mode=args.bitrate_mode, model=args.model,
        aspect_ratio=args.aspect_ratio, resolution=args.resolution,
    )


def dry_run(request: HiggsfieldRequest, executable: str, generator: Any = None) -> dict[str, Any]:
    request.validate()
    generator = generator or HiggsfieldGenerator(None)
    if request.job_id:
        argv = [executable, "generate", "get", request.job_id, "--json"]
    else:
        argv = build_argv(base.build_payload(request), executable)
    return {
        "ok": True,
        "attempts": 0,
        "retry": {"allowed": False, "after_seconds": None, "reason": "dry run spent nothing"},
        "job": {"id": request.job_id, "status": "not submitted"} if request.job_id else None,
        "request": {**generator._summary(request), "argv": argv},
    }


def run(args: argparse.Namespace, request: HiggsfieldRequest, generator_class: Any) -> tuple[dict[str, Any], int]:
    if args.dry_run:
        payload = dry_run(request, args.higgsfield_bin, generator_class(None))
        return {k: v for k, v in payload.items() if v is not None}, 0
    result = generator_class(HiggsfieldTransport(args.higgsfield_bin)).generate(request)
    if result.ok:
        return result.to_dict(), 0
    if result.retry.allowed:
        return result.to_dict(), base.EXIT_TEMPORARY
    if result.error and result.error.kind == "invalid_request":
        return result.to_dict(), base.EXIT_INVALID
    return result.to_dict(), base.EXIT_PERMANENT


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        payload, code = run(args, _cli_request(args), HiggsfieldGenerator)
    except (base.InvalidRequest, OSError, json.JSONDecodeError, ValueError) as exc:
        payload, code = HiggsfieldGenerator._invalid(str(exc)).to_dict(), base.EXIT_INVALID
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
