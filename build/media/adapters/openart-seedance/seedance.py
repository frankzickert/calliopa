#!/usr/bin/env python3
"""OpenArt Seedance 2.0 Mini video client.

Same request contract, flags, output JSON and exit codes as
scripts/higgsfield-seedance: the request class, the attachment legend and the
flag parsing are that script's own. The carrier is OpenArt, over the connection
scripts/openart-seedream built: the `openart` CLI owns the login, the model
form, the uploads and the job lookups, and the one paid generate request goes
out directly, because the CLI's `generate video` carries a start frame and no
references.

OpenArt splits Seedance's inputs into two modes with closed forms: a start
frame (and optional end frame) is `image2video`, reference material is
`element2video`, and neither form accepts the other's keys. A start frame and
references together are refused locally.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import socket
import sys
import urllib.error
import urllib.parse
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable


SCRIPT_DIR = Path(__file__).resolve().parent
GENERAL_PATH = SCRIPT_DIR.parent / "higgsfield-seedance" / "seedance.py"
GENERAL_MODULE_NAME = "_calliopa_openart_seedance_general"
CONNECTION_PATH = SCRIPT_DIR.parent / "openart-seedream" / "seedream.py"
CONNECTION_MODULE_NAME = "_calliopa_openart_seedance_connection"


def _load(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


general = _load(GENERAL_MODULE_NAME, GENERAL_PATH)
base = general.base
openart = _load(CONNECTION_MODULE_NAME, CONNECTION_PATH)

MODEL = "byte-plus-seedance-2-mini"
# A request JSON written for scripts/higgsfield-seedance runs here unchanged.
MODEL_NAMES = {MODEL, general.DEFAULT_MODEL}

# Verified against `openart model form byte-plus-seedance-2-mini <mode>` on 2026-09-11:
# duration 4-15, resolution 480p/720p, aspectRatio includes 9:16 and 16:9, seed allowed,
# no genre or bitrate_mode. Every request is checked against the live form anyway.
DURATION_RANGE = range(4, 16)
FORMATS = {name: general.FORMATS[name] for name in
           ("portrait-720p", "landscape-720p", "portrait-480p", "landscape-480p")}
UPLOAD_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif",
                   ".mp4", ".mov", ".qt", ".mp3", ".wav", ".m4a", ".flac", ".aac"}
COMPLETED_STATES = {"completed", "complete", "succeeded", "success", "done", "finished"}
FAILED_STATES = set(openart.FAILED_STATUSES) | {"expired", "moderated", "nsfw"}
CONNECTION_HINTS = ("connection", "dial tcp", "timeout", "timed out", "deadline", "eof", "reset by peer")


@dataclass(frozen=True)
class OpenArtRequest(general.HiggsfieldRequest):
    model: str = MODEL

    @property
    def mode(self) -> str:
        return "image2video" if self.frame_aliases() else "element2video"

    def duration_range(self) -> range:
        return DURATION_RANGE

    def validate(self) -> None:
        if not self.job_id and any(base._is_url(item.source) for item in self.references):
            raise base.InvalidRequest("pass local files; the openart CLI uploads them")
        super().validate()
        if self.job_id:
            return
        if self.model != MODEL:
            raise base.InvalidRequest(f"this service runs {MODEL} only, not {self.model!r}")
        if self.format not in FORMATS:
            raise base.InvalidRequest(f"unknown format {self.format!r}; choose one of {sorted(FORMATS)}")
        if self.genre or self.bitrate_mode:
            raise base.InvalidRequest("OpenArt's Seedance 2.0 Mini form has no genre or bitrate_mode")
        for item in self.references:
            if Path(item.source).suffix.lower() not in UPLOAD_SUFFIXES:
                raise base.InvalidRequest(f"@{item.alias}: OpenArt uploads only {sorted(UPLOAD_SUFFIXES)}")
        if self.end_alias and not self.start_alias:
            raise base.InvalidRequest("OpenArt's image2video needs a start frame; an end frame alone cannot be sent")
        if self.frame_aliases() and self.reference_material():
            raise base.InvalidRequest(
                "OpenArt runs frames (image2video) and references (element2video) as separate modes, "
                "and neither form accepts the other; drop the references, attach the panel with "
                "--image-reference and name it the opening frame in the prompt, or use "
                "scripts/higgsfield-seedance for a start frame with references"
            )


# --- The request body -------------------------------------------------------------


def element(reference: Any, asset_id: str, url: str) -> dict[str, str]:
    return {"type": reference.media_type, "id": asset_id, "url": url, "label": reference.alias}


def openart_body(request: OpenArtRequest, elements: dict[str, dict[str, str]]) -> dict[str, Any]:
    # `shape` is the effective pair: what was asked for, or the format's. BO_0279_002
    resolution, aspect_ratio = request.shape
    params: dict[str, Any] = {
        "prompt": general.expanded_prompt(request),
        "videoCount": 1,
        "duration": request.duration,
        "aspectRatio": aspect_ratio,
        "resolution": resolution,
        "generateAudio": request.generate_audio,
    }
    if request.seed is not None:
        params["seed"] = int(request.seed)
    if request.mode == "image2video":
        params["startFrame"] = elements[request.start_alias]
        if request.end_alias:
            params["endFrame"] = elements[request.end_alias]
    else:
        # Left unset, OpenArt may rewrite the prompt before the model sees it.
        params["autoEnhancePrompt"] = False
        params["visualReferences"] = [elements[item.alias] for item in request.references]
    return {"model": MODEL, "media": "video", "mode": request.mode, "params": params}


def placeholder_body(request: OpenArtRequest) -> dict[str, Any]:
    return openart_body(request, {
        item.alias: element(item, "(upload id)", f"(uploaded from {item.source})")
        for item in request.references
    })


def check_against_form(params: dict[str, Any], form: Any, mode: str) -> None:
    """Refuse locally anything the model form would refuse, before a credit is spent."""
    schema = openart.find_key(form, ("jsonSchema",)) if isinstance(form, dict) else None
    properties = openart.form_properties(form)
    if not properties or not isinstance(schema, dict):
        raise base.InvalidRequest(f"the {MODEL} {mode} form came back without properties: {json.dumps(form)[:400]}")
    for key, value in params.items():
        if key not in properties:
            raise base.InvalidRequest(f"{key} is not in the {MODEL} {mode} form; it accepts {sorted(properties)}")
        spec = properties[key] if isinstance(properties[key], dict) else {}
        allowed = openart.allowed_values(spec)
        if allowed is not None and value not in allowed:
            raise base.InvalidRequest(f"{key}={value!r} is not accepted; the form allows {allowed}")
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            low, high = spec.get("minimum"), spec.get("maximum")
            if (low is not None and value < low) or (high is not None and value > high):
                raise base.InvalidRequest(f"{key}={value} is outside the form's range {low}-{high}")
        if isinstance(value, str) and isinstance(spec.get("maxLength"), int) and len(value) > spec["maxLength"]:
            raise base.InvalidRequest(
                f"{key} is {len(value)} characters with its attachment legend; the form accepts {spec['maxLength']}"
            )
        if isinstance(value, list) and isinstance(spec.get("maxItems"), int) and len(value) > spec["maxItems"]:
            raise base.InvalidRequest(f"{len(value)} {key}; the form accepts {spec['maxItems']}")
    missing = [key for key in schema.get("required", []) if key not in params]
    if missing:
        raise base.InvalidRequest(f"the {MODEL} {mode} form requires {missing}")


@dataclass(frozen=True)
class UploadedAsset:
    url: str
    storage_uri: str
    source: str
    asset_id: str


def build_payload(request: OpenArtRequest, publisher: Any = None, published: list[Any] | None = None) -> dict[str, Any]:
    published = published if published is not None else []
    if publisher is None:
        raise base.InvalidRequest("references need the openart uploader")
    elements = {}
    for item in request.references:
        asset = publisher.publish(item)
        published.append(asset)
        elements[item.alias] = element(item, asset.asset_id, asset.url)
    return openart_body(request, elements)


base.build_payload = build_payload


def _save_video(content: bytes, output: Path) -> dict[str, Any]:
    saved = _shared_save_video(content, output)
    os.chmod(saved["path"], 0o644)
    return saved


_shared_save_video = base._save_video
base._save_video = _save_video


# --- The OpenArt connection ---------------------------------------------------------


def translated(exc: Exception, default_code: str = "cli_error") -> base.TransportError:
    """Carry an openart-seedream failure into the shared runtime's error type."""
    if isinstance(exc, openart.NotLoggedIn):
        return base.TransportError(str(exc), status=401, code="not_logged_in")
    if isinstance(exc, openart.InvalidRequest):
        return base.TransportError(str(exc), status=127, code="cli_missing")
    if isinstance(exc, openart.TransportError):
        return base.TransportError(str(exc), status=exc.status, code=exc.code, request_id=exc.request_id,
                                   retry_after_seconds=exc.retry_after_seconds)
    message = str(exc)
    lowered = message.lower()
    if getattr(exc, "timed_out", False):
        return base.TransportError(message, code="cli_timeout")
    if "not found" in lowered:
        return base.TransportError(message, status=404, code="job_not_found")
    if any(hint in lowered for hint in CONNECTION_HINTS):
        return base.TransportError(message, code="connection_error")
    return base.TransportError(message, status=1, code=default_code)


