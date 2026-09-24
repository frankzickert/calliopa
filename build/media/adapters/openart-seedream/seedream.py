#!/usr/bin/env python3
"""Headless Seedream 5.0 Pro client on OpenArt, with @alias references.

The `openart` CLI owns everything OpenArt keeps behind its login: the OAuth
credential, reference uploads, the model's parameter form, and polling. This
script makes the one generate request itself, because the CLI sends no aspect
ratio for images, and checks every parameter against the model's form before a
credit is spent. The paid submission is never retried automatically.

Emits exactly one JSON object on stdout, with gpt-image's exit codes.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import platform
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterable


MODEL = "byte-plus-seedream-5-pro"
ORIGIN = "https://openart.ai"
# The CLI API sits under /suite; the bare origin answers /api/cli/v1/* with an HTML 404.
API_BASE = f"{ORIGIN}/suite"
GENERATE_PATH = "/api/cli/v1/generate"
CDN_PREFIX = "https://cdn.openart.ai/"
# Uploaded references live here; generated results never do.
UPLOADS_MARKER = "/openart-uploads/"
CREDENTIALS_PATH = Path.home() / ".openart" / "cli-credentials.json"
REFERENCE_PATTERN = re.compile(r"(?<![\w.])@([A-Za-z][A-Za-z0-9_-]*)")
UPLOAD_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
OUTPUT_FORMATS = {".png": "PNG", ".jpg": "JPEG", ".jpeg": "JPEG", ".webp": "WEBP"}
# OpenArt's generator takes up to ten; the model form wins when it states maxItems.
DEFAULT_MAX_REFERENCES = 10
FAILED_STATUSES = {"failed", "failure", "error", "cancelled", "canceled", "rejected"}
EXIT_INVALID = 2
EXIT_TEMPORARY = 75
EXIT_PERMANENT = 1


@dataclass(frozen=True)
class FormatPreset:
    name: str
    aspect_ratio: str
    # None keeps the pixels Seedream returns; a size center-crops and resizes to it.
    width: int | None = None
    height: int | None = None


FORMATS = {
    "portrait-720p": FormatPreset("portrait-720p", "9:16", 720, 1280),
    "landscape-1080p": FormatPreset("landscape-1080p", "16:9", 1920, 1080),
    "portrait": FormatPreset("portrait", "9:16"),
    "landscape": FormatPreset("landscape", "16:9"),
    "square": FormatPreset("square", "1:1"),
}

# No format chosen: the vendor picks the shape and the pixels it returns are kept. A format was
# always chosen before, and `landscape-1080p` decided every unchosen request — 16:9, upscaled to
# 1920x1080 — which is a delivery convention rather than anything this request asked for.
# BO_0279_003, user decision 2026-09-22.
NATIVE = FormatPreset("native", "")


class InvalidRequest(ValueError):
    """A local validation error. Repeating the request unchanged cannot work."""


class NotLoggedIn(InvalidRequest):
    """The openart CLI has no credential for openart.ai."""


class CLIError(Exception):
    def __init__(self, message: str, *, timed_out: bool = False) -> None:
        super().__init__(message)
        self.timed_out = timed_out


class TransportError(Exception):
    def __init__(
        self,
        message: str,
        *,
        status: int | None = None,
        code: str | None = None,
        request_id: str | None = None,
        retry_after_seconds: float | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.request_id = request_id
        self.retry_after_seconds = retry_after_seconds


@dataclass(frozen=True)
class ReferenceImage:
    alias: str
    source: str

    @property
    def is_url(self) -> bool:
        return self.source.startswith("https://")

    @classmethod
    def parse(cls, value: str) -> "ReferenceImage":
        alias, separator, raw = value.partition("=")
        if not separator:
            raise InvalidRequest(
                f"invalid reference {value!r}; expected @alias=/path/to/image"
            )
        alias = alias.strip().removeprefix("@")
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]*", alias):
            raise InvalidRequest(f"invalid reference alias: {alias!r}")
        raw = raw.strip()
        if raw.startswith(("http://", "https://")):
            if not raw.startswith(CDN_PREFIX):
                raise InvalidRequest(
                    f"@{alias}: a URL must be on {CDN_PREFIX}; pass the local file instead"
                )
            return cls(alias=alias, source=raw)
        return cls(alias=alias, source=str(Path(raw).expanduser().resolve()))


@dataclass(frozen=True)
class ImageRequest:
    prompt: str
    output: Path
    # None asks for no shape and no resize: the vendor's own. BO_0279_003
    format: str | None = None
    references: tuple[ReferenceImage, ...] = ()
    model: str = MODEL
    params: tuple[tuple[str, str], ...] = ()
    timeout_seconds: float = 600.0

    @property
    def mode(self) -> str:
        return "image2image" if self.references else "text2image"

    def validate(self) -> None:
        if not self.prompt.strip():
            raise InvalidRequest("prompt must not be empty")
        # No format is a shape nobody chose, not an unknown one. BO_0279_003
        if self.format is not None and self.format not in FORMATS:
            raise InvalidRequest(
                f"unknown format {self.format!r}; choose one of {sorted(FORMATS)}"
            )
        if self.output.suffix.lower() not in OUTPUT_FORMATS:
            raise InvalidRequest("output must end in .png, .jpg, .jpeg or .webp")
        if self.timeout_seconds <= 0:
            raise InvalidRequest("timeout_seconds must be > 0")

        aliases = [reference.alias for reference in self.references]
        if len(aliases) != len(set(aliases)):
            raise InvalidRequest("reference aliases must be unique")
        for reference in self.references:
            if reference.is_url:
                continue
            path = Path(reference.source)
            if not path.is_file():
                raise InvalidRequest(f"reference image does not exist: {path}")
            if path.suffix.lower() not in UPLOAD_SUFFIXES:
                raise InvalidRequest(
                    f"@{reference.alias}: OpenArt uploads only {sorted(UPLOAD_SUFFIXES)}"
                )

        mentioned = set(REFERENCE_PATTERN.findall(self.prompt))
        unknown = mentioned.difference(aliases)
        if unknown:
            rendered = ", ".join(f"@{alias}" for alias in sorted(unknown))
            raise InvalidRequest(f"prompt uses unattached references: {rendered}")

        keys = [key for key, _ in self.params]
        if len(keys) != len(set(keys)):
            raise InvalidRequest("each --param key may be given once")
        for key in keys:
            if key in {"prompt", "visualReferences"}:
                raise InvalidRequest(
                    f"--param {key} is set by the script; use --prompt/--reference"
                )
            # An aspect ratio was the script's to set while a format was always chosen. With no
            # format there is nothing to collide with, and the caller naming the vendor's own key
            # is how a chosen ratio reaches OpenArt at all. BO_0279_003
            if "aspect" in key.lower() and self.format is not None:
                raise InvalidRequest(
                    f"--param {key} is set by --format; drop one of them"
                )


@dataclass(frozen=True)
class RetryInstruction:
    allowed: bool
    after_seconds: float | None
    reason: str


@dataclass(frozen=True)
class APIErrorInfo:
    kind: str
    message: str
    status: int | None = None
    code: str | None = None
    request_id: str | None = None


@dataclass
class GenerationResult:
    ok: bool
    retry: RetryInstruction
    submitted: bool = False
    history_id: str | None = None
    image: dict[str, Any] | None = None
    credits: dict[str, Any] | None = None
    error: APIErrorInfo | None = None
    resume: str | None = None
    request: dict[str, Any] | None = None
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        return {key: value for key, value in data.items() if value not in (None, [])}


def expanded_prompt(prompt: str, references: Iterable[ReferenceImage]) -> str:
    references = tuple(references)
    if not references:
        return prompt.strip()
    legend = "\n".join(
        f"- Image {index}: @{reference.alias}"
        for index, reference in enumerate(references, start=1)
    )
    rewritten = prompt
    for index, reference in enumerate(references, start=1):
        rewritten = re.sub(
            rf"(?<![\w.])@{re.escape(reference.alias)}(?![\w-])",
            f"Image {index} (@{reference.alias})",
            rewritten,
        )
    return (
        "Reference images are attached in this exact order:\n"
        f"{legend}\n\nInstructions:\n{rewritten.strip()}"
    )


# --- The model form ---------------------------------------------------------


def form_properties(form: Any) -> dict[str, Any]:
    """Return the JSON Schema properties of an `openart model form` result."""
    schema = find_key(form, ("jsonSchema",)) if isinstance(form, dict) else None
    if not isinstance(schema, dict):
        schema = form if isinstance(form, dict) else {}
    properties = schema.get("properties")
    return properties if isinstance(properties, dict) else {}


def aspect_key(properties: dict[str, Any]) -> str | None:
    for key in properties:
        if "aspect" in key.lower():
            return key
    return None


def allowed_values(schema: dict[str, Any]) -> list[Any] | None:
    if isinstance(schema.get("enum"), list):
        return schema["enum"]
    for branch in ("oneOf", "anyOf"):
        options = schema.get(branch)
        if isinstance(options, list):
            consts = [item["const"] for item in options if isinstance(item, dict) and "const" in item]
            if consts:
                return consts
    return None


def coerce(key: str, raw: str, schema: dict[str, Any]) -> Any:
    kind = schema.get("type")
    try:
        if kind == "integer":
            return int(raw)
        if kind == "number":
            return float(raw)
    except ValueError as exc:
        raise InvalidRequest(f"--param {key} must be a {kind}, got {raw!r}") from exc
    if kind == "boolean":
        if raw.lower() not in {"true", "false"}:
            raise InvalidRequest(f"--param {key} must be true or false, got {raw!r}")
        return raw.lower() == "true"
    return raw


def check_value(key: str, value: Any, schema: dict[str, Any]) -> None:
    values = allowed_values(schema)
    if values is not None and value not in values:
        raise InvalidRequest(f"{key}={value!r} is not accepted; the form allows {values}")


def build_params(
    request: ImageRequest,
    properties: dict[str, Any] | None,
    assets: dict[str, dict[str, str]],
) -> dict[str, Any]:
    """The generate request's params, checked against the form when there is one."""
    params: dict[str, Any] = {
        "prompt": expanded_prompt(request.prompt, request.references)
    }
    if request.references:
        params["visualReferences"] = [
            {"type": "image", "label": reference.alias, **assets[reference.alias]}
            for reference in request.references
        ]

    # An absent format asks for no shape at all, and the vendor applies its own. BO_0279_003
    aspect = preset_of(request).aspect_ratio
    if properties is None:
        # No form to read (dry run while logged out): the CLI's own video key.
        if aspect:
            params["aspectRatio"] = aspect
        params.update(dict(request.params))
        return params

    key = aspect_key(properties)
    if aspect and key is None:
        raise InvalidRequest(
            f"{request.model} {request.mode} has no aspect-ratio parameter; "
            f"its form accepts {sorted(properties)}"
        )
    if aspect and key is not None:
        check_value(key, aspect, properties[key])
        params[key] = aspect

    prompt_schema = properties.get("prompt", {})
    limit = prompt_schema.get("maxLength") if isinstance(prompt_schema, dict) else None
    if isinstance(limit, int) and len(params["prompt"]) > limit:
        raise InvalidRequest(
            f"the prompt with its reference legend is {len(params['prompt'])} characters; "
            f"{request.model} accepts {limit}"
        )

    refs_schema = properties.get("visualReferences", {})
    most = refs_schema.get("maxItems") if isinstance(refs_schema, dict) else None
    most = most if isinstance(most, int) else DEFAULT_MAX_REFERENCES
    if len(request.references) > most:
        raise InvalidRequest(f"{len(request.references)} references; {request.model} takes {most}")

    for name, raw in request.params:
        if name not in properties:
            raise InvalidRequest(
                f"--param {name} is not in the {request.model} {request.mode} form; "
                f"it accepts {sorted(properties)}"
            )
        value = coerce(name, raw, properties[name])
        check_value(name, value, properties[name])
        params[name] = value
    return params


