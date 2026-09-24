#!/usr/bin/env python3
"""Higgsfield image client: GPT Image 2 / 2.5 and Seedream 5.0 Pro through the `higgsfield` CLI.

One call, one image, one JSON object on stdout. Written 2026-09-17 for this repo; the
blueprint made its `gpt_image_2` plates by hand in the Higgsfield web app, and this is that
route made repeatable: byte-identical prompts and attachments every time.

**Every submission bills and needs the user's approval first** (AGENTS.md § Generation gate).
So this tool never submits twice on its own: no automatic retry of a submission, ever. A
failure after the job exists is reported with its job id, and `--job-id` collects it without
paying again. `--dry-run` spends nothing and quotes the cost.

Shared contract with the other tools in scripts/: `--reference @alias=PATH` attachments that
the prompt refers to by `@alias`, exit 0 ok / 2 bad request / 75 retry later / 1 permanent,
and a `retry` block in every result. The transport and its error vocabulary are
scripts/higgsfield-seedance's, imported rather than copied.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import sys
import time
import urllib.parse
from pathlib import Path
from typing import Any, Callable

SCRIPT_DIR = Path(__file__).resolve().parent
HIGGSFIELD_PATH = SCRIPT_DIR.parent / "higgsfield-seedance" / "seedance.py"
EXECUTABLE = "higgsfield"


def _load_higgsfield() -> Any:
    spec = importlib.util.spec_from_file_location("_filmset_higgsfield_seedance", HIGGSFIELD_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load the Higgsfield transport from {HIGGSFIELD_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


hf = _load_higgsfield()
base = hf.base

# Accepted params, verified against `higgsfield model get <job_type>` on 2026-09-17
# (gpt_image_2_5 on 2026-09-18). The first variant is the one sent when --variant is left out.
MODELS: dict[str, dict[str, Any]] = {
    "gpt_image_2": {
        "aspect_ratios": ("auto", "1:1", "4:3", "3:4", "16:9", "21:9", "9:16", "3:2", "2:3", "4:5", "5:4"),
        "resolutions": ("1k", "2k", "4k"),
        "qualities": ("low", "medium", "high"),
        "variants": (),
        "max_references": 10,
    },
    "gpt_image_2_5": {
        "aspect_ratios": ("auto", "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9",
                          "27:16", "16:27", "9:8", "8:9", "4:5", "5:4"),
        "resolutions": ("1k", "2k", "4k"),
        "qualities": ("low", "medium", "high", "xhigh", "max"),
        "variants": ("flare", "sunburst"),
        "max_references": 10,    # not stated by `model get`; gpt_image_2's limit, unverified
    },
    "seedream_v5_pro": {
        "aspect_ratios": ("1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"),
        "resolutions": ("1k", "1.5k", "2k"),
        "qualities": (),
        "variants": (),
        "max_references": 10,
    },
}
DEFAULT_MODEL = "gpt_image_2"
# No default aspect, resolution or quality. These were `world/WORLD.md`'s delivery format — a film
# project's portrait 9:16 at 2k — and they decided what every unchosen request got, which is why a
# picture arrived portrait when nobody asked for one. An axis nobody chose is absent from the
# vendor call, and the vendor applies its own default, which it states in `model get`.
# BO_0279_003, user decision 2026-09-22.

IMAGE_SUFFIXES = (".png", ".jpg", ".jpeg", ".webp")
VERSIONED = re.compile(r"_v\d{2,}$")
MAGIC = ((b"\x89PNG\r\n\x1a\n", ".png"), (b"\xff\xd8\xff", ".jpg"), (b"RIFF", ".webp"))


# --------------------------------------------------------------------------- #
# the request
# --------------------------------------------------------------------------- #

def validate(args: argparse.Namespace, prompt: str, references: list[Any]) -> None:
    model = MODELS.get(args.model)
    if model is None:
        raise base.InvalidRequest(f"unknown model {args.model!r}; choose one of {sorted(MODELS)}")
    # An axis nobody chose is not checked and not sent: the vendor applies its own default.
    # Only a value that was given has to be one the model takes. BO_0279_003
    if args.aspect_ratio and args.aspect_ratio not in model["aspect_ratios"]:
        raise base.InvalidRequest(f"{args.model} takes aspect_ratio {list(model['aspect_ratios'])}")
    if args.resolution and args.resolution not in model["resolutions"]:
        raise base.InvalidRequest(f"{args.model} takes resolution {list(model['resolutions'])}")
    if args.quality and not model["qualities"]:
        raise base.InvalidRequest(f"{args.model} has no quality parameter")
    if args.quality and args.quality not in model["qualities"]:
        raise base.InvalidRequest(f"{args.model} takes quality {list(model['qualities'])}")
    if args.variant and not model["variants"]:
        raise base.InvalidRequest(f"{args.model} has no variant parameter")
    if args.variant and args.variant not in model["variants"]:
        raise base.InvalidRequest(f"{args.model} takes variant {list(model['variants'])}")
    if not prompt.strip():
        raise base.InvalidRequest("the prompt is empty")
    if len(references) > model["max_references"]:
        raise base.InvalidRequest(f"at most {model['max_references']} references on {args.model}")
    aliases = [item.alias for item in references]
    if len(aliases) != len(set(aliases)):
        raise base.InvalidRequest("reference aliases must be unique")
    for item in references:
        if item.media_type != "image" or Path(item.source).suffix.lower() not in IMAGE_SUFFIXES:
            raise base.InvalidRequest(f"@{item.alias} is not a png, jpg or webp image")
        if not Path(item.source).is_file():
            raise base.InvalidRequest(f"reference does not exist: {item.source}")
    named = set(base.ALIAS_PATTERN.findall(prompt))
    missing = sorted(named - set(aliases))
    if missing:
        raise base.InvalidRequest("the prompt names @" + ", @".join(missing) + " with no --reference")
    unused = [alias for alias in aliases if alias not in named]
    if unused:
        raise base.InvalidRequest(
            "attached but never named in the prompt: @" + ", @".join(unused)
            + ". Say what the model should take from each attachment (AGENTS.md)")


def check_output(output: Path) -> None:
    """A result is a paid artifact: it goes to a new versioned path, never over a file."""
    if output.suffix.lower() not in IMAGE_SUFFIXES:
        raise base.InvalidRequest(f"--output must end in one of {IMAGE_SUFFIXES}")
    if not VERSIONED.search(output.stem):
        raise base.InvalidRequest("--output must be versioned, e.g. panel_v01.png")
    siblings = list(output.parent.glob(output.stem + ".*")) if output.parent.is_dir() else []
    if siblings:
        raise base.InvalidRequest(
            f"{output.stem} already exists ({siblings[0].name}); bump the version, never overwrite")


def expanded_prompt(prompt: str, references: list[Any]) -> str:
    """Name every attachment by alias, position and file, then the author's prompt untouched."""
    if not references:
        return prompt.strip()
    lines = [f"- @{item.alias} = attached image {n} ({Path(item.source).name})"
             for n, item in enumerate(references, 1)]
    return "The attached images, in the order they are attached:\n" + "\n".join(lines) \
        + "\n\n" + prompt.strip()