def _call(function: Callable[..., Any], *args: Any, default_code: str = "cli_error", **kwargs: Any) -> Any:
    try:
        return function(*args, **kwargs)
    except (openart.CLIError, openart.InvalidRequest, openart.TransportError) as exc:
        raise translated(exc, default_code) from exc


def video_url_of(finished: Any) -> str | None:
    urls = openart.result_urls(finished)
    videos = [url for url in urls
              if Path(urllib.parse.urlparse(url).path).suffix.lower() in general.VIDEO_SUFFIXES]
    return (videos or urls or [None])[0]


def quote_of(cost: Any) -> dict[str, Any] | None:
    items = openart.find_key(cost, ("items",))
    if isinstance(items, list) and items and isinstance(items[0], dict):
        return {"total_credits": items[0].get("totalCredits"), "config": items[0].get("config")}
    return None


class OpenArtUploader:
    """Uploads references through the openart CLI. Uploads stay in the OpenArt
    library afterwards, as scripts/openart-seedream leaves them."""

    def __init__(self, cli: Any) -> None:
        self.cli = cli

    def publish(self, reference: Any) -> UploadedAsset:
        uploaded = _call(self.cli.upload, reference.source, default_code="upload_failed")
        return UploadedAsset(uploaded["url"], f"openart-upload:{uploaded['id']}", reference.source, uploaded["id"])

    def delete(self, asset: UploadedAsset) -> None:
        return None