# --- Reading CLI and API responses -------------------------------------------


def find_key(obj: Any, names: tuple[str, ...]) -> Any:
    """First value stored under any of `names`, searching depth-first; names in priority order."""
    for name in names:
        stack = [obj]
        while stack:
            current = stack.pop(0)
            if isinstance(current, dict):
                if name in current and current[name] not in (None, ""):
                    return current[name]
                stack.extend(current.values())
            elif isinstance(current, list):
                stack.extend(current)
    return None


def result_urls(obj: Any) -> list[str]:
    """Generated image URLs: under `resources` when present, never an uploaded reference."""
    resources = find_key(obj, ("resources",))
    urls = [url for url in all_urls(resources if resources else obj) if UPLOADS_MARKER not in url]
    return urls


def all_urls(obj: Any) -> list[str]:
    urls: list[str] = []

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                if key in {"url", "accessURL"} and isinstance(value, str) and value.startswith("http"):
                    if value not in urls:
                        urls.append(value)
                else:
                    walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(obj)
    return urls


def credit_balance(account: Any) -> Any:
    credits = find_key(account, ("credits",))
    if isinstance(credits, dict):
        for key in ("total", "balance", "remaining", "available"):
            if isinstance(credits.get(key), (int, float)):
                return credits[key]
    return credits


