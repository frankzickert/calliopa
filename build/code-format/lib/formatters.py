"""The language table and the one thing this service does.

A language the table does not name is a language that settles unchanged, and
so is a source no formatter will parse. Nothing here ever fails a request:
`format_source` answers the text to write, and whether it rewrote anything.
That is the whole contract, and it is what lets a person type a fragment into
a code block and have it saved exactly as typed, with nothing said.
`docs/system/code-service.md`, Formatting. BO_0296_001
"""

from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass, field

#: Where a formatter runs: an empty directory it does not own, so no config
#: file of ours or anyone's is picked up from a working directory.
WORKDIR = "/work"

PRETTIER_CLI = os.environ.get("PRETTIER_CLI", "/opt/prettier/bin/prettier.cjs")


@dataclass(frozen=True)
class Formatter:
    """One formatter, spoken to over its standard streams."""

    name: str
    argv: tuple[str, ...]
    #: Prettier is given its parser rather than a filename, so nothing is
    #: written to disk and no extension has to be invented for a block.
    parser: str | None = field(default=None)

    def command(self) -> list[str]:
        if self.parser is None:
            return list(self.argv)
        return [*self.argv, "--parser", self.parser]


def _prettier(parser: str) -> Formatter:
    # `--no-config` and `--no-editorconfig` keep a formatter from reading
    # anything off the filesystem: what it does must depend on the source and
    # the parser alone, or two instances of this service disagree.
    return Formatter("prettier", ("node", PRETTIER_CLI, "--no-config", "--no-editorconfig"), parser)


_BLACK = Formatter("black", ("black", "--quiet", "-"))
_GOFMT = Formatter("gofmt", ("gofmt",))
_SHFMT = Formatter("shfmt", ("shfmt", "-"))

#: Every language word this service knows, lower-cased, aliases included.
#: Adding a language is adding a row here and a formatter to the image.
TABLE: dict[str, Formatter] = {
    "javascript": _prettier("babel"), "js": _prettier("babel"),
    "jsx": _prettier("babel"), "mjs": _prettier("babel"), "cjs": _prettier("babel"),
    "typescript": _prettier("typescript"), "ts": _prettier("typescript"),
    "tsx": _prettier("typescript"),
    "css": _prettier("css"), "scss": _prettier("scss"), "less": _prettier("less"),
    "html": _prettier("html"), "vue": _prettier("vue"),
    "json": _prettier("json"), "json5": _prettier("json5"), "jsonc": _prettier("json"),
    "yaml": _prettier("yaml"), "yml": _prettier("yaml"),
    "markdown": _prettier("markdown"), "md": _prettier("markdown"),
    "graphql": _prettier("graphql"), "gql": _prettier("graphql"),
    "python": _BLACK, "py": _BLACK, "python3": _BLACK,
    "go": _GOFMT, "golang": _GOFMT,
    "sh": _SHFMT, "bash": _SHFMT, "shell": _SHFMT, "zsh": _SHFMT,
}


def languages() -> list[str]:
    """The words this service formats, in order, for a caller that asks."""
    return sorted(TABLE)


def formatter_for(language: str | None) -> Formatter | None:
    if not language:
        return None
    return TABLE.get(language.strip().lower())


@dataclass(frozen=True)
class Formatted:
    source: str
    formatted: bool
    #: Why nothing was rewritten, for the service's log. Never for a person:
    #: a settle says nothing when formatting did not happen.
    reason: str = ""


def format_source(source: str, language: str | None, timeout_s: float, source_max_bytes: int) -> Formatted:
    """Answer the text to write. Never raises, never refuses, never reformats
    what it cannot parse."""
    formatter = formatter_for(language)
    if formatter is None:
        return Formatted(source, False, "no formatter for this language")
    if source == "":
        return Formatted(source, False, "empty source")
    encoded = source.encode("utf-8")
    if len(encoded) > source_max_bytes:
        return Formatted(source, False, f"the source is above {source_max_bytes} bytes")

    try:
        done = subprocess.run(
            formatter.command(),
            input=encoded,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout_s,
            cwd=WORKDIR,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return Formatted(source, False, f"{formatter.name} did not finish within {timeout_s}s")
    except OSError as missing:
        return Formatted(source, False, f"{formatter.name} could not be run: {missing}")

    if done.returncode != 0:
        # The ordinary case: a fragment that does not parse. The formatter's
        # complaint is the log's, and the block is saved as it was typed.
        first = done.stderr.decode("utf-8", "replace").strip().splitlines()
        return Formatted(source, False, f"{formatter.name} refused it: {first[0] if first else 'no reason given'}")

    try:
        written = done.stdout.decode("utf-8")
    except UnicodeDecodeError:
        return Formatted(source, False, f"{formatter.name} answered bytes that are not text")
    if written == "" and source != "":
        return Formatted(source, False, f"{formatter.name} answered nothing")
    if written == source:
        return Formatted(source, False, "already formatted")
    return Formatted(written, True)