class OpenArtTransport:
    def __init__(self, cli: Any, api_factory: Callable[[], Any] | None = None,
                 fetcher: Callable[[str, float], bytes] | None = None) -> None:
        self.cli = cli
        # Built after `openart account`, which refreshes the stored token.
        self.api_factory = api_factory or (lambda: openart.OpenArtAPI(openart.access_token(), cli.version()))
        self.fetcher = fetcher or openart.download
        self.api: Any = None
        self.credits_before: Any = None
        self.result_urls: dict[str, str] = {}

    def preflight(self, request: OpenArtRequest) -> None:
        self.credits_before = openart.credit_balance(_call(self.cli.account))
        form = _call(self.cli.form, MODEL, request.mode)
        check_against_form(placeholder_body(request)["params"], form, request.mode)
        self.api = _call(self.api_factory)

    def submit(self, payload: dict[str, Any], timeout: float) -> dict[str, Any]:
        api = self.api or _call(self.api_factory)
        response = _call(api.generate, payload, timeout)
        history_id = openart.find_key(response, ("historyId", "id"))
        if not history_id:
            raise base.TransportError(
                "OpenArt accepted the request but returned no history id: " + json.dumps(response)[:500],
                code="unreadable_response",
            )
        return {"id": str(history_id), "status": "queued"}

    def poll(self, job_id: str, timeout: float) -> dict[str, Any]:
        finished = _call(self.cli.run_json, "creation", "get", job_id, timeout=timeout)
        history = finished.get("history") if isinstance(finished, dict) else None
        reported = str((history or {}).get("status") or openart.find_key(finished, ("status",)) or "")
        lowered = reported.lower()
        summary: dict[str, Any] = {"id": job_id, "status": "in_progress"}
        if reported and lowered not in COMPLETED_STATES | FAILED_STATES:
            summary["reported_status"] = reported
        if lowered in COMPLETED_STATES:
            url = video_url_of(finished)
            if not url:
                raise base.TransportError(
                    f"generation {job_id} finished with no video URL: {json.dumps(finished)[:600]}",
                    code="no_result",
                )
            self.result_urls[job_id] = url
            summary.update(status="completed", video_url=url, usage=self._usage())
        elif lowered in FAILED_STATES:
            reason = openart.find_key(finished, ("errorReason", "failed_reason", "errorMessage", "message"))
            summary.update(status="failed", error=str(reason or f"status {reported}"), usage=self._usage())
        return summary

    def download(self, job_id: str, timeout: float) -> bytes:
        url = self.result_urls.get(job_id)
        if not url:
            raise base.TransportError(f"no rendered clip URL is known for generation {job_id}; poll it first",
                                      code="no_result")
        try:
            content = self.fetcher(url, timeout)
        except urllib.error.HTTPError as exc:
            raise base.TransportError(f"downloading the clip returned HTTP {exc.code}",
                                      status=exc.code, code="download_failed") from exc
        except (urllib.error.URLError, TimeoutError, socket.timeout) as exc:
            raise base.TransportError(f"downloading the clip failed: {getattr(exc, 'reason', exc)}",
                                      code="connection_error") from exc
        if not content:
            raise base.TransportError("the rendered clip downloaded as zero bytes", code="no_result")
        return content

    def _usage(self) -> dict[str, Any]:
        try:
            after = openart.credit_balance(self.cli.account())
        except (openart.CLIError, openart.InvalidRequest):
            after = None
        return {"credits_before": self.credits_before, "credits_after": after,
                "credits_spent": openart._spent(self.credits_before, after)}