# --- The two transports -------------------------------------------------------


class OpenArtCLI:
    def __init__(self, binary: str) -> None:
        self.binary = binary

    def run_json(self, *args: str, timeout: float = 120.0) -> Any:
        command = [self.binary, *args, "--json", "--no-input", "--quiet"]
        try:
            completed = subprocess.run(
                command, capture_output=True, text=True, timeout=timeout
            )
        except subprocess.TimeoutExpired as exc:
            raise CLIError(f"`openart {' '.join(args)}` timed out", timed_out=True) from exc
        except OSError as exc:
            raise InvalidRequest(f"cannot run {self.binary}: {exc}") from exc
        message = (completed.stderr.strip() or completed.stdout.strip())[:2000]
        if completed.returncode != 0:
            if "not logged in" in message or "run `openart login`" in message:
                raise NotLoggedIn(message)
            timed_out = "deadline" in message or "timed out" in message or "timeout" in message
            raise CLIError(message or f"openart exited {completed.returncode}", timed_out=timed_out)
        try:
            return json.loads(completed.stdout)
        except json.JSONDecodeError as exc:
            raise CLIError(f"`openart {' '.join(args)}` printed no JSON: {completed.stdout[:500]!r}") from exc

    def version(self) -> str:
        completed = subprocess.run(
            [self.binary, "version"], capture_output=True, text=True, timeout=30
        )
        match = re.search(r"openart (\S+)", completed.stdout)
        return match.group(1) if match else "unknown"

    def account(self) -> Any:
        return self.run_json("account")

    def form(self, model: str, mode: str) -> Any:
        return self.run_json("model", "form", model, mode)

    def cost(self, model: str, mode: str) -> Any:
        return self.run_json("model", "cost", "--model", model, "--mode", mode)

    def upload(self, path: str) -> dict[str, str]:
        """Upload one reference; return the {id, url} a visualReference carries."""
        uploaded = self.run_json("upload", "add", path, timeout=300)
        urls = [url for url in all_urls(uploaded) if url.startswith(CDN_PREFIX)]
        asset_id = find_key(uploaded, ("id", "uploadId"))
        if not urls or not asset_id:
            raise CLIError(f"upload of {path} returned no id and {CDN_PREFIX} URL: {json.dumps(uploaded)[:500]}")
        return {"id": str(asset_id), "url": urls[0]}

    def wait(self, history_id: str, timeout_seconds: float) -> Any:
        return self.run_json(
            "creation", "wait", history_id, "--timeout", f"{int(timeout_seconds)}s",
            timeout=timeout_seconds + 60,
        )


