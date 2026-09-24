"""The caps: what bounds one format.

Every value has a default and an override in the environment, and an unset or
empty variable keeps the default — the same rule the code service's caps
follow, and for the same reason. `docs/system/code-service.md`, Formatting.
BO_0296_001
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, Mapping, TypeVar

_UNITS = {"": 1, "b": 1, "k": 1024, "m": 1024**2, "g": 1024**3}
_T = TypeVar("_T")


def parse_bytes(text: str) -> int:
    """`512k`, `1m`, `8388608`, case-free, an optional `i`/`b` suffix tolerated."""
    match = re.fullmatch(r"\s*(\d+)\s*([kmg]?)(?:i?b)?\s*", text.lower())
    if not match:
        raise ValueError(f"not a size: {text!r}")
    return int(match.group(1)) * _UNITS[match.group(2)]


@dataclass(frozen=True)
class Caps:
    #: A code block far above this is not a code block anyone is editing.
    source_max_bytes: int = 1024**2
    #: A settle waits on this, so it is a person's patience, not a build's.
    timeout_s: float = 5.0
    #: How many formats run at once before the rest are answered unchanged.
    concurrency: int = 3
    #: How long a request waits for a slot before it gives up on formatting.
    queue_wait_s: float = 2.0

    @classmethod
    def from_env(cls, env: Mapping[str, str]) -> "Caps":
        default = cls()

        def pick(name: str, parse: Callable[[str], _T], fallback: _T) -> _T:
            raw = env.get(name)
            if raw is None or raw.strip() == "":
                return fallback
            return parse(raw)

        return cls(
            source_max_bytes=pick("CALLIOPA_CODE_FORMAT_SOURCE_MAX_BYTES", parse_bytes, default.source_max_bytes),
            timeout_s=pick("CALLIOPA_CODE_FORMAT_TIMEOUT_S", float, default.timeout_s),
            concurrency=pick("CALLIOPA_CODE_FORMAT_CONCURRENCY", int, default.concurrency),
            queue_wait_s=pick("CALLIOPA_CODE_FORMAT_QUEUE_WAIT_S", float, default.queue_wait_s),
        )
