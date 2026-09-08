# Application Foundation

## Purpose

- This document is the authoritative description of the application's runtime boundary, development environment, and verification gate.
- `CA_0002_BUILD_technical-architecture-and-workspace-shell` is the originating change.
- The fixed stack in [System](../system.md) decides the language, framework, runtime, and services. This document decides how they are assembled and what must become true.

## Network

* The development machine is WSL with code-server, inside a Tailscale network. Containers are reached at the machine's Tailscale address `100.114.122.91`, not at `localhost`: Docker publishes ports to the Windows host rather than the WSL loopback, so `localhost` from a WSL shell does not reliably reach them while the Tailscale address does.
* This repo owns two host port ranges on `100.114.122.91` and publishes nothing outside them: 4500–4520 for development, and 4000–4020 for the production instance. The legacy `calliopa-web` stack (4310 / 5436 / 4910), `studio` stack (4400–4420), and `web` stack (4420–4440) on the same machine are never contended with, and neither range is reached by the verification gate, whose isolated projects publish nothing at all.

- The application listens on 4300 inside its container and is published on 4500. Postgres is published on 4501 and Garage's S3 API on 4502. Later services take the next free port in the range. Ports are overridable through the environment file.
- Hermes listens on 8642 inside its container and is published on 4503, for development inspection only and behind its own bearer. Honcho listens on 8000 and is published on 4504, and runs only when its key is stored.
- Production publishes the same services at the front of its own range, in the same order: the application on 4000, Postgres on 4001, Garage's S3 API on 4002, Hermes on 4003, and Honcho on 4004. 4005–4020 stays free for later services, and every port is overridable through the environment file as development's are. [Production Stack](./production-instance.md#production-stack) owns what runs there.

## Runtime Shape

- The application is one Qwik City app under `src/`. It serves server-rendered HTML routes and API routes.
- Since `BO_0207_016` the shell holds no records and no bytes of its own: content is the one graph's through CCGW, bytes are CCGW blobs, working state and secrets are the kernel's. [Episodes And Assets](../../../src/extensions/calliopa-video/docs/system/production/episodes-and-assets.md) owns what a rendition's bytes are, and a referenced blob is permanent in the graph's store.
- `/health` is the operational readiness probe. It reports CCGW and the kernel as reached rather than process liveness — `GET /healthz` on `CALLIOPA_CCGW_URL` and the agent bridge's health on `CALLIOPA_KERNEL_URL` — and answers 503 naming whichever did not answer.
- The application stays valid and renderable while the database holds nothing. An empty instance is a working state, and every gate run proves it.
- The `Dockerfile` has a `dev` target that runs Vite on 4300 and a `production` target that builds the client bundle and standalone Node server.

## Implementation

- The TypeScript Qwik City application lives under `src/`, uses exact pnpm dependencies and strict TypeScript, serves through Vite on port 4300 in development, and builds a standalone Node server. `src/server/ccgw/env.ts` is the environment the server needs — `CALLIOPA_CCGW_URL` and `CALLIOPA_KERNEL_URL`, both handed to the tree by the kernel — and the server entry reads it at startup, reporting every missing variable together (`BO_0207_016`). The multi-stage `Dockerfile` builds both `dev` and minimal `production` targets, and the empty `/` route renders `Calliopa` (`CA_0002_001`).
- `src/server/db.ts`, `src/server/object-store.ts`, `src/server/env.ts`, `config/required-env.json`, `migrations/` and the migration scripts are deleted under `BO_0207_016`, and `postgres` and `@aws-sdk/client-s3` left the lockfile. `scripts/serve.mjs` assembles nothing from secret files and migrates nothing; the promotion gate's serve probe reports nothing to skip. `/health` probes CCGW and the kernel concurrently and `src/server/health.test.ts` covers the decision and the probe boundary (`CA_0002_002`, `BO_0207_016`).