def build_argv(args: argparse.Namespace, prompt: str, references: list[Any],
               verb: str = "create") -> list[str]:
    argv = [args.higgsfield_bin, "generate", verb, args.model, "--json",
            "--prompt", expanded_prompt(prompt, references)]
    # Absent means absent: the vendor decides what it was not told. BO_0279_003
    if args.aspect_ratio:
        argv += ["--aspect_ratio", args.aspect_ratio]
    if args.resolution:
        argv += ["--resolution", args.resolution]
    if args.quality:
        argv += ["--quality", args.quality]
    if args.variant:
        argv += ["--variant", args.variant]
    for item in references:
        argv += ["--image-references", item.source]
    return argv


# --------------------------------------------------------------------------- #
# the result
# --------------------------------------------------------------------------- #

def image_urls_of(job: Any) -> list[str]:
    """The generated image's URL(s), best first.

    Verified on real jobs 2026-09-17 (`higgsfield generate get <id> --json`): the output is the
    top-level `result_url`, with a `min_result_url` webp preview beside it. The INPUT images sit
    under `params.medias[].data.url`, with the same host and the same suffixes, so a URL search
    that walks the whole job picks an attached plate. Nothing under `params` is ever a result.
    """
    urls: list[str] = []
    if isinstance(job, dict):
        for key in ("result_url", "raw_url", "url"):
            value = job.get(key)
            if isinstance(value, str) and value.startswith(("http://", "https://")):
                urls.append(value)
    found = []
    for path, value in hf._walk_strings(job):
        if path and path[0] in ("params", "input", "inputs"):
            continue
        if not value.startswith(("http://", "https://")):
            continue
        if Path(urllib.parse.urlparse(value).path).suffix.lower() not in IMAGE_SUFFIXES:
            continue
        key = path[-1].lower() if path else ""
        score = 0
        if any(hint in key for hint in ("raw", "result", "output", "image")):
            score -= 2
        if any(hint in key for hint in ("min", "preview", "thumb", "watermark")):
            score += 3
        found.append((score, len(path), value))
    for _, _, url in sorted(found):
        if url not in urls:
            urls.append(url)
    return urls


def real_suffix(content: bytes, fallback: str) -> str:
    for magic, suffix in MAGIC:
        if content.startswith(magic):
            return suffix
    return fallback


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def result(ok: bool, *, retry: tuple[bool, str] = (False, ""), **fields: Any) -> dict[str, Any]:
    out = {"ok": ok, "retry": {"allowed": retry[0], "after_seconds": None, "reason": retry[1]}}
    out.update({k: v for k, v in fields.items() if v is not None})
    return out


