# Third-party software

Calliopa distributes no third-party software. Everything below is either an image Docker
pulls from its publisher to your machine when the stack starts, software the build
recipes under `build/` download and install on your machine when the images are built, or
a package the interface's own lockfile makes pnpm fetch to your machine when the kernel
builds the interface there. Each
is licensed to you by its own publisher under its own terms; none of it is part of the
Calliopa Core, and Calliopa's licences grant you nothing in respect of any of it. See
`LICENSE-CORE.md`, Section 7.

Every row names the licence file this table was checked against, at the pinned version
where the publisher tags one. Verified 2026-09-08; the interface's own dependency added
and checked 2026-09-23, and the code formatter's four tools added and checked on the built
image the same day; `citeproc` and the Citation Style Language styles and locales added and
checked 2026-09-24.

## Images you pull

| Image | Publisher | Pin | Licence | Checked against |
|---|---|---|---|---|
| `dxflrs/garage` | Deuxfleurs | `v1.1.0`, digest in `.env` | AGPL-3.0 | https://git.deuxfleurs.fr/Deuxfleurs/garage/src/tag/v1.1.0/LICENSE |
| `ghcr.io/plastic-labs/honcho` — optional, memory profile only | Plastic Labs | `v3.1.0`, digest in `.env` | AGPL-3.0 | https://github.com/plastic-labs/honcho/blob/v3.1.0/LICENSE |

Garage and Honcho are run as published, unmodified, as separate services; nothing of
Calliopa's links to them. That is the use their licence permits without further obligation.
SearXNG, below, is run the same way: its published image is the base of the `search` recipe,
unmodified, and the small front Calliopa adds beside it in that image is a separate process
that only forwards HTTP to it. The Zotero translation server, below, is run the same way too:
the `bibliography` recipe fetches it and its four modules from their repositories at pinned
commits and installs its own dependencies, unmodified — its published image is not used, since
it is built for arm64 alone — and the small front Calliopa adds beside it is a separate process
that only forwards HTTP to it and proxies what it fetches.

## Base images the recipes build on

| Image | Publisher | Pin | Licence | Checked against |
|---|---|---|---|---|
| `apache/age` (`build/postgres`) | Apache Software Foundation | `release_PG16_1.6.0`, digest in the recipe | Apache-2.0 (AGE); PostgreSQL Licence (PostgreSQL) | https://github.com/apache/age/blob/master/LICENSE, https://www.postgresql.org/about/licence/ |
| `debian:bookworm-slim` (`build/cell`, `build/typeset`) | Debian | digest in the recipe | The Debian distribution's many licences, per package | https://www.debian.org/legal/licenses/ |
| `node:22.22.2-bookworm-slim` (`build/kernel`, `build/bibliography`) | Node.js / Docker Official Images | digest in the recipe | MIT (Node.js) with bundled components, on Debian | https://github.com/nodejs/node/blob/v22.22.2/LICENSE |
| `node:22-trixie-slim` (copied into `build/hermes`) | Node.js / Docker Official Images | digest in the recipe | MIT (Node.js) with bundled components, on Debian | https://github.com/nodejs/node/blob/v22.22.2/LICENSE |
| `python:3.13-slim` (`build/hermes`, `build/code`) | Python Software Foundation / Docker Official Images | digest in the recipe | PSF License (Python), on Debian | https://docs.python.org/3.13/license.html |
| `node:22-slim` (copied into `build/code-format`) | Node.js / Docker Official Images | digest in the recipe | MIT (Node.js) with bundled components, on Debian | https://github.com/nodejs/node/blob/main/LICENSE |
| `golang:1.25-bookworm` (`gofmt` copied into `build/code-format`) | Google / Docker Official Images | digest in the recipe | BSD-3-Clause (Go), on Debian | https://github.com/golang/go/blob/master/LICENSE |
| `mvdan/shfmt:v3.12.0-alpine` (`shfmt` copied into `build/code-format`) | Daniel Martí | `v3.12.0`, digest in the recipe | BSD-3-Clause | https://github.com/mvdan/sh/blob/master/LICENSE |
| `mcr.microsoft.com/playwright:v1.62.1-noble` (`build/capture`) | Microsoft | `v1.62.1`, digest in the recipe | Apache-2.0 (Playwright) with Chromium (BSD-3-Clause and its bundled components), on Ubuntu | https://github.com/microsoft/playwright/blob/v1.62.1/LICENSE, https://chromium.googlesource.com/chromium/src/+/main/LICENSE |
| `searxng/searxng` (`build/search`) | SearXNG | `2026.9.22-019460e07`, digest in the recipe | AGPL-3.0-or-later (SearXNG), on Alpine | https://github.com/searxng/searxng/blob/master/LICENSE |

