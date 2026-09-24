"""The caps: what bounds a runtime, an execution and a copy.

Every value has a default and an override in the environment, and an unset or
empty variable keeps the default — the capture service found on its first
standalone run that an unset variable read as `undefined` overrode every
default. `docs/system/code-service.md`, Fixed Constraints. BO_0289_001
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, Mapping, TypeVar

_UNITS = {"": 1, "b": 1, "k": 1024, "m": 1024**2, "g": 1024**3}
_T = TypeVar("_T")


def parse_bytes(text: str) -> int:
    """`512m`, `2g`, `8388608`, case-free, an optional `i`/`b` suffix tolerated."""
    match = re.fullmatch(r"\s*(\d+)\s*([kmg]?)(?:i?b)?\s*", text.lower())
    if not match:
        raise ValueError(f"not a size: {text!r}")
    return int(match.group(1)) * _UNITS[match.group(2)]


@dataclass(frozen=True)
class Caps:
    memory_bytes: int = 2 * 1024**3
    cpus: float = 2.0
    output_max_bytes: int = 8 * 1024**2
    copy_max_bytes: int = 256 * 1024**2
    max_runtimes: int = 8
    execution_timeout_s: float = 600.0
    session_ready_s: float = 120.0

    @classmethod
    def from_env(cls, env: Mapping[str, str]) -> "Caps":
        default = cls()

        def pick(name: str, parse: Callable[[str], _T], fallback: _T) -> _T:
            raw = env.get(name)
            if raw is None or raw.strip() == "":
                return fallback
            return parse(raw)

        return cls(
            memory_bytes=pick("CALLIOPA_CODE_MEMORY", parse_bytes, default.memory_bytes),
            cpus=pick("CALLIOPA_CODE_CPUS", float, default.cpus),
            output_max_bytes=pick("CALLIOPA_CODE_OUTPUT_MAX_BYTES", parse_bytes, default.output_max_bytes),
            copy_max_bytes=pick("CALLIOPA_CODE_COPY_MAX_BYTES", parse_bytes, default.copy_max_bytes),
            max_runtimes=pick("CALLIOPA_CODE_MAX_RUNTIMES", int, default.max_runtimes),
            execution_timeout_s=pick("CALLIOPA_CODE_EXECUTION_TIMEOUT_S", float, default.execution_timeout_s),
            session_ready_s=pick("CALLIOPA_CODE_SESSION_READY_S", float, default.session_ready_s),
        )
