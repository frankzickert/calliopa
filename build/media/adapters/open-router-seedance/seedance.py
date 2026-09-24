#!/usr/bin/env python3
"""Agent-safe OpenRouter Seedance 2.0 Mini video generation client.

The module is importable and executable. It uses only the standard library so
all retry decisions remain visible and bounded by this tool.
"""

from __future__ import annotations

import argparse
import email.utils
import json
import mimetypes
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from collections import defaultdict, deque
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable, Protocol


MODEL = "bytedance/seedance-2.0-mini"
API_BASE = "https://openrouter.ai/api/v1"
SCRIPT_DIR = Path(__file__).resolve().parent
DOTENV_PATH = Path(os.environ.get("CALLIOPA_MEDIA_ENV", "/run/secrets/calliopa/media.env"))
FORMATS = {
    "portrait-720p": {"resolution": "720p", "aspect_ratio": "9:16", "width": 720, "height": 1280},
    "landscape-720p": {"resolution": "720p", "aspect_ratio": "16:9", "width": 1280, "height": 720},
}
MEDIA_NAMES = {"image": "Image", "video": "Video", "audio": "Audio"}
MEDIA_TYPES = {
    "image": "image_url",
    "video": "video_url",
    "audio": "audio_url",
}
TYPE_KEYS = {
    "image": "image_url",
    "video": "video_url",
    "audio": "audio_url",
}
EXTENSION_TYPES = {
    ".png": "image", ".jpg": "image", ".jpeg": "image", ".webp": "image", ".gif": "image",
    ".mp4": "video", ".mov": "video", ".webm": "video", ".mkv": "video", ".m4v": "video",
    ".mp3": "audio", ".wav": "audio", ".m4a": "audio", ".aac": "audio", ".ogg": "audio", ".flac": "audio",
}
ALIAS_PATTERN = re.compile(r"(?<![\w.])@([A-Za-z][A-Za-z0-9_-]*)\b")
NATIVE_PATTERN = re.compile(r"(?<![\w.])@(Image|Video|Audio)\s*(\d+)\b", re.IGNORECASE)
EXIT_INVALID = 2
EXIT_TEMPORARY = 75
EXIT_PERMANENT = 1


class InvalidRequest(ValueError):
    """The request must change before it can succeed."""


def config_value(
    requested_name: str,
    dotenv_path: Path = DOTENV_PATH,
    environ: dict[str, str] | os._Environ[str] = os.environ,
) -> str:
    exported = environ.get(requested_name, "").strip()
    if exported:
        return exported
    try:
        lines = dotenv_path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return ""
    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        env_name, separator, value = line.partition("=")
        if separator and env_name.strip() == requested_name:
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
                value = value[1:-1]
            return value.strip()
    return ""


def api_key(
    dotenv_path: Path = DOTENV_PATH,
    environ: dict[str, str] | os._Environ[str] = os.environ,
) -> str:
    return config_value("OPENROUTER_API_KEY", dotenv_path, environ)


def aws_cli_environment(
    dotenv_path: Path = DOTENV_PATH,
    environ: dict[str, str] | os._Environ[str] = os.environ,
) -> dict[str, str]:
    """Build an AWS CLI environment, loading credentials from the repo .env.

    Standard AWS variable names are preferred. The shorter legacy names are
    accepted so existing Calliopa deployments continue to work.
    """
    result = dict(environ)
    aliases = {
        "AWS_ACCESS_KEY_ID": "AWS_ACCESS_KEY",
        "AWS_SECRET_ACCESS_KEY": "AWS_ACCESS_SECRET",
        "AWS_SESSION_TOKEN": "AWS_SESSION_TOKEN",
    }
    for standard_name, legacy_name in aliases.items():
        value = config_value(standard_name, dotenv_path, environ)
        if not value and legacy_name != standard_name:
            value = config_value(legacy_name, dotenv_path, environ)
        if value:
            result[standard_name] = value
    return result


def _infer_media_type(source: str) -> str:
    path = urllib.parse.urlparse(source).path
    suffix = Path(path).suffix.lower()
    media_type = EXTENSION_TYPES.get(suffix)
    if not media_type:
        raise InvalidRequest(
            f"cannot infer reference type from {source!r}; specify image, video, or audio"
        )
    return media_type