## Software the recipes install at build time

| Package | Publisher | Pin | Licence | Checked against |
|---|---|---|---|---|
| `pgvector` (`build/postgres`, built from source) | pgvector | `v0.8.2` | PostgreSQL Licence | https://github.com/pgvector/pgvector/blob/v0.8.2/LICENSE |
| `postgresql-client-16` (`build/cell`, from PGDG) | PostgreSQL Global Development Group | Debian bookworm-pgdg | PostgreSQL Licence | https://www.postgresql.org/about/licence/ |
| `rclone` (`build/cell`) | Nick Craig-Wood | Debian bookworm | MIT | https://github.com/rclone/rclone/blob/master/COPYING |
| `curl`, `jq`, `wget`, `ca-certificates`, `ripgrep`, `git` | Debian | Debian bookworm / trixie | curl, MIT, GPL-3.0, MPL-2.0, MIT/Unlicense, GPL-2.0 respectively — per Debian's copyright files | https://www.debian.org/legal/licenses/ |
| `pnpm` (`build/kernel`) | pnpm | `11.9.0` | MIT | https://github.com/pnpm/pnpm/blob/v11.9.0/LICENSE |
| `hermes-agent` (`build/hermes`, from PyPI) | Nous Research | `0.19.0` | MIT | https://github.com/NousResearch/hermes-agent/blob/main/LICENSE (the 0.19.0 tag carries no LICENSE file; PyPI states MIT) |
| `aiohttp` (`build/hermes`, from PyPI) | aio-libs | latest at build | Apache-2.0 AND MIT | https://pypi.org/project/aiohttp/ |
| `mcp` (`build/hermes`, from PyPI) | Model Context Protocol, a Series of LF Projects | `>=1.24,<2` at build | MIT | https://pypi.org/project/mcp/ |
| `@anthropic-ai/claude-code` (`build/hermes`, from npm) | Anthropic | latest at build | Proprietary: Anthropic Commercial Terms of Service | https://www.anthropic.com/legal/commercial-terms, via the package's README |
| `@openai/codex` (`build/hermes`, from npm) | OpenAI | latest at build | Apache-2.0 | https://github.com/openai/codex/blob/main/LICENSE |
| `playwright` (`build/capture`, from npm) | Microsoft | `1.62.1` | Apache-2.0 | https://github.com/microsoft/playwright/blob/v1.62.1/LICENSE |
| `pandoc` (`build/typeset`, from Debian) | John MacFarlane, packaged by Debian | `2.17.1.1-2~deb12u1` | GPL-2.0-or-later | the package's `/usr/share/doc/pandoc/copyright` |
| `texlive-latex-base`, `texlive-latex-recommended`, `texlive-latex-extra`, `texlive-fonts-recommended`, `texlive-bibtex-extra`, `lmodern` (`build/typeset`, from Debian) | TeX Live, packaged by Debian | TeX Live 2022, `2022.20230122` | LPPL-1.3c for the most part, with the other free licences each package's copyright file names | https://www.debian.org/legal/licenses/, per package |
| `texlive-publishers` (`build/typeset`, from Debian), which carries `IEEEtran.cls` and `IEEEtran.bst` | TeX Live, packaged by Debian; IEEEtran by Michael Shell | `2022.20230122-4` | LPPL-1.3 (IEEEtran), per each file's own header | the headers of `IEEEtran.cls` and `IEEEtran.bst` on the built image |
| `latexmk` (`build/typeset`, from Debian) | John Collins | `1:4.79-1` | GPL-2.0-or-later | the package's copyright file |
| `jupyter_client` (`build/code`, from PyPI) | Project Jupyter | `8.10.0` | BSD-3-Clause | https://github.com/jupyter/jupyter_client/blob/main/LICENSE |
| `docker` (`build/code`, from PyPI; the Docker SDK for Python) | Docker, Inc. | `7.2.0` | Apache-2.0 | https://github.com/docker/docker-py/blob/main/LICENSE |
| `prettier` (`build/code-format`, from npm; lays out the web languages, JSON, YAML, Markdown and GraphQL in a code block) | James Long and contributors | `3.9.9` | MIT | the `LICENSE` file in the installed package on the built image |
| `black` (`build/code-format`, from PyPI; lays out Python in a code block) | Łukasz Langa and contributors | `26.5.1` | MIT | the package metadata on the built image |
| `gofmt` (`build/code-format`, the single binary copied from the Go image; lays out Go in a code block) | Google | Go `1.25` | BSD-3-Clause | https://github.com/golang/go/blob/master/LICENSE |
| `shfmt` (`build/code-format`, the single binary copied from its image; lays out shell in a code block) | Daniel Martí | `v3.12.0` | BSD-3-Clause | https://github.com/mvdan/sh/blob/master/LICENSE |
| `zotero/translation-server` (`build/bibliography`, fetched from its repository at a pinned commit and run unmodified) | Corporation for Digital Scholarship (Zotero) | commit `3a9d1761…` of 2026-07-31, in the recipe | AGPL-3.0-only | https://github.com/zotero/translation-server/blob/master/COPYING, `license` in its package.json |
| `zotero/translators` (`build/bibliography`, the engine's translator corpus, at the commit the engine pins) | Corporation for Digital Scholarship (Zotero) and the translators' authors | commit `424cfbe7…`, in the recipe | AGPL-3.0-or-later per the licence block each translator file carries; the repository's package.json declares CC0-1.0 | https://github.com/zotero/translators |
| `zotero/utilities`, `zotero/translate` (`build/bibliography`, the engine's modules, at the commits the engine pins) | Corporation for Digital Scholarship (Zotero) | commits `1dd38e27…`, `e0fe482b…`, in the recipe | AGPL-3.0 | https://github.com/zotero/utilities/blob/master/COPYING, https://github.com/zotero/translate/blob/master/COPYING |
| `zotero/zotero-schema` (`build/bibliography`, the engine's item schema, a data file, at the commit the engine pins) | Corporation for Digital Scholarship (Zotero) | commit `70c3aa98…`, in the recipe | no licence file in the repository; distributed by Zotero with its clients and servers | https://github.com/zotero/zotero-schema |
| the translation server's npm dependencies (`build/bibliography`, `npm ci` from its own `package-lock.json`) | their respective publishers | the engine's lockfile at the pinned commit | per package; the engine's `package.json` names `koa`, `jsdom`, `request`, `config`, `aws-sdk` and their peers, MIT, BSD and Apache-2.0 among them | the lockfile in the fetched repository |

## Packages the interface fetches when it is built

The interface that runs in your browser is built on your machine, from the sources the
release seeds into your own graph: the kernel runs `pnpm install --frozen-lockfile` against
the interface's lockfile and then builds it. What that install fetches is listed here. It
reaches your machine from the npm registry — the two Citation Style Language packages from
GitHub, as their publisher's repository tarballs — not from Calliopa, and is licensed to you by
its publisher.

| Package | Publisher | Pin | Licence | Checked against |
|---|---|---|---|---|
| `@mathjax/src` (a runtime dependency; sets the mathematics in documents) | The MathJax Consortium | `4.1.3`, exact in the lockfile | Apache-2.0 | https://github.com/mathjax/MathJax-src/blob/master/LICENSE |
| `citeproc` (`citeproc-js`, a runtime dependency; sets citations and reference lists in the chosen style, on the server, unmodified) | Frank Bennett | `2.4.63`, exact in the lockfile | AGPL-3.0-or-later, taken from its dual licence CPAL-1.0 or AGPL-3.0-or-later; the npm registry's metadata reads AGPL-1.0, which its `LICENSE` file does not say | https://github.com/Juris-M/citeproc-js/blob/master/LICENSE |
| `csl-styles` (the Citation Style Language styles, fetched by pnpm as the repository's GitHub tarball; the bibliography uses IEEE, APA and Chicago author-date, unmodified) | The Citation Style Language project and the styles' authors | commit `8947960dc3c5133a873d77342c77c67300a2bc18` of `citation-style-language/styles`, exact in the lockfile | CC-BY-SA-3.0 | https://github.com/citation-style-language/styles/blob/master/README.md |
| `csl-locales` (the Citation Style Language locales, fetched the same way; the bibliography uses `en-US`, unmodified) | The Citation Style Language project | commit `a89adece41013402236e2c9020972d7e931fbab8` of `citation-style-language/locales`, exact in the lockfile | CC-BY-SA-3.0 | https://github.com/citation-style-language/locales/blob/master/README.md |

Every other entry in that lockfile is a build tool — Qwik, Vite, TypeScript, Prettier,
Vitest — which runs on your machine while the interface is built and is no part of what it
serves.

The two command-line tools are installed by you, on your machine, under your own account
with their publishers. Calliopa neither distributes them nor grants you any right to use
them; whether you are entitled to is between you and their publishers. The Hermes recipe
applies one patch to the pinned Hermes release at build time, on your machine; the patched
copy exists only in the image you built.
