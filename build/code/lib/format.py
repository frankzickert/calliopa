"""Formatting, forwarded.

The code service does not parse a person's source: it holds the docker socket
and is root on the host, so the parsing happens in the formatter's container
and this module is only the way there. Every failure of that hop — no address
configured, unreachable, a refusal, a timeout, an answer that is not what was
promised — is answered as *unchanged*, with the source exactly as it came, so
a settled edit is never lost to a service being down.
`docs/system/code-service.md`, Formatting. BO_0296_003
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass


@dataclass(frozen=True)
class Formatting:
    """Where the formatter is, and how long the code service waits for it."""

    url: str = ""
    bearer: str = ""
    #: Slightly above the formatter's own time cap, so its answer arrives
    #: rather than this timeout pre-empting it.
    timeout_s: float = 8.0

    @property
    def configured(self) -> bool:
        return bool(self.url and self.bearer)


def format_source(where: Formatting, source: str, language: str | None) -> dict[str, object]:
    """Answer `{source, formatted}` — always, whatever happened."""
    unchanged: dict[str, object] = {"source": source, "formatted": False}
    if not where.configured:
        return {**unchanged, "reason": "no formatter is configured"}

    body = json.dumps({"source": source, "language": language}).encode("utf-8")
    request = urllib.request.Request(
        where.url.rstrip("/") + "/v1/format",
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {where.bearer}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=where.timeout_s) as answer:
            payload = json.loads(answer.read() or b"{}")
    except (urllib.error.URLError, OSError, TimeoutError) as unreachable:
        return {**unchanged, "reason": f"the formatter could not be reached: {unreachable}"}
    except json.JSONDecodeError:
        return {**unchanged, "reason": "the formatter answered something that is not JSON"}

    if not isinstance(payload, dict):
        return {**unchanged, "reason": "the formatter answered something that is not an object"}
    formatted = payload.get("formatted")
    written = payload.get("source")
    if formatted is not True or not isinstance(written, str):
        # Either it said so itself, or it said something we will not act on.
        reason = payload.get("reason")
        return {**unchanged, "reason": reason if isinstance(reason, str) else "the formatter rewrote nothing"}
    return {"source": written, "formatted": True}
