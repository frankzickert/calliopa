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
read, and choose to send. When the owner signs in, the browser asks GitHub
which Calliopa releases exist, so the header can tell you when a newer one is
available; nothing in the stack makes that request, and `CALLIOPA_UPDATE_CHECK=off`
in `.env` stops it.

This repository is the distribution: everything needed to install and run a
complete Calliopa stack.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/frankzickert/calliopa/main/install.sh | bash
```

That one command downloads this repository into `~/calliopa`, generates every
secret the stack needs, seeds the bundled core into your graph, and starts
Calliopa at <http://127.0.0.1:8090> — or on the port you chose: the installer asks
*Which port should Calliopa listen on?* on its first run, and enter keeps 8090.
To change the port later, edit `CALLIOPA_PORT` in `.env` and run `./install.sh`
again; the confirmation origin follows on the next port, which the installer
derives, so never move the port with `docker compose up -d` alone.

The installer asks you for your account name first (`owner` if you just
press enter; it cannot be changed later). Then open that address: on your
first visit Calliopa shows that name again and asks you to choose its
password — once; from then on you sign in with the name and the password,
and the sign-in page names the account while you are the only person on the
instance. Set the password before you widen `CALLIOPA_HOST_BIND` beyond
`127.0.0.1`: until it is set, whoever reaches the address first sets it. A
lost password is set again with `app account set-password` inside the stack;
the name is `CALLIOPA_OWNER_PRINCIPAL` in `.env`.

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

## Updating

When a newer release exists, the header shows *Update available* to the
owner. It opens the Update tab, also under Settings, which lists the newest
patch, minor and major release above yours and every release on request. One
press installs the one you choose: an updater the installer left running on
your machine checks out that release and runs `./install.sh` for you — the
images are rebuilt from the release's binaries, the stack restarts, and the
release's extensions arrive in your graph as a proposal. The tab then offers to
review it and to accept and promote it, and your instance serves the new
release. Until you accept, it keeps serving what it served before.

Where no updater could be installed (the installer says so at its end), the
tab shows the three commands to run instead:

```sh
cd ~/calliopa
git fetch --tags && git checkout --detach v<version>
./install.sh
```

The installer rewrites the release's pins in `.env` from the checkout on
every run; everything else in `.env` is yours and is never touched.

An older release can be chosen the same way, labelled as a downgrade. That
rolls the images back; your graph content versions on its own — every accepted
change is a revision, and what your instance serves is its release pin — and
is not rolled back by it.

## The bundled core

A fresh install seeds four extensions into your graph, whole — code,
vocabulary, skills, and declarations. Their source ships in `seed/`, and
anything you change in them is yours to keep.

- **`ui.shell`** — the application itself: writing in typed blocks,
  developing and publishing, and working with the agent.
- **`settings`** — where you sign the agent in and store your connections.
- **`calliopa-extension`** — how new extensions are made.
- **`calliopa-base`** — the conventions every agent run starts from.

## Your own extensions

An extension can be started from the Extensions section of the application:
a name and one sentence of purpose, and it exists in your graph under
*Yours*, switched off, ready for a change document and for the agent to fill
with code; you switch it on from its page when it has something to serve.
Any extension can be exported from its page as one file — its sources, its
vocabulary and skills, and its change documents; a core extension carries its
Apache licence inside — and the owner can import such a file: review what it
adds or changes, accept it on the kernel's confirmation page, and switch it
on. An imported extension arrives switched off and runs nothing until then.
The core extensions themselves move only with a release.

## Licence

The engine is a free proprietary product; everything that lives in the graph
is Apache-2.0. `LICENSE` says which is which.

## More

Documentation, guides, and everything else: <https://www.calliopa.com>
