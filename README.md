# Calliopa

Calliopa is a local-first knowledge system you run on your own machine. Your
knowledge lives in a versioned graph. The application you work in is itself
built from that graph, so it can grow with what you keep in it. And Hermes —
an agent that lives in the stack — extends the system for you, always through
proposals you review and accept.

It is for people who want their notes, writing, and work to be a system they
own and can reshape, rather than a product they rent. Everything runs on your
machine; nothing leaves it unless you send it. The one thing that ever reaches
the people who make Calliopa is a diagnostic file you write with one command,
read, and choose to send.

This repository is the distribution: everything needed to install and run a
complete Calliopa stack.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/frankzickert/calliopa/main/install.sh | bash
```

That one command downloads this repository into `~/calliopa`, generates every
secret the stack needs, seeds the bundled core into your graph, and starts
Calliopa at <http://127.0.0.1:8090>.

Open that address. On your first visit Calliopa asks you to choose the
owner's password — once; from then on you sign in with it. The owner's name
is `CALLIOPA_OWNER_PRINCIPAL` in `.env` (`owner` unless you changed it before
installing). Do that before you widen `CALLIOPA_HOST_BIND` beyond
`127.0.0.1`: until the password is set, whoever reaches the address first
sets it. A lost password is set again with `app account set-password` inside
the stack.

Requirements: Docker Engine 25 or later with the Compose plugin 2.24 or later,
and `git`. You supply no keys — the agent is signed in later from the settings
view, on your own ChatGPT or Claude subscription.

Calliopa publishes no container image. The install builds the images on your
machine from the recipes under `build/`: base images you pull from their
publishers, plus the Calliopa binaries downloaded from the release named in
`.env` and checked against its pinned checksum. The object store is pulled
from its publisher. `THIRD-PARTY.md` lists all of it. Nothing the stack runs
ever contacts Calliopa.

Re-running the installer is always safe: it repairs what is missing and never
overwrites your configuration, secrets, or data. From an existing checkout,
run `./install.sh` directly.

To update, pull the checkout and run `./install.sh` again: the new release's
pins land in `.env`, the images are rebuilt from them, and the stack restarts.
To roll the images back, check out the previous release and run it once more;
graph content versions on its own and is not rolled back by that.

## The bundled core

A fresh install seeds four extensions into your graph, whole — code,
vocabulary, skills, and declarations. Their source ships in `seed/`, and
anything you change in them is yours to keep.

- **`ui.shell`** — the application itself: writing in typed blocks,
  developing and publishing, and working with the agent.
- **`settings`** — where you sign the agent in and store your connections.
- **`calliopa-extension`** — how new extensions are made.
- **`calliopa-base`** — the conventions every agent run starts from.

## Licence

The engine is a free proprietary product; everything that lives in the graph
is Apache-2.0. `LICENSE` says which is which.

## More

Documentation, guides, and everything else: <https://www.calliopa.com>