def access_token(path: Path = CREDENTIALS_PATH, origin: str = ORIGIN) -> str:
    try:
        stored = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise NotLoggedIn("no OpenArt credential; run `openart login`") from exc
    token = stored.get("accessToken") or stored.get("access_token")
    if not token:
        raise NotLoggedIn(f"{path} holds no access token; run `openart login`")
    stored_origin = stored.get("origin")
    if stored_origin and stored_origin.rstrip("/") != origin.rstrip("/"):
        raise NotLoggedIn(f"logged in to {stored_origin}, not {origin}; run `openart login`")
    return token


class OpenArtAPI:
    def __init__(self, token: str, cli_version: str, api_base: str = API_BASE) -> None:
        self.token = token
        self.cli_version = cli_version
        self.api_base = api_base.rstrip("/")

    def generate(self, body: dict[str, Any], timeout_seconds: float = 120.0) -> Any:
        request = urllib.request.Request(
            f"{self.api_base}{GENERATE_PATH}",
            data=json.dumps(body).encode("utf-8"),
            method="POST",
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "calliopa-seedream/1.0",
                "x-openart-cli-version": self.cli_version,
                "x-openart-cli-os": platform.system().lower(),
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
                raw = response.read()
        except urllib.error.HTTPError as exc:
            raw_error = exc.read().decode("utf-8", "replace")[:8000]
            parsed: Any = {}
            try:
                parsed = json.loads(raw_error)
            except json.JSONDecodeError:
                pass
            message = find_key(parsed, ("errorMessage", "message", "error_description", "error"))
            code = find_key(parsed, ("errorKey", "code"))
            retry_after = exc.headers.get("Retry-After") if exc.headers else None
            raise TransportError(
                str(message or raw_error[:500] or f"OpenArt returned HTTP {exc.code}"),
                status=exc.code,
                code=str(code) if code else None,
                request_id=exc.headers.get("x-request-id") if exc.headers else None,
                retry_after_seconds=float(retry_after) if retry_after and retry_after.isdigit() else None,
            ) from exc
        except (urllib.error.URLError, TimeoutError, socket.timeout) as exc:
            reason = getattr(exc, "reason", exc)
            raise TransportError(f"OpenArt connection failed: {reason}") from exc
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise TransportError(f"OpenArt returned no JSON: {raw[:300]!r}", status=200) from exc


def download(url: str, timeout_seconds: float = 120.0) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "calliopa-seedream/1.0"})
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        return response.read()


