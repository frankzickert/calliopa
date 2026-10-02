#!/usr/bin/env python3
"""Codex image adapter; the authenticated Codex runner stays in Hermes."""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

EXIT_INVALID = 2
EXIT_TEMPORARY = 75
DEFAULT_MODEL = "codex-image"
MODELS = {DEFAULT_MODEL: {}}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--model", default="codex-image")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.dry_run:
        print(json.dumps({"status": "unavailable", "reason": "Codex image generation has no cost quote"}))
        return 0
    url = os.environ.get("CALLIOPA_CODEX_IMAGE_URL", "http://hermes:8644/v1/image").rstrip("/")
    bearer_file = os.environ.get("CALLIOPA_MEDIA_BEARER_FILE", "/run/secrets/calliopa/media_bearer")
    try:
        bearer = Path(bearer_file).read_text().strip()
    except OSError:
        print(json.dumps({"status": "failed", "error": {"message": "Codex image generation is not configured"}}))
        return EXIT_TEMPORARY
    if not bearer:
        print(json.dumps({"status": "failed", "error": {"message": "Codex image generation is not configured"}}))
        return EXIT_TEMPORARY
    request = urllib.request.Request(
        url,
        data=json.dumps({"prompt": args.prompt}).encode(),
        headers={"Authorization": f"Bearer {bearer}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=1600) as response:
            if response.headers.get_content_type() != "image/png":
                raise OSError("Codex image runner returned an unexpected media type")
            image = response.read(32 * 1024 * 1024 + 1)
        if len(image) > 32 * 1024 * 1024 or not image.startswith(b"\x89PNG\r\n\x1a\n"):
            raise OSError("Codex image runner returned invalid image data")
        Path(args.output).write_bytes(image)
        print(json.dumps({"status": "ok", "image": {"mediaType": "image/png", "size": len(image)}}))
        return 0
    except urllib.error.HTTPError as error:
        detail = error.read(2048).decode(errors="replace")
        try:
            message = json.loads(detail).get("error", "Codex image generation failed")
        except (json.JSONDecodeError, AttributeError):
            message = "Codex image generation failed"
        print(json.dumps({"status": "failed", "error": {"message": message}}))
        return EXIT_INVALID if error.code in (400, 401, 403, 422) else EXIT_TEMPORARY
    except (OSError, TimeoutError, urllib.error.URLError):
        print(json.dumps({"status": "retry", "error": {"message": "Codex image generation is unavailable"}}))
        return EXIT_TEMPORARY


if __name__ == "__main__":
    sys.exit(main())