def classify(error: base.TransportError) -> tuple[bool, str, str]:
    code = str(error.code or "").lower()
    status = error.status
    if code in {"cli_timeout", "connection_error"}:
        return True, code, "a transient connection or CLI failure occurred"
    if code == "not_logged_in" or status in {401, 403}:
        return False, code or "auth_failed", "run `openart login` (in Claude Code: `! openart login`)"
    if status == 402 or "credit" in code:
        return False, "insufficient_credits", "top up OpenArt credits before trying again"
    if code == "cli_missing":
        return False, code, "install the openart CLI (see scripts/openart-seedream/README.md) or pass --openart-bin"
    if code == "upload_failed":
        return False, code, "nothing was submitted or charged; fix the upload and run again"
    if code == "job_not_found":
        return False, code, "that history id does not exist"
    if code == "no_result":
        return True, code, "the generation is paid for; collect it with --job-id once `openart creation get` shows a URL"
    if code == "unreadable_response":
        return False, code, "check `openart creation list --limit 3` before sending again"
    if status is None:
        return True, "connection_error", "a transient connection failure occurred"
    if status in {408, 429} or status >= 500:
        return True, "rate_limited" if status == 429 else "upstream_error", f"HTTP {status} may be transient"
    return False, code or "rejected", f"HTTP {status} is not retryable unchanged"


base.classify = classify


class OpenArtGenerator(general.HiggsfieldGenerator):
    def generate(self, request: OpenArtRequest) -> Any:
        if not request.job_id:
            # The form check runs before the base uploads anything, so a bad value spends nothing.
            try:
                request.validate()
                self.transport.preflight(request)
            except base.InvalidRequest as exc:
                return self._invalid(str(exc))
            except base.TransportError as exc:
                return self._transport_failure(exc, 0, stage="preflight")
        return super().generate(request)

    def _summary(self, request: OpenArtRequest) -> dict[str, Any]:
        summary = super()._summary(request)
        summary.update({"model": MODEL, "service": "openart", "openart_mode": request.mode})
        return summary


# --- The command line -----------------------------------------------------------------