def preset_of(request: Any) -> FormatPreset:
    """The shape asked for, or none at all. BO_0279_003"""
    chosen = getattr(request, "format", None)
    return FORMATS[chosen] if chosen else NATIVE


def save_image(image_bytes: bytes, output: Path, preset: FormatPreset) -> dict[str, Any]:
    try:
        from PIL import Image
    except ImportError as exc:
        raise InvalidRequest("Pillow is required; install requirements.txt") from exc

    output = output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(io.BytesIO(image_bytes)) as image:
        image.load()
        native = image.size
        delivered = image
        if preset.width and preset.height:
            target = preset.width / preset.height
            width, height = image.size
            if width / height > target:
                crop = round(height * target)
                left = (width - crop) // 2
                box = (left, 0, left + crop, height)
            else:
                crop = round(width / target)
                top = (height - crop) // 2
                box = (0, top, width, top + crop)
            delivered = image.crop(box).resize((preset.width, preset.height), Image.LANCZOS)
        save_format = OUTPUT_FORMATS[output.suffix.lower()]
        if save_format == "JPEG" and delivered.mode not in {"RGB", "L"}:
            delivered = delivered.convert("RGB")
        fd, temporary = tempfile.mkstemp(prefix=f".{output.name}.", dir=output.parent)
        os.close(fd)
        try:
            delivered.save(temporary, format=save_format)
            os.chmod(temporary, 0o644)
            os.replace(temporary, output)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
        return {
            "path": str(output),
            "width": delivered.width,
            "height": delivered.height,
            "native_width": native[0],
            "native_height": native[1],
            "upscaled": bool(preset.width and preset.width > native[0]),
            "preset": preset.name,
        }


# --- The run --------------------------------------------------------------------


def _failure(kind: str, message: str, reason: str, **fields: Any) -> GenerationResult:
    allowed = fields.pop("retry_allowed", False)
    after = fields.pop("after_seconds", None)
    status = fields.pop("status", None)
    code = fields.pop("code", None)
    request_id = fields.pop("request_id", None)
    return GenerationResult(
        ok=False,
        error=APIErrorInfo(kind=kind, message=message, status=status, code=code, request_id=request_id),
        retry=RetryInstruction(allowed, after, reason),
        **fields,
    )