@dataclass(frozen=True)
class Reference:
    alias: str
    source: str
    media_type: str

    @classmethod
    def parse(cls, value: str, media_type: str | None = None) -> "Reference":
        alias, separator, source = value.partition("=")
        if not separator:
            raise InvalidRequest(f"invalid reference {value!r}; expected @alias=path-or-url")
        alias = alias.strip().removeprefix("@")
        source = source.strip()
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]*", alias):
            raise InvalidRequest(f"invalid reference alias: {alias!r}")
        if not source:
            raise InvalidRequest(f"reference @{alias} has no path or URL")
        kind = (media_type or _infer_media_type(source)).lower()
        if kind not in MEDIA_TYPES:
            raise InvalidRequest("reference type must be image, video, or audio")
        if not _is_url(source):
            source = str(Path(source).expanduser().resolve())
        return cls(alias, source, kind)


@dataclass(frozen=True)
class VideoRequest:
    prompt: str
    duration: int
    output: Path
    references: tuple[Reference, ...]
    format: str = "portrait-720p"
    generate_audio: bool = True
    seed: int | None = None
    max_retries_per_10_seconds: int = 2
    max_auto_wait_seconds: float = 10.0
    timeout_seconds: float = 180.0
    poll_interval_seconds: float = 10.0
    max_poll_seconds: float = 900.0
    job_id: str | None = None

    def duration_range(self) -> range:
        """Seconds a clip may run on this carrier's model. Seedance 2.0 Mini: 4-15."""
        return range(4, 16)

    def validate(self) -> None:
        if self.job_id:
            if not re.fullmatch(r"[A-Za-z0-9_-]+", self.job_id):
                raise InvalidRequest("job_id contains unsupported characters")
            if self.max_poll_seconds <= 0 or self.poll_interval_seconds <= 0:
                raise InvalidRequest("poll timing values must be > 0")
            return
        if not self.prompt.strip():
            raise InvalidRequest("prompt must not be empty")
        allowed = self.duration_range()
        if self.duration not in allowed:
            raise InvalidRequest(
                f"duration must be an integer from {allowed.start} to {allowed.stop - 1} seconds for this model"
            )
        if self.format not in FORMATS:
            raise InvalidRequest(f"unknown format {self.format!r}; choose one of {sorted(FORMATS)}")
        if not self.references:
            raise InvalidRequest("at least one image, video, or audio reference is required")
        if self.max_retries_per_10_seconds < 0:
            raise InvalidRequest("max_retries_per_10_seconds must be >= 0")
        if min(self.timeout_seconds, self.poll_interval_seconds, self.max_poll_seconds) <= 0:
            raise InvalidRequest("timeout and polling values must be > 0")
        aliases = [reference.alias for reference in self.references]
        if len(aliases) != len(set(aliases)):
            raise InvalidRequest("reference aliases must be unique")
        for reference in self.references:
            if not _is_url(reference.source) and not Path(reference.source).is_file():
                raise InvalidRequest(f"reference does not exist: {reference.source}")
        _validate_prompt_references(self.prompt, self.references)


@dataclass(frozen=True)
class RetryInstruction:
    allowed: bool
    after_seconds: float | None
    reason: str


@dataclass(frozen=True)
class ErrorInfo:
    kind: str
    message: str
    status: int | None = None
    code: str | None = None
    request_id: str | None = None


@dataclass(frozen=True)
class GenerationResult:
    ok: bool
    attempts: int
    retry: RetryInstruction
    video: dict[str, Any] | None = None
    job: dict[str, Any] | None = None
    error: ErrorInfo | None = None
    request: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {key: value for key, value in asdict(self).items() if value is not None}