def failure(error: Exception, stage: str, **fields: Any) -> tuple[dict[str, Any], int]:
    if isinstance(error, base.TransportError):
        retryable, kind, reason = hf.classify(error)
        if stage != "submission" and fields.get("job", {}).get("id"):
            # The job exists and is paid for. Collecting it again is free, whatever went wrong.
            retryable = kind not in {"unauthenticated", "job_not_found", "cli_missing"}
            reason = f"{reason}; collect with --job-id {fields['job']['id']} (free)"
        payload = result(False, retry=(retryable, reason),
                         error={"kind": kind, "message": str(error), "stage": stage}, **fields)
        if kind == "invalid_request":
            return payload, base.EXIT_INVALID
        return payload, base.EXIT_TEMPORARY if retryable else base.EXIT_PERMANENT
    payload = result(False, retry=(False, "the request must change"),
                     error={"kind": "invalid_request", "message": str(error), "stage": stage}, **fields)
    return payload, base.EXIT_INVALID


# --------------------------------------------------------------------------- #
# running it
# --------------------------------------------------------------------------- #

class Runner:
    def __init__(self, args: argparse.Namespace, transport: Any = None,
                 sleeper: Callable[[float], None] = time.sleep,
                 clock: Callable[[], float] = time.monotonic) -> None:
        self.args = args
        self.t = transport or hf.HiggsfieldTransport(args.higgsfield_bin)
        self.sleep = sleeper
        self.clock = clock

    def call(self, argv: list[str], stage: str) -> Any:
        return self.t._invoke(argv, self.args.timeout_seconds, stage)

    def quote(self, prompt: str, references: list[Any]) -> tuple[Any, str | None]:
        """`higgsfield generate cost` is free. A quote that fails does not fail the dry run."""
        try:
            return self.call(build_argv(self.args, prompt, references, verb="cost"), "cost"), None
        except base.TransportError as exc:
            return None, str(exc)

    def dry_run(self, prompt: str, references: list[Any]) -> tuple[dict[str, Any], int]:
        argv = build_argv(self.args, prompt, references)
        request = self.summary(prompt, references)
        request["argv"] = argv
        if not self.args.no_quote:
            quote, error = self.quote(prompt, references)
            request["cost_quote"] = quote if error is None else {"unavailable": error}
        return result(True, retry=(False, "dry run spent nothing"), request=request), 0

    def summary(self, prompt: str, references: list[Any]) -> dict[str, Any]:
        return {
            "service": "higgsfield-cli",
            "model": self.args.model,
            "aspect_ratio": self.args.aspect_ratio,
            "resolution": self.args.resolution,
            "quality": self.args.quality,
            "variant": self.args.variant,
            "attachments": [{"alias": f"@{item.alias}", "position": n, "file": item.source}
                            for n, item in enumerate(references, 1)],
            "expanded_prompt": expanded_prompt(prompt, references),
            "output": str(self.args.output),
        }

    def submit(self, prompt: str, references: list[Any]) -> tuple[dict[str, Any], int]:
        output = self.args.output
        log = output.with_suffix(".response.json")
        output.parent.mkdir(parents=True, exist_ok=True)
        (output.with_suffix(".prompt.txt")).write_text(expanded_prompt(prompt, references) + "\n",
                                                       encoding="utf-8")
        request = self.summary(prompt, references)
        try:
            response = self.call(build_argv(self.args, prompt, references), "submission")
        except base.TransportError as exc:
            save_json(log, {"request": request, "submission_error": str(exc)})
            return failure(exc, "submission", request=request)
        job_id = hf.job_id_of(response)
        save_json(log, {"request": request, "submission": response})
        if not job_id:
            exc = base.TransportError("the CLI accepted the job but returned no job id", code="api_error")
            return failure(exc, "submission", request=request)
        return self.collect(job_id, request=request, log=log, first=response)

    def collect(self, job_id: str, *, request: dict[str, Any] | None = None,
                log: Path | None = None, first: Any = None) -> tuple[dict[str, Any], int]:
        output = self.args.output
        log = log or output.with_suffix(".response.json")
        record: dict[str, Any] = json.loads(log.read_text(encoding="utf-8")) if log.exists() else {}
        if request:
            record["request"] = request
        record["job_id"] = job_id
        deadline = self.clock() + self.args.max_poll_seconds
        job: Any = None
        while True:
            try:
                response = self.call([self.args.higgsfield_bin, "generate", "get", job_id, "--json"], "poll")
            except base.TransportError as exc:
                save_json(log, record)
                return failure(exc, "poll", job={"id": job_id}, request=request)
            job = response[0] if isinstance(response, list) and response else response
            record["job"] = job
            save_json(log, record)
            status, reported = hf.status_of(job)
            if status != "in_progress":
                break
            if self.clock() >= deadline:
                return result(False, retry=(True, f"still running; collect with --job-id {job_id} (free)"),
                              job={"id": job_id, "status": reported or status},
                              error={"kind": "poll_timeout", "message": "the job did not finish in time"},
                              request=request), base.EXIT_TEMPORARY
            self.sleep(self.args.poll_interval_seconds)
        if status == "failed":
            return result(False, retry=(False, "the job failed server-side; it may be refunded, check the "
                                        "account before sending it again"),
                          job={"id": job_id, "status": reported},
                          error={"kind": "job_failed", "message": reported}, request=request), base.EXIT_PERMANENT
        urls = image_urls_of(job)
        if not urls:
            exc = base.TransportError("the job finished but no image URL was found", code="api_error")
            return failure(exc, "download", job={"id": job_id, "status": reported}, request=request)
        try:
            content = self.t.fetcher(urls[0], self.args.timeout_seconds)
        except base.TransportError as exc:
            return failure(exc, "download", job={"id": job_id, "status": reported}, request=request)
        if not content:
            exc = base.TransportError("the image downloaded as zero bytes", code="api_error")
            return failure(exc, "download", job={"id": job_id, "status": reported}, request=request)
        saved = output.with_suffix(real_suffix(content, output.suffix))
        if saved.exists():
            # A re-collect must not clobber an image already on disk; the job stays collectable.
            saved = saved.with_name(f"{saved.stem}_job-{job_id[:8]}{saved.suffix}")
        saved.parent.mkdir(parents=True, exist_ok=True)
        saved.write_bytes(content)
        record["saved"] = str(saved)
        record["image_urls"] = urls
        save_json(log, record)
        return result(True, job={"id": job_id, "status": reported},
                      image={"path": str(saved), "bytes": len(content), "url": urls[0],
                             "other_urls": urls[1:] or None},
                      response_log=str(log), request=request), 0


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate one image with GPT Image 2 / 2.5 or Seedream 5.0 Pro through the Higgsfield "
                    "CLI; emits one JSON object. Paid: needs the user's approval per call.")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--prompt")
    source.add_argument("--prompt-file", type=Path)
    source.add_argument("--job-id", help="collect a job that is already paid for; sends nothing new")
    parser.add_argument("--prompt-section", help="use the first fenced prompt under this Markdown heading")
    parser.add_argument("--reference", action="append", default=[], metavar="@ALIAS=PATH",
                        help="an image attachment, in order; the prompt must name every @alias")
    parser.add_argument("--model", default=DEFAULT_MODEL, choices=sorted(MODELS))
    parser.add_argument("--aspect-ratio", help="the vendor's own default when not given")
    parser.add_argument("--resolution", help="the vendor's own default when not given")
    parser.add_argument("--quality", default=None,
                        help="gpt_image_2 (low|medium|high) and gpt_image_2_5 (also xhigh|max); "
                             "the vendor's own default when not given; seedream has none")
    parser.add_argument("--variant", default=None,
                        help="gpt_image_2_5 only: flare or sunburst; the vendor's own when not given")
    parser.add_argument("--output", type=Path, required=True, help="versioned path, e.g. panel_v01.png")
    parser.add_argument("--timeout-seconds", type=float, default=180.0, help="per CLI call")
    parser.add_argument("--poll-interval-seconds", type=float, default=5.0)
    parser.add_argument("--max-poll-seconds", type=float, default=900.0)
    parser.add_argument("--higgsfield-bin", default=os.environ.get("HIGGSFIELD_BIN") or EXECUTABLE)
    parser.add_argument("--dry-run", action="store_true",
                        help="print the exact CLI call and a cost quote; submit nothing")
    parser.add_argument("--no-quote", action="store_true", help="with --dry-run: skip the cost quote")
    return parser


def main(argv: list[str] | None = None, transport: Any = None,
         sleeper: Callable[[float], None] = time.sleep) -> int:
    args = _parser().parse_args(argv)
    runner = Runner(args, transport, sleeper)
    try:
        if args.job_id:
            payload, code = runner.collect(args.job_id)
        else:
            if args.prompt_section and not args.prompt_file:
                raise base.InvalidRequest("--prompt-section requires --prompt-file")
            prompt = args.prompt if args.prompt is not None else \
                base.read_prompt_file(args.prompt_file, args.prompt_section)
            references = [base.Reference.parse(value, "image") for value in args.reference]
            validate(args, prompt, references)
            check_output(args.output)
            payload, code = runner.dry_run(prompt, references) if args.dry_run \
                else runner.submit(prompt, references)
    except (base.InvalidRequest, OSError, ValueError) as exc:
        payload, code = failure(exc, "request")
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