def classify_submit_error(error: TransportError) -> tuple[bool, str, str]:
    """Return retryable, kind, reason for a failed submission. Nothing is retried automatically."""
    if error.status is None:
        return (
            False,
            "ambiguous_submission",
            "the request may have been accepted and charged; check `openart creation list --limit 3` before sending again",
        )
    if error.status in {401, 403}:
        return False, "auth_failed", "run `openart login`, then send again"
    if error.status == 402:
        return False, "insufficient_credits", "top up OpenArt credits before sending again"
    if error.status in {408, 429} or error.status >= 500:
        kind = "rate_limited" if error.status == 429 else "upstream_error"
        return True, kind, f"HTTP {error.status} may be transient; the script never resends a paid call on its own"
    return False, error.code or "rejected", f"HTTP {error.status} is not retryable unchanged"


class SeedreamRun:
    def __init__(self, cli: OpenArtCLI, api_factory: Any = None) -> None:
        self.cli = cli
        # Built lazily: the token is read after `openart account` has refreshed it.
        self.api_factory = api_factory or (lambda: OpenArtAPI(access_token(), cli.version()))

    def _credits(self, notes: list[str]) -> Any:
        try:
            return credit_balance(self.cli.account())
        except (CLIError, InvalidRequest) as exc:
            notes.append(f"credit balance unavailable: {exc}")
            return None

    def _summary(self, request: ImageRequest, params: dict[str, Any]) -> dict[str, Any]:
        return {
            "model": request.model,
            "mode": request.mode,
            "preset": request.format,
            "reference_aliases": [f"@{reference.alias}" for reference in request.references],
            "params": params,
        }

    def dry_run(self, request: ImageRequest) -> GenerationResult:
        request.validate()
        notes: list[str] = []
        properties: dict[str, Any] | None = None
        quote = None
        try:
            properties = form_properties(self.cli.form(request.model, request.mode))
            quote = self.cli.cost(request.model, request.mode)
        except NotLoggedIn:
            notes.append("not logged in: params are not checked against the model form and no cost is quoted")
        placeholders = {
            reference.alias: {"url": reference.source if reference.is_url else f"(uploaded from {reference.source})"}
            for reference in request.references
        }
        params = build_params(request, properties, placeholders)
        result = GenerationResult(
            ok=True,
            retry=RetryInstruction(False, None, "dry run: nothing was uploaded or sent"),
            request={
                **self._summary(request, params),
                "endpoint": f"POST {API_BASE}{GENERATE_PATH}",
                "quote": quote,
            },
            notes=notes,
        )
        return result

    def generate(self, request: ImageRequest) -> GenerationResult:
        request.validate()
        notes: list[str] = []
        account = self.cli.account()  # confirms the login and refreshes the stored token
        before = credit_balance(account)
        properties = form_properties(self.cli.form(request.model, request.mode))
        # Checked with placeholders first, so a bad param fails before any upload.
        build_params(request, properties, {r.alias: {"url": r.source} for r in request.references})

        # A CDN URL goes as-is, like the CLI sends it; an upload also carries its asset id.
        assets = {
            reference.alias: {"url": reference.source} if reference.is_url else self.cli.upload(reference.source)
            for reference in request.references
        }
        params = build_params(request, properties, assets)
        body = {"model": request.model, "media": "image", "mode": request.mode, "params": params}
        summary = self._summary(request, params)

        try:
            response = self.api_factory().generate(body)
        except TransportError as exc:
            retryable, kind, reason = classify_submit_error(exc)
            after = self._credits(notes)
            return _failure(
                kind, str(exc), reason,
                retry_allowed=retryable,
                after_seconds=exc.retry_after_seconds if retryable else None,
                status=exc.status, code=exc.code, request_id=exc.request_id,
                submitted=True,
                credits={"before": before, "after": after, "spent": _spent(before, after)},
                request=summary, notes=notes,
            )

        history_id = find_key(response, ("historyId", "id"))
        if not history_id:
            after = self._credits(notes)
            return _failure(
                "unreadable_response",
                f"OpenArt accepted the request but returned no generation id: {json.dumps(response)[:500]}",
                "check `openart creation list --limit 3` before sending again",
                submitted=True,
                credits={"before": before, "after": after, "spent": _spent(before, after)},
                request=summary, notes=notes,
            )
        return self._collect(request, str(history_id), before, summary, notes)

    def resume(self, request: ImageRequest, history_id: str) -> GenerationResult:
        if request.format is not None and request.format not in FORMATS:
            raise InvalidRequest(f"unknown format {request.format!r}")
        return self._collect(request, history_id, None, None, [])

    def _collect(
        self,
        request: ImageRequest,
        history_id: str,
        before: Any,
        summary: dict[str, Any] | None,
        notes: list[str],
    ) -> GenerationResult:
        resume = f"--resume {history_id} --format {request.format} --output {request.output}"
        common = {"submitted": True, "history_id": history_id, "request": summary, "notes": notes}
        try:
            finished = self.cli.wait(history_id, request.timeout_seconds)
        except CLIError as exc:
            after = self._credits(notes)
            credits = {"before": before, "after": after, "spent": _spent(before, after)}
            if exc.timed_out:
                return _failure(
                    "still_running", str(exc),
                    "the generation is paid for and still running; collect it with --resume, never resend",
                    resume=resume, credits=credits, **common,
                )
            return _failure(
                "generation_failed", str(exc), "read the reason before changing the prompt",
                credits=credits, **common,
            )

        status = str(find_key(finished, ("status",)) or "").lower()
        after = self._credits(notes)
        credits = {"before": before, "after": after, "spent": _spent(before, after)}
        if status in FAILED_STATUSES:
            reason = find_key(finished, ("errorReason", "failed_reason", "errorMessage", "message"))
            return _failure(
                "generation_failed", str(reason or f"status {status}"),
                "read the reason before changing the prompt", credits=credits, **common,
            )
        images = result_urls(finished)
        if not images:
            return _failure(
                "no_result", f"generation {history_id} finished with no image URL: {json.dumps(finished)[:500]}",
                "collect it with --resume once `openart creation get` shows a URL",
                resume=resume, credits=credits, **common,
            )
        if len(images) > 1:
            notes.append(f"{len(images)} images came back; saved the first, all are listed in image.urls")
        try:
            image = save_image(download(images[0]), request.output, preset_of(request))
        except (urllib.error.URLError, TimeoutError, socket.timeout, OSError) as exc:
            return _failure(
                "download_failed", str(exc), "the image is paid for; collect it with --resume",
                resume=resume, credits=credits, **common,
            )
        image["source_url"] = images[0]
        if len(images) > 1:
            image["urls"] = images
        return GenerationResult(
            ok=True,
            retry=RetryInstruction(False, None, "request completed"),
            image=image,
            credits=credits,
            **common,
        )