class TransportError(Exception):
    def __init__(self, message: str, *, status: int | None = None, code: str | None = None,
                 request_id: str | None = None, retry_after_seconds: float | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.request_id = request_id
        self.retry_after_seconds = retry_after_seconds


@dataclass(frozen=True)
class PublishedAsset:
    url: str
    storage_uri: str
    source: str


class ReferencePublisher(Protocol):
    def publish(self, reference: Reference) -> PublishedAsset: ...
    def delete(self, asset: PublishedAsset) -> None: ...


class S3ReferencePublisher:
    """Publish local references as private S3 objects with presigned HTTPS URLs."""

    def __init__(self, bucket: str, *, prefix: str = "seedance-references",
                 expires_seconds: int = 3600, region: str | None = None,
                 environment: dict[str, str] | None = None) -> None:
        if not bucket or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.-]{1,61}[A-Za-z0-9]", bucket):
            raise InvalidRequest("a valid SEEDANCE_REFERENCE_S3_BUCKET is required for local files")
        if not 60 <= expires_seconds <= 604800:
            raise InvalidRequest("reference URL expiry must be between 60 and 604800 seconds")
        self.bucket = bucket
        self.prefix = prefix.strip("/") or "seedance-references"
        self.expires_seconds = expires_seconds
        self.region = region
        self.environment = environment

    def publish(self, reference: Reference) -> PublishedAsset:
        path = Path(reference.source)
        key = f"{self.prefix}/{uuid.uuid4().hex}/{path.name}"
        storage_uri = f"s3://{self.bucket}/{key}"
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        command = ["aws", "s3", "cp", str(path), storage_uri, "--content-type", mime, "--only-show-errors"]
        if self.region:
            command.extend(["--region", self.region])
        self._run(command, "upload reference")
        presign = ["aws", "s3", "presign", storage_uri, "--expires-in", str(self.expires_seconds)]
        if self.region:
            presign.extend(["--region", self.region])
        try:
            url = self._run(presign, "presign reference").strip()
        except TransportError:
            try:
                self.delete(PublishedAsset("", storage_uri, str(path)))
            except TransportError:
                pass
            raise
        if not url.startswith("https://"):
            raise TransportError("AWS returned a non-HTTPS presigned reference URL")
        return PublishedAsset(url, storage_uri, str(path))

    def delete(self, asset: PublishedAsset) -> None:
        command = ["aws", "s3", "rm", asset.storage_uri, "--only-show-errors"]
        if self.region:
            command.extend(["--region", self.region])
        self._run(command, "delete temporary reference")

    def _run(self, command: list[str], action: str) -> str:
        try:
            completed = subprocess.run(
                command, capture_output=True, text=True, timeout=180, check=False,
                env=self.environment,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise TransportError(f"could not {action}: {exc}") from exc
        if completed.returncode != 0:
            detail = (completed.stderr or completed.stdout).strip()[:1200]
            raise TransportError(f"could not {action}: {detail or 'AWS CLI failed'}")
        return completed.stdout


class VideoTransport(Protocol):
    def submit(self, payload: dict[str, Any], timeout: float) -> dict[str, Any]: ...
    def poll(self, job_id: str, timeout: float) -> dict[str, Any]: ...
    def download(self, job_id: str, timeout: float) -> bytes: ...


def _is_url(value: str) -> bool:
    return urllib.parse.urlparse(value).scheme.lower() in {"http", "https", "data"}


def _validate_prompt_references(prompt: str, references: tuple[Reference, ...]) -> None:
    aliases = {reference.alias for reference in references}
    custom_mentions = set(ALIAS_PATTERN.findall(NATIVE_PATTERN.sub("", prompt)))
    unknown = custom_mentions - aliases
    if unknown:
        raise InvalidRequest("prompt uses unattached references: " + ", ".join(f"@{x}" for x in sorted(unknown)))
    counts: dict[str, int] = defaultdict(int)
    native_for_alias: dict[str, tuple[str, int]] = {}
    for reference in references:
        counts[reference.media_type] += 1
        native_for_alias[reference.alias] = (reference.media_type, counts[reference.media_type])
    native_mentions = {(name.lower(), int(number)) for name, number in NATIVE_PATTERN.findall(prompt)}
    for kind, number in native_mentions:
        if number < 1 or number > counts[kind]:
            raise InvalidRequest(f"prompt references unattached @{MEDIA_NAMES[kind]} {number}")
    unused = {
        alias for alias in aliases
        if alias not in custom_mentions and native_for_alias[alias] not in native_mentions
    }
    if unused:
        raise InvalidRequest("every attachment must be referenced in the prompt; missing: " + ", ".join(f"@{x}" for x in sorted(unused)))


def expanded_prompt(prompt: str, references: tuple[Reference, ...]) -> str:
    counters: dict[str, int] = defaultdict(int)
    positions: dict[str, str] = {}
    legend = []
    for reference in references:
        counters[reference.media_type] += 1
        native = f"@{MEDIA_NAMES[reference.media_type]} {counters[reference.media_type]}"
        positions[reference.alias] = native
        legend.append(f"- @{reference.alias} = {native} ({_source_name(reference.source)})")
    rewritten = prompt
    for alias, native in positions.items():
        rewritten = re.sub(rf"(?<![\w.])@{re.escape(alias)}\b", native, rewritten)
    return "Reference mapping:\n" + "\n".join(legend) + "\n\n" + rewritten.strip()


def _source_name(source: str) -> str:
    if source.startswith("data:"):
        return "embedded data"
    return Path(urllib.parse.urlparse(source).path).name or "reference"


def _reference_url(reference: Reference, publisher: ReferencePublisher | None,
                   published: list[PublishedAsset]) -> str:
    if _is_url(reference.source):
        if not reference.source.startswith("https://"):
            raise InvalidRequest("OpenRouter video generation requires HTTPS reference URLs")
        return reference.source
    if publisher is None:
        raise InvalidRequest(
            "local references require SEEDANCE_REFERENCE_S3_BUCKET or --reference-s3-bucket"
        )
    asset = publisher.publish(reference)
    published.append(asset)
    return asset.url


def build_payload(request: VideoRequest, publisher: ReferencePublisher | None = None,
                  published: list[PublishedAsset] | None = None) -> dict[str, Any]:
    published = published if published is not None else []
    preset = FORMATS[request.format]
    payload: dict[str, Any] = {
        "model": MODEL,
        "prompt": expanded_prompt(request.prompt, request.references),
        "duration": request.duration,
        "resolution": preset["resolution"],
        "aspect_ratio": preset["aspect_ratio"],
        "generate_audio": request.generate_audio,
        "input_references": [],
    }
    if request.seed is not None:
        payload["seed"] = request.seed
    for reference in request.references:
        key = TYPE_KEYS[reference.media_type]
        payload["input_references"].append({
            "type": MEDIA_TYPES[reference.media_type],
            key: {"url": _reference_url(reference, publisher, published)},
        })
    return payload


def _retry_after(headers: Any) -> float | None:
    raw = headers.get("Retry-After") if headers else None
    if not raw:
        return None
    try:
        return max(0.0, float(raw))
    except (TypeError, ValueError):
        try:
            return max(0.0, email.utils.parsedate_to_datetime(raw).timestamp() - time.time())
        except (TypeError, ValueError, OverflowError):
            return None


class OpenRouterTransport:
    def __init__(self, key: str, api_base: str = API_BASE) -> None:
        if not key:
            raise InvalidRequest("OPENROUTER_API_KEY is not configured")
        self.key = key
        self.api_base = api_base.rstrip("/")

    def _request(self, method: str, path: str, timeout: float,
                 payload: dict[str, Any] | None = None) -> tuple[bytes, Any]:
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {"Authorization": f"Bearer {self.key}", "User-Agent": "calliopa-seedance/1.0"}
        if data is not None:
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(f"{self.api_base}{path}", data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read(), response.headers
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", "replace")[:8000]
            detail: dict[str, Any] = {}
            try:
                decoded = json.loads(raw)
                candidate = decoded.get("error", decoded) if isinstance(decoded, dict) else {}
                detail = candidate if isinstance(candidate, dict) else {"message": str(candidate)}
            except json.JSONDecodeError:
                pass
            raw_code = detail.get("code") or detail.get("type")
            raise TransportError(
                str(detail.get("message") or detail.get("error") or f"OpenRouter returned HTTP {exc.code}"),
                status=exc.code,
                code=str(raw_code) if raw_code is not None else None,
                request_id=exc.headers.get("x-request-id"),
                retry_after_seconds=_retry_after(exc.headers),
            ) from exc
        except (urllib.error.URLError, TimeoutError, socket.timeout) as exc:
            raise TransportError(f"OpenRouter connection failed: {getattr(exc, 'reason', exc)}") from exc

    def submit(self, payload: dict[str, Any], timeout: float) -> dict[str, Any]:
        raw, _ = self._request("POST", "/videos", timeout, payload)
        return _decode_json(raw, "submission")

    def poll(self, job_id: str, timeout: float) -> dict[str, Any]:
        raw, _ = self._request("GET", f"/videos/{job_id}", timeout)
        return _decode_json(raw, "poll")

    def download(self, job_id: str, timeout: float) -> bytes:
        raw, _ = self._request("GET", f"/videos/{job_id}/content?index=0", timeout)
        if not raw:
            raise TransportError("OpenRouter returned an empty video")
        return raw


def _decode_json(raw: bytes, stage: str) -> dict[str, Any]:
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise TransportError(f"OpenRouter returned invalid JSON during {stage}") from exc
    if not isinstance(value, dict):
        raise TransportError(f"OpenRouter returned a non-object during {stage}")
    return value


class RetryThrottle:
    def __init__(self, maximum: int, clock: Callable[[], float]) -> None:
        self.maximum = maximum
        self.clock = clock
        self.executed: deque[float] = deque()

    def reserve(self) -> tuple[bool, float]:
        now = self.clock()
        while self.executed and now - self.executed[0] >= 10.0:
            self.executed.popleft()
        if self.maximum == 0:
            return False, 0.0
        if len(self.executed) >= self.maximum:
            return False, max(0.0, 10.0 - (now - self.executed[0]))
        self.executed.append(now)
        return True, 0.0

    def cooldown(self) -> float:
        now = self.clock()
        while self.executed and now - self.executed[0] >= 10.0:
            self.executed.popleft()
        if not self.executed:
            return 0.0
        return max(0.0, 10.0 - (now - self.executed[0]))


def classify(error: TransportError) -> tuple[bool, str, str]:
    code = str(error.code or "").lower()
    if code in {"moderation_blocked", "content_policy_violation", "invalid_api_key", "insufficient_credits"}:
        return False, code, "the prompt, credential, or account must change"
    if error.status is None:
        return True, "connection_error", "a transient connection failure occurred"
    if error.status in {408, 409, 429} or error.status >= 500:
        return True, "rate_limited" if error.status == 429 else "upstream_error", f"HTTP {error.status} may be transient"
    if error.status == 402:
        return False, "payment_required", "add OpenRouter credits before trying again"
    if error.status in {400, 401, 403, 404, 422}:
        return False, code or "invalid_request", f"HTTP {error.status} is not retryable unchanged"
    return False, code or "api_error", f"HTTP {error.status} is not classified as transient"


class SeedanceGenerator:
    def __init__(self, transport: VideoTransport, publisher: ReferencePublisher | None = None,
                 *, clock: Callable[[], float] = time.monotonic,
                 sleeper: Callable[[float], None] = time.sleep) -> None:
        self.transport = transport
        self.publisher = publisher
        self.clock = clock
        self.sleeper = sleeper

    def generate(self, request: VideoRequest) -> GenerationResult:
        try:
            request.validate()
        except InvalidRequest as exc:
            return self._invalid(str(exc))
        attempts = 0
        published: list[PublishedAsset] = []
        job: dict[str, Any]
        if request.job_id:
            job = {"id": request.job_id, "status": "resuming"}
        else:
            try:
                payload = build_payload(request, self.publisher, published)
            except (InvalidRequest, OSError) as exc:
                self._cleanup(published)
                return self._invalid(str(exc))
            except TransportError as exc:
                self._cleanup(published)
                return self._transport_failure(exc, attempts, stage="publish")
            try:
                attempts += 1
                job = self.transport.submit(payload, request.timeout_seconds)
            except TransportError as exc:
                result = self._transport_failure(exc, attempts, stage="submit")
                # A definite client rejection means no job can still need the
                # references. Preserve them on ambiguous network/5xx outcomes.
                if exc.status is not None and exc.status < 500:
                    self._cleanup(published)
                return result
            if not job.get("id"):
                # The outcome is malformed and may still represent an accepted
                # paid job, so keep the expiring references available.
                return self._transport_failure(TransportError("submission response has no job id"), attempts, stage="submit")

        job_id = str(job["id"])
        deadline = self.clock() + request.max_poll_seconds
        throttle = RetryThrottle(request.max_retries_per_10_seconds, self.clock)
        retry_count = 0
        while True:
            if self.clock() >= deadline:
                return GenerationResult(
                    False, attempts, RetryInstruction(True, request.poll_interval_seconds,
                    "polling deadline reached; resume this existing job, do not submit a new one"),
                    job={"id": job_id, "status": job.get("status", "in_progress"),
                         "published_references": self._published_summary(published)},
                    error=ErrorInfo("poll_timeout", "video job is still pending"),
                    request=self._summary(request),
                )
            try:
                attempts += 1
                job = self.transport.poll(job_id, request.timeout_seconds)
            except TransportError as exc:
                retryable, _, _ = classify(exc)
                if not retryable:
                    return self._transport_failure(exc, attempts, stage="poll", job_id=job_id)
                if retry_count >= request.max_retries_per_10_seconds:
                    result = self._transport_failure(exc, attempts, stage="poll", job_id=job_id)
                    delay = max(exc.retry_after_seconds or 0.0, throttle.cooldown(), request.poll_interval_seconds)
                    return GenerationResult(**{**result.__dict__, "retry": RetryInstruction(True, delay,
                        "retry throttle budget exhausted; resume this job after the delay")})
                reserved, wait = throttle.reserve()
                if not reserved:
                    result = self._transport_failure(exc, attempts, stage="poll", job_id=job_id)
                    return GenerationResult(**{**result.__dict__, "retry": RetryInstruction(True, wait,
                        "retry throttle exhausted; resume this job after the delay")})
                delay = max(exc.retry_after_seconds or 0.0, min(0.5 * 2**retry_count, 4.0))
                if delay > request.max_auto_wait_seconds:
                    result = self._transport_failure(exc, attempts, stage="poll", job_id=job_id)
                    return GenerationResult(**{**result.__dict__, "retry": RetryInstruction(True, delay,
                        "server backoff exceeds max_auto_wait_seconds; resume this job later")})
                retry_count += 1
                self.sleeper(delay)
                continue

            status = str(job.get("status", "")).lower()
            if status == "completed":
                try:
                    attempts += 1
                    video = self.transport.download(job_id, request.timeout_seconds)
                    saved = _save_video(video, request.output)
                except TransportError as exc:
                    self._cleanup(published)
                    return self._transport_failure(exc, attempts, stage="download", job_id=job_id)
                except OSError as exc:
                    self._cleanup(published)
                    return self._invalid(str(exc), attempts)
                cleanup_errors = self._cleanup(published)
                final_job = _job_summary(job)
                if cleanup_errors:
                    final_job["cleanup_errors"] = cleanup_errors
                return GenerationResult(True, attempts, RetryInstruction(False, None, "request completed"),
                    video={**saved, **self._format_summary(request)}, job=final_job, request=self._summary(request))
            if status in {"failed", "cancelled", "expired"}:
                cleanup_errors = self._cleanup(published)
                final_job = _job_summary(job)
                if cleanup_errors:
                    final_job["cleanup_errors"] = cleanup_errors
                return GenerationResult(False, attempts, RetryInstruction(False, None,
                    f"job reached terminal status {status}; changing nothing will not help"),
                    job=final_job, error=ErrorInfo("job_failed", str(job.get("error") or status)),
                    request=self._summary(request))
            self.sleeper(request.poll_interval_seconds)

    def _transport_failure(self, error: TransportError, attempts: int, *, stage: str,
                           job_id: str | None = None) -> GenerationResult:
        retryable, kind, reason = classify(error)
        if stage == "submit" and error.status is None:
            retryable = False
            reason = "submission outcome is unknown; do not risk creating a duplicate paid job"
        retry = RetryInstruction(retryable, error.retry_after_seconds, reason)
        job = {"id": job_id, "status": "unknown"} if job_id else None
        if job_id and retryable:
            retry = RetryInstruction(True, error.retry_after_seconds or 1.0,
                f"{reason}; resume job {job_id}, do not submit a new one")
        return GenerationResult(False, attempts, retry, job=job,
            error=ErrorInfo(kind, str(error), error.status, error.code, error.request_id))

    @staticmethod
    def _invalid(message: str, attempts: int = 0) -> GenerationResult:
        return GenerationResult(False, attempts, RetryInstruction(False, None, "fix the request before trying again"),
                                error=ErrorInfo("invalid_request", message))

    @staticmethod
    def _format_summary(request: VideoRequest) -> dict[str, Any]:
        preset = FORMATS[request.format]
        return {"width": preset["width"], "height": preset["height"], "duration": request.duration,
                "preset": request.format, "format": "mp4"}

    def _summary(self, request: VideoRequest) -> dict[str, Any]:
        return {"model": MODEL, "format": request.format, "duration": request.duration,
                "generate_audio": request.generate_audio,
                "reference_aliases": [f"@{x.alias}" for x in request.references],
                "expanded_prompt": expanded_prompt(request.prompt, request.references) if request.references else request.prompt,
                "max_retries_per_10_seconds": request.max_retries_per_10_seconds}

    def _cleanup(self, assets: list[PublishedAsset]) -> list[str]:
        if self.publisher is None:
            return []
        errors = []
        for asset in reversed(assets):
            try:
                self.publisher.delete(asset)
            except TransportError as exc:
                errors.append(f"{asset.storage_uri}: {exc}")
        assets.clear()
        return errors

    @staticmethod
    def _published_summary(assets: list[PublishedAsset]) -> list[dict[str, str]]:
        return [{"source": asset.source, "storage_uri": asset.storage_uri} for asset in assets]


def _job_summary(job: dict[str, Any]) -> dict[str, Any]:
    return {key: job[key] for key in ("id", "status", "generation_id", "usage") if key in job}


def _save_video(content: bytes, output: Path) -> dict[str, Any]:
    destination = output.expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{destination.name}.", dir=destination.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(content)
        os.replace(temporary, destination)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return {"path": str(destination), "bytes": len(content)}


def request_from_dict(data: dict[str, Any]) -> VideoRequest:
    raw_references = data.get("references", [])
    references = []
    for item in raw_references:
        if isinstance(item, str):
            references.append(Reference.parse(item))
        elif isinstance(item, dict) and "alias" in item and ("path" in item or "url" in item or "source" in item):
            source = item.get("source", item.get("path", item.get("url")))
            references.append(Reference.parse(f"{item['alias']}={source}", item.get("type")))
        else:
            raise InvalidRequest("each reference must be @alias=source or {alias, path/url/source, type?}")
    job_id = data.get("job_id")
    if not job_id and "prompt" not in data:
        raise InvalidRequest("request JSON requires prompt or job_id")
    if not job_id and "duration" not in data:
        raise InvalidRequest("request JSON requires duration")
    return VideoRequest(
        prompt=str(data.get("prompt", "")), duration=int(data.get("duration", 4)),
        output=Path(data.get("output", "generated.mp4")), references=tuple(references),
        format=str(data.get("format", "portrait-720p")),
        generate_audio=bool(data.get("generate_audio", True)), seed=data.get("seed"),
        max_retries_per_10_seconds=int(data.get("max_retries_per_10_seconds", 2)),
        max_auto_wait_seconds=float(data.get("max_auto_wait_seconds", 10.0)),
        timeout_seconds=float(data.get("timeout_seconds", 180.0)),
        poll_interval_seconds=float(data.get("poll_interval_seconds", 10.0)),
        max_poll_seconds=float(data.get("max_poll_seconds", 900.0)), job_id=job_id,
    )


def read_prompt_file(path: Path, section: str | None = None) -> str:
    text = path.read_text(encoding="utf-8")
    if section is None:
        return text
    heading = re.compile(
        rf"^(#{{1,6}})\s+{re.escape(str(section))}(?:\.|\s|$).*?$",
        re.MULTILINE,
    ).search(text)
    if not heading:
        raise InvalidRequest(f"section {section!r} was not found in {path}")
    level = len(heading.group(1))
    following = re.compile(rf"^#{{1,{level}}}\s+", re.MULTILINE).search(text, heading.end())
    section_text = text[heading.end():following.start() if following else len(text)]
    fence = re.search(r"```(?:text)?\s*\n(.*?)\n```", section_text, re.DOTALL)
    if not fence:
        raise InvalidRequest(f"section {section!r} in {path} has no fenced prompt")
    return fence.group(1).strip()


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate Seedance 2.0 Mini clips; emits one JSON object.")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--prompt")
    source.add_argument("--prompt-file", type=Path)
    source.add_argument("--request-json", metavar="PATH|-", help="load request JSON; use - for stdin")
    source.add_argument("--job-id", help="resume polling/downloading an existing paid job")
    parser.add_argument("--prompt-section", help="use the first fenced prompt under this Markdown section")
    parser.add_argument("--reference", action="append", default=[], metavar="@ALIAS=PATH|URL")
    parser.add_argument("--image-reference", action="append", default=[], metavar="@ALIAS=PATH|URL")
    parser.add_argument("--video-reference", action="append", default=[], metavar="@ALIAS=PATH|URL")
    parser.add_argument("--audio-reference", action="append", default=[], metavar="@ALIAS=PATH|URL")
    parser.add_argument("--duration", type=int)
    parser.add_argument("--output", type=Path, default=Path("generated.mp4"))
    parser.add_argument("--format", choices=sorted(FORMATS), default="portrait-720p")
    parser.add_argument("--no-audio", action="store_true")
    parser.add_argument("--seed", type=int)
    parser.add_argument("--max-retries-per-10-seconds", type=int, default=2)
    parser.add_argument("--max-auto-wait-seconds", type=float, default=10.0)
    parser.add_argument("--timeout-seconds", type=float, default=180.0)
    parser.add_argument("--poll-interval-seconds", type=float, default=10.0)
    parser.add_argument("--max-poll-seconds", type=float, default=900.0)
    parser.add_argument("--reference-s3-bucket", help="S3 bucket used to publish local references")
    parser.add_argument("--reference-s3-prefix", default=None, help="temporary S3 object prefix")
    parser.add_argument("--reference-url-expires-seconds", type=int, default=None)
    parser.add_argument("--reference-s3-region", default=None)
    parser.add_argument("--api-base", default=os.environ.get("OPENROUTER_API_BASE", API_BASE), help=argparse.SUPPRESS)
    return parser


def _cli_request(args: argparse.Namespace) -> VideoRequest:
    if args.request_json:
        raw = sys.stdin.read() if args.request_json == "-" else Path(args.request_json).read_text(encoding="utf-8")
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise InvalidRequest("request JSON must be an object")
        return request_from_dict(data)
    references = [Reference.parse(value) for value in args.reference]
    for kind in MEDIA_TYPES:
        references.extend(Reference.parse(value, kind) for value in getattr(args, f"{kind}_reference"))
    if args.prompt_section and not args.prompt_file:
        raise InvalidRequest("--prompt-section requires --prompt-file")
    prompt = args.prompt or (read_prompt_file(args.prompt_file, args.prompt_section) if args.prompt_file else "")
    if not args.job_id and args.duration is None:
        raise InvalidRequest("--duration is required for a new clip")
    return VideoRequest(prompt, args.duration or 4, args.output, tuple(references), args.format,
        not args.no_audio, args.seed, args.max_retries_per_10_seconds, args.max_auto_wait_seconds,
        args.timeout_seconds, args.poll_interval_seconds, args.max_poll_seconds, args.job_id)


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        request = _cli_request(args)
        key = api_key()
        if not key:
            raise InvalidRequest(f"OPENROUTER_API_KEY is not exported and was not found in {DOTENV_PATH}")
        bucket = args.reference_s3_bucket or config_value("SEEDANCE_REFERENCE_S3_BUCKET")
        publisher = None
        if bucket:
            prefix = args.reference_s3_prefix or config_value("SEEDANCE_REFERENCE_S3_PREFIX") or "seedance-references"
            expiry_raw = args.reference_url_expires_seconds or config_value("SEEDANCE_REFERENCE_URL_EXPIRES_SECONDS") or "3600"
            region = args.reference_s3_region or config_value("SEEDANCE_REFERENCE_S3_REGION") or None
            publisher = S3ReferencePublisher(
                bucket, prefix=prefix, expires_seconds=int(expiry_raw), region=region,
                environment=aws_cli_environment(),
            )
        result = SeedanceGenerator(OpenRouterTransport(key, args.api_base), publisher).generate(request)
    except (InvalidRequest, OSError, json.JSONDecodeError, ValueError) as exc:
        result = SeedanceGenerator._invalid(str(exc))
    print(json.dumps(result.to_dict(), ensure_ascii=False, sort_keys=True))
    if result.ok:
        return 0
    if result.retry.allowed:
        return EXIT_TEMPORARY
    if result.error and result.error.kind == "invalid_request":
        return EXIT_INVALID
    return EXIT_PERMANENT


if __name__ == "__main__":
    raise SystemExit(main())
