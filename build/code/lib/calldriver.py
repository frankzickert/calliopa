#!/usr/bin/env python3
"""A call's driver: the service's own image, standing in a call's network namespace.

An instruction tool's call runs in a throwaway container that may have no network
at all, so the service cannot reach its kernel the way it reaches a session's.
This driver is started beside it, sharing its namespace — and so its loopback
and nothing else — speaks the kernel protocol to the kernel there, sends the
code once and prints every output as one JSON line, ending with an `end` line.
It reads everything from its environment and writes nothing but its standard
output. `docs/system/code-service.md`, Instruction Tools. BO_0311_001
"""

from __future__ import annotations

import json
import os
import queue
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from jupyter_client import BlockingKernelClient  # noqa: E402

from lib.sessions import Sessions  # noqa: E402


def emit(event: dict) -> None:
    sys.stdout.write(json.dumps(event) + "\n")
    sys.stdout.flush()


def main() -> int:
    info = json.loads(os.environ["CALLIOPA_CALL_CONNECTION"])
    code = os.environ["CALLIOPA_CALL_CODE"]
    timeout_s = float(os.environ.get("CALLIOPA_CALL_TIMEOUT_S", "600"))
    ready_s = float(os.environ.get("CALLIOPA_CALL_READY_S", "120"))
    output_max = int(os.environ.get("CALLIOPA_CALL_OUTPUT_MAX", str(8 * 1024**2)))
    client = BlockingKernelClient()
    client.load_connection_info(info)
    client.start_channels()
    try:
        client.wait_for_ready(timeout=ready_s)
    except RuntimeError:
        emit({"event": "end", "status": "the kernel did not start", "executionCount": None})
        return 0
    started = time.monotonic()
    message_id = client.execute(code, allow_stdin=False, stop_on_error=True)
    produced = 0
    count = None
    cut = None
    idle = False
    while not idle:
        if time.monotonic() - started > timeout_s:
            cut = "timed out"
            break
        try:
            message = client.get_iopub_msg(timeout=0.5)
        except queue.Empty:
            continue
        if message.get("parent_header", {}).get("msg_id") != message_id:
            continue
        kind, content = message["msg_type"], message["content"]
        if kind == "status":
            idle = content.get("execution_state") == "idle"
            continue
        event = Sessions._event(kind, content)
        if event is None:
            continue
        if kind == "execute_result" and content.get("execution_count") is not None:
            count = content["execution_count"]
        produced += len(json.dumps(event))
        if produced > output_max:
            cut = "output cap"
            emit({"event": "cut", "reason": cut, "bytes": produced})
            break
        emit(event)
    status = cut or "ok"
    if cut is None:
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            try:
                reply = client.get_shell_msg(timeout=0.5)
            except queue.Empty:
                continue
            if reply.get("parent_header", {}).get("msg_id") != message_id:
                continue
            if reply["content"].get("status") in ("error", "abort", "aborted"):
                status = "error"
            if reply["content"].get("execution_count") is not None:
                count = reply["content"]["execution_count"]
            break
    emit({"event": "end", "status": status, "executionCount": count})
    return 0


if __name__ == "__main__":
    sys.exit(main())