def _spent(before: Any, after: Any) -> Any:
    if isinstance(before, (int, float)) and isinstance(after, (int, float)):
        return round(before - after, 3)
    return None


def find_cli(explicit: str | None) -> str:
    for candidate in (explicit, os.environ.get("OPENART_BIN"), shutil.which("openart"),
                      str(Path.home() / ".local" / "bin" / "openart")):
        if candidate and Path(candidate).is_file() and os.access(candidate, os.X_OK):
            return candidate
    raise InvalidRequest(
        "openart CLI not found; install it (see scripts/openart-seedream/README.md) or pass --openart-bin"
    )


def request_from_dict(data: dict[str, Any]) -> ImageRequest:
    references: list[ReferenceImage] = []
    for item in data.get("references", []):
        if isinstance(item, str):
            references.append(ReferenceImage.parse(item))
        elif isinstance(item, dict) and "alias" in item and "path" in item:
            references.append(ReferenceImage.parse(f"{item['alias']}={item['path']}"))
        else:
            raise InvalidRequest("each reference must be @alias=path or {alias, path}")
    if "prompt" not in data:
        raise InvalidRequest("request JSON requires prompt")
    params = data.get("params", {})
    if not isinstance(params, dict):
        raise InvalidRequest("params must be an object")
    return ImageRequest(
        prompt=str(data["prompt"]),
        output=Path(data.get("output", "generated.png")),
        format=str(data.get("format", "landscape-1080p")),
        references=tuple(references),
        model=str(data.get("model", MODEL)),
        params=tuple((str(k), str(v)) for k, v in params.items()),
        timeout_seconds=float(data.get("timeout_seconds", 600.0)),
    )


