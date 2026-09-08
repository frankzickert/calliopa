# Third-party software

Calliopa distributes no third-party software. Everything below is either an image Docker
pulls from its publisher to your machine when the stack starts, or software the build
recipes under `build/` download and install on your machine when the images are built. Each
is licensed to you by its own publisher under its own terms; none of it is part of the
Calliopa Core, and Calliopa's licences grant you nothing in respect of any of it. See
`LICENSE-CORE.md`, Section 7.

Every row names the licence file this table was checked against, at the pinned version
where the publisher tags one. Verified 2026-09-08.

## Images you pull

| Image | Publisher | Pin | Licence | Checked against |
|---|---|---|---|---|
| `dxflrs/garage` | Deuxfleurs | `v1.1.0`, digest in `.env` | AGPL-3.0 | https://git.deuxfleurs.fr/Deuxfleurs/garage/src/tag/v1.1.0/LICENSE |
| `ghcr.io/plastic-labs/honcho` — optional, memory profile only | Plastic Labs | `v3.1.0`, digest in `.env` | AGPL-3.0 | https://github.com/plastic-labs/honcho/blob/v3.1.0/LICENSE |

Garage and Honcho are run as published, unmodified, as separate services; nothing of
Calliopa's links to them. That is the use their licence permits without further obligation.

## Base images the recipes build on

| Image | Publisher | Pin | Licence | Checked against |
|---|---|---|---|---|
| `apache/age` (`build/postgres`) | Apache Software Foundation | `release_PG16_1.6.0`, digest in the recipe | Apache-2.0 (AGE); PostgreSQL Licence (PostgreSQL) | https://github.com/apache/age/blob/master/LICENSE, https://www.postgresql.org/about/licence/ |
| `debian:bookworm-slim` (`build/cell`) | Debian | digest in the recipe | The Debian distribution's many licences, per package | https://www.debian.org/legal/licenses/ |
| `node:22.22.2-bookworm-slim` (`build/kernel`) | Node.js / Docker Official Images | digest in the recipe | MIT (Node.js) with bundled components, on Debian | https://github.com/nodejs/node/blob/v22.22.2/LICENSE |
| `node:22-trixie-slim` (copied into `build/hermes`) | Node.js / Docker Official Images | digest in the recipe | MIT (Node.js) with bundled components, on Debian | https://github.com/nodejs/node/blob/v22.22.2/LICENSE |
| `python:3.13-slim` (`build/hermes`) | Python Software Foundation / Docker Official Images | digest in the recipe | PSF License (Python), on Debian | https://docs.python.org/3.13/license.html |

## Software the recipes install at build time

| Package | Publisher | Pin | Licence | Checked against |
|---|---|---|---|---|
| `pgvector` (`build/postgres`, built from source) | pgvector | `v0.8.2` | PostgreSQL Licence | https://github.com/pgvector/pgvector/blob/v0.8.2/LICENSE |
| `postgresql-client-16` (`build/cell`, from PGDG) | PostgreSQL Global Development Group | Debian bookworm-pgdg | PostgreSQL Licence | https://www.postgresql.org/about/licence/ |
| `rclone` (`build/cell`) | Nick Craig-Wood | Debian bookworm | MIT | https://github.com/rclone/rclone/blob/master/COPYING |
| `curl`, `jq`, `wget`, `ca-certificates`, `ripgrep` | Debian | Debian bookworm / trixie | curl, MIT, GPL-3.0, MPL-2.0, MIT/Unlicense respectively — per Debian's copyright files | https://www.debian.org/legal/licenses/ |
| `pnpm` (`build/kernel`) | pnpm | `11.9.0` | MIT | https://github.com/pnpm/pnpm/blob/v11.9.0/LICENSE |
| `hermes-agent` (`build/hermes`, from PyPI) | Nous Research | `0.19.0` | MIT | https://github.com/NousResearch/hermes-agent/blob/main/LICENSE (the 0.19.0 tag carries no LICENSE file; PyPI states MIT) |
| `aiohttp` (`build/hermes`, from PyPI) | aio-libs | latest at build | Apache-2.0 AND MIT | https://pypi.org/project/aiohttp/ |
| `mcp` (`build/hermes`, from PyPI) | Model Context Protocol, a Series of LF Projects | `>=1.24,<2` at build | MIT | https://pypi.org/project/mcp/ |
| `@anthropic-ai/claude-code` (`build/hermes`, from npm) | Anthropic | latest at build | Proprietary: Anthropic Commercial Terms of Service | https://www.anthropic.com/legal/commercial-terms, via the package's README |
| `@openai/codex` (`build/hermes`, from npm) | OpenAI | latest at build | Apache-2.0 | https://github.com/openai/codex/blob/main/LICENSE |

The two command-line tools are installed by you, on your machine, under your own account
with their publishers. Calliopa neither distributes them nor grants you any right to use
them; whether you are entitled to is between you and their publishers. The Hermes recipe
applies one patch to the pinned Hermes release at build time, on your machine; the patched
copy exists only in the image you built.