def request_from_dict(data: dict[str, Any]) -> OpenArtRequest:
    request = general.request_from_dict(data)
    model = str(data.get("model", MODEL))
    if model not in MODEL_NAMES:
        raise base.InvalidRequest(f"this service runs {MODEL} only, not {model!r}")
    return OpenArtRequest(**{**request.__dict__, "model": MODEL})


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate Seedance 2.0 Mini clips on OpenArt; emits one JSON object."
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--prompt")
    source.add_argument("--prompt-file", type=Path)
    source.add_argument("--request-json", metavar="PATH|-", help="load request JSON; use - for stdin")
    source.add_argument("--job-id", help="resume polling/downloading an existing paid generation (history id)")
    parser.add_argument("--prompt-section", help="use the first fenced prompt under this Markdown section")
    parser.add_argument("--start-image", metavar="@ALIAS=PATH", help="the film's first frame (image2video)")
    parser.add_argument("--end-image", metavar="@ALIAS=PATH", help="the film's last frame; needs --start-image")
    parser.add_argument("--image-reference", action="append", default=[], metavar="@ALIAS=PATH",
                        help="identity/style/composition material, never a frame (element2video)")
    parser.add_argument("--video-reference", action="append", default=[], metavar="@ALIAS=PATH")
    parser.add_argument("--audio-reference", action="append", default=[], metavar="@ALIAS=PATH")
    parser.add_argument("--duration", type=int,
                        help=f"seconds, {DURATION_RANGE.start}-{DURATION_RANGE.stop - 1}")
    parser.add_argument("--output", type=Path, default=Path("generated.mp4"))
    parser.add_argument("--format", choices=sorted(FORMATS), default="portrait-720p",
                        help="shorthand for an aspect ratio and a resolution together")
    parser.add_argument("--aspect-ratio", help="overrides the format's aspect ratio")
    parser.add_argument("--resolution", help="overrides the format's resolution")
    parser.add_argument("--no-audio", action="store_true")
    parser.add_argument("--seed", type=int, help="the OpenArt form accepts a seed; the Higgsfield one does not")
    parser.add_argument("--max-retries-per-10-seconds", type=int, default=2)
    parser.add_argument("--max-auto-wait-seconds", type=float, default=10.0)
    parser.add_argument("--timeout-seconds", type=float, default=180.0)
    parser.add_argument("--poll-interval-seconds", type=float, default=10.0)
    parser.add_argument("--max-poll-seconds", type=float, default=900.0)
    parser.add_argument("--openart-bin", help="path to the openart CLI")
    parser.add_argument("--dry-run", action="store_true",
                        help="validate against the live form, print the body and the quote; upload and send nothing")
    # Read by the Higgsfield flag parsing; OpenArt's form offers neither.
    parser.set_defaults(genre=None, bitrate_mode=None, model=MODEL)
    return parser


def _cli_request(args: argparse.Namespace) -> OpenArtRequest:
    if args.request_json:
        raw = sys.stdin.read() if args.request_json == "-" else Path(args.request_json).read_text(encoding="utf-8")
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise base.InvalidRequest("request JSON must be an object")
        return request_from_dict(data)
    request = general._cli_request(args)
    return OpenArtRequest(**{**request.__dict__, "model": MODEL, "seed": args.seed,
                             "aspect_ratio": args.aspect_ratio, "resolution": args.resolution})


def dry_run(request: OpenArtRequest, cli: Any) -> dict[str, Any]:
    request.validate()
    result: dict[str, Any] = {
        "ok": True,
        "attempts": 0,
        "retry": {"allowed": False, "after_seconds": None, "reason": "dry run: nothing was uploaded or sent"},
    }
    if request.job_id:
        result["job"] = {"id": request.job_id, "status": "not polled"}
        result["request"] = {"command": [cli.binary, "creation", "get", request.job_id, "--json"]}
        return result
    notes: list[str] = []
    body = placeholder_body(request)
    quote = None
    try:
        check_against_form(body["params"], cli.form(MODEL, request.mode), request.mode)
        quote = quote_of(cli.cost(MODEL, request.mode))
        notes.append("the quote is for the config it names, not this request; job.usage.credits_spent is the real cost")
    except openart.NotLoggedIn:
        notes.append("not logged in: the body is not checked against the model form and no cost is quoted")
    result["request"] = {
        **OpenArtGenerator(None)._summary(request),
        "endpoint": f"POST {openart.API_BASE}{openart.GENERATE_PATH}",
        "body": body,
        "quote": quote,
        "notes": notes,
    }
    return result


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        request = _cli_request(args)
        cli = openart.OpenArtCLI(openart.find_cli(args.openart_bin))
        if args.dry_run:
            payload, code = dry_run(request, cli), 0
        else:
            result = OpenArtGenerator(OpenArtTransport(cli), OpenArtUploader(cli)).generate(request)
            payload = result.to_dict()
            if result.ok:
                code = 0
            elif result.retry.allowed:
                code = base.EXIT_TEMPORARY
            elif result.error and result.error.kind == "invalid_request":
                code = base.EXIT_INVALID
            else:
                code = base.EXIT_PERMANENT
    except (base.InvalidRequest, openart.InvalidRequest, openart.CLIError, OSError, json.JSONDecodeError,
            ValueError) as exc:
        payload, code = OpenArtGenerator._invalid(str(exc)).to_dict(), base.EXIT_INVALID
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
