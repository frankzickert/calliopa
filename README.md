# Calliopa

Calliopa is a local-first knowledge system you run on your own machine. Your
knowledge lives in a versioned graph. The application you work in is itself
built from that graph, so it can grow with what you keep in it. And Hermes —
an agent that lives in the stack — extends the system for you, always through
proposals you review and accept.

It is for people who want their notes, writing, and work to be a system they
own and can reshape, rather than a product they rent. Everything runs on your
machine; nothing leaves it unless you send it.

This repository is the distribution: everything needed to install and run a
complete Calliopa stack.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/frankzickert/calliopa/main/install.sh | bash
```

That one command downloads this repository into `~/calliopa`, generates every
secret the stack needs, seeds the bundled core into your graph, and starts
Calliopa at <http://127.0.0.1:8090>.

Requirements: Docker with the Compose plugin, and `git`. You supply no keys —
the agent is signed in later from the settings view, on your own ChatGPT or
Claude subscription.

Re-running the installer is always safe: it repairs what is missing and never
overwrites your configuration, secrets, or data. From an existing checkout,
run `./install.sh` directly.

## The bundled core

A fresh install seeds four extensions into your graph, whole — code,
vocabulary, skills, and declarations. Their source ships in `seed/`, and
anything you change in them is yours to keep.

- **`ui.shell`** — the application itself: writing in typed blocks,
  developing and publishing, and working with the agent.
- **`settings`** — where you sign the agent in and store your connections.
- **`calliopa-extension`** — how new extensions are made.
- **`calliopa-base`** — the conventions every agent run starts from.

## More

Documentation, guides, and everything else: <https://www.calliopa.com>
