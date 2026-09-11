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

Other machines reach Calliopa too: it listens on every network adapter of
the machine, so a laptop on the same LAN, Tailscale, WireGuard or any other
VPN opens it at this machine's address there, on the same port. To limit
that, set `CALLIOPA_HOST_BIND` in `.env` to one adapter's address (its
Tailscale address, say) or to `127.0.0.1` for this machine only, and run
`./install.sh` again. The database and the object store only ever listen on
`127.0.0.1`. Two things to know before you rely on it:

- On Linux, Docker's published ports bypass host firewalls such as `ufw`. On
  a machine with a public IP address, bind to your VPN adapter's address or
  to `127.0.0.1`, or the whole internet reaches the sign-in page.
- Calliopa serves plain HTTP. Over a VPN the tunnel is the encryption; on an
  open network, put a TLS proxy in front and set `CALLIOPA_KERNEL_CONFIRM_URL`
  in `.env` to the address it gives the confirmation port.

An existing install keeps the `CALLIOPA_HOST_BIND` its `.env` already holds,
since the installer never rewrites your values, so one installed when the
default was `127.0.0.1` stays local: change that line to `0.0.0.0` and run
`./install.sh` to open it to your network.

The installer asks you for your account name first (`owner` if you just
press enter; it cannot be changed later). Then open that address right
after the install: on your first visit Calliopa shows that name again and
asks you to choose its password — once; from then on you sign in with the
name and the password, and the sign-in page names the account while you are
the only person on the instance. Until the password is set, whoever reaches
the address first sets it. A lost password is set again with
`app account set-password` inside the stack; the name is
`CALLIOPA_OWNER_PRINCIPAL` in `.env`.

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
run `./install.sh` directly. Running the one command above again keeps the
release your existing `~/calliopa` is on: it says which release that is and
which is the latest, and leaves the update to you (Updating, below).

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
git fetch --tags --force && git checkout --detach v<version>
./install.sh
```

`--force` lets the fetch take a release tag that was corrected after your
checkout last saw it; without it, git keeps the tag it already has. The
installer rewrites the release's pins in `.env` from the checkout on every
run; everything else in `.env` is yours and is never touched.

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