def parse_param(value: str) -> tuple[str, str]:
    key, separator, raw = value.partition("=")
    if not separator or not key.strip():
        raise InvalidRequest(f"invalid --param {value!r}; expected key=value")
    return key.strip(), raw.strip()


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate Seedream 5.0 Pro images on OpenArt; emits one JSON object."
    )
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--prompt")
    source.add_argument("--prompt-file", type=Path)
    source.add_argument("--request-json", metavar="PATH|-", help="load the complete request from JSON; - for stdin")
    source.add_argument("--resume", metavar="HISTORY_ID", help="collect a generation already paid for; sends nothing")
    parser.add_argument("--reference", action="append", default=[], metavar="@ALIAS=PATH")
    parser.add_argument("--output", type=Path, default=Path("generated.png"))
    parser.add_argument("--format", choices=sorted(FORMATS),
                        help="a shape and a delivery size; the vendor's own when not given")
    parser.add_argument("--model", default=MODEL)
    parser.add_argument("--param", action="append", default=[], metavar="KEY=VALUE",
                        help="any other parameter the model form accepts (see `openart model form`)")
    parser.add_argument("--timeout-seconds", type=float, default=600.0, help="how long to wait for the result")
    parser.add_argument("--dry-run", action="store_true", help="validate and print the request; upload and send nothing")
    parser.add_argument("--openart-bin", help="path to the openart CLI")
    return parser


def _load_cli_request(args: argparse.Namespace) -> ImageRequest:
    if args.request_json:
        raw = sys.stdin.read() if args.request_json == "-" else Path(args.request_json).read_text(encoding="utf-8")
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise InvalidRequest("request JSON must be an object")
        return request_from_dict(data)
    prompt = args.prompt
    if args.prompt_file:
        prompt = args.prompt_file.read_text(encoding="utf-8")
    return ImageRequest(
        prompt=prompt or "",
        output=args.output,
        format=args.format,
        references=tuple(ReferenceImage.parse(item) for item in args.reference),
        model=args.model,
        params=tuple(parse_param(item) for item in args.param),
        timeout_seconds=args.timeout_seconds,
    )


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if not (args.prompt or args.prompt_file or args.request_json or args.resume):
            raise InvalidRequest("one of --prompt, --prompt-file, --request-json or --resume is required")
        run = SeedreamRun(OpenArtCLI(find_cli(args.openart_bin)))
        if args.resume:
            request = ImageRequest(prompt="", output=args.output, format=args.format,
                                   timeout_seconds=args.timeout_seconds)
            result = run.resume(request, args.resume)
        else:
            request = _load_cli_request(args)
            result = run.dry_run(request) if args.dry_run else run.generate(request)
    except NotLoggedIn as exc:
        result = _failure("not_logged_in", str(exc), "run `openart login` (in Claude Code: `! openart login`)")
    except (InvalidRequest, OSError, json.JSONDecodeError) as exc:
        result = _failure("invalid_request", str(exc), "fix the request before trying again")
    except CLIError as exc:
        # Before submission: an upload, the form or the account failed. Nothing was charged.
        result = _failure("cli_error", str(exc), "nothing was sent; fix the cause and run again")
    print(json.dumps(result.to_dict(), ensure_ascii=False, sort_keys=True))
    if result.ok:
        return 0
    if result.retry.allowed or (result.error and result.error.kind == "still_running"):
        return EXIT_TEMPORARY
    if result.error and result.error.kind in {"invalid_request", "not_logged_in", "cli_error"}:
        return EXIT_INVALID
    return EXIT_PERMANENT


if __name__ == "__main__":
    raise SystemExit(main())
