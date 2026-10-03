# Higgsfield Sign-In Is Pasted

Status: completed

Signing in to Higgsfield fails on every `0.5.0` install. Higgsfield's sign-in server refuses it
before the person signs in: *The 'redirect_uri' parameter does not match any of the OAuth 2.0
Client's pre-registered redirect urls.* The redirect has to go to a port Higgsfield accepts. The
person then always pastes the `code` and `state` back, as they already do for OpenArt, and the
media service publishes no port at all. This document shapes the change and authorizes no
implementation.

## What Is Asked

* Signing in to Higgsfield works on every install, whatever port the person chose for Calliopa
  and whatever else listens on their machine. Requested by the user, 2026-10-02, on an install
  at port 9000 whose sign-in link carried `redirect_uri=http://localhost:9003/callback`. It must
  work in the next release.
* A generator's sign-in is always finished by pasting the `code` and `state` from the address the
  browser landed on. No vendor's redirect is caught on the host. This replaces the decision of
  2026-09-21 that the callback port is published and the paste is only the fallback. User
  decision, 2026-10-02: *port 8765 is used by another app. higgsfield can't reach it anyway,
  therefore, we need to paste the code and the state.*
* The media service publishes no host port. `CALLIOPA_MEDIA_CALLBACK_PORT` goes away, and the
  install's row goes back to three ports (`8090`–`8092` by default). User decision, 2026-10-02.

## Where This Starts

- Higgsfield's OAuth client (`client_id=sRGCQJvvJkPrrtRj` at `clerk.higgsfield.ai`) accepts
  exactly `http://localhost:8765/callback` through `http://localhost:8774/callback`. Checked
  against its authorize endpoint on 2026-10-02: `8093`, `9003`, `8764`, `8775`, `9999`,
  `127.0.0.1:8765` and a trailing `/callback/` are all refused with the error above. `8765` is
  the default port of Higgsfield's CLI (`1.1.26`, *omit for default port with auto-fallback*),
  and the nine after it are its fallbacks.
- `BO_0337` made the callback the fourth port of the install's row, `CALLIOPA_PORT + 3`, the same
  number on the host and in the container. The broker then starts
  `higgsfield auth login --port <that port>` (`login_broker.py`, `argv_for`). With the default
  `8090` the port is `8093`, so no install of `0.5.0` can sign in to Higgsfield. The BO_0337
  verification ran against a stand-in, which never reached Higgsfield.
- Before `BO_0337`, the port was `8765` on the host. That collided with anything else holding
  `127.0.0.1:8765`, which is why `BO_0337` moved it. On the user's machine another app holds
  `8765`, so a published `8765` can't serve them either.
- The paste already works for every vendor. The broker reads the loopback out of the authorize
  URL, waits in `awaiting_redirect`, and hands the pasted `code` and `state` to the CLI's listener
  inside the container (`BO_0273_033`). OpenArt has only ever been signed in this way. The port
  only has to be one Higgsfield accepts and one the CLI can bind inside the container. Nothing
  outside the container needs to reach it.

## Shape Of The Fix

- The broker starts Higgsfield's CLI without `--port`, or with a fixed `8765`, which the
  container never publishes. Either way the `redirect_uri` is one Higgsfield accepts, and the
  broker reads the actual port from the URL as it already does.
- `distribution/docker-compose.yml` and the root `docker-compose.yml`: `media` publishes nothing
  and carries no `CALLIOPA_MEDIA_CALLBACK_PORT`. The exposure-boundary and topology suites expect
  only the kernel's three ports.
- `distribution/install.sh`: `row_size=3`. The prompt names `8090`–`8092`. The rule that refuses
  `8092`, whose callback would have been `8095`, goes. `CALLIOPA_MEDIA_CALLBACK_PORT` is no
  longer written, and it is removed from an `.env` that carries it. The closing lines name three
  ports. `.env.example` (both) and `distribution/README.md` follow.
- `docs/system/media-service.md` and `docs/system/distribution.md`: the published-callback lines
  become the paste-only truth. The fixed line of 2026-09-21 is replaced by the user decision
  above.
- The media extension in the graph: its `docs/system/system.md` says the paste is how every
  sign-in finishes, rather than *usually invisible for Higgsfield*. The settings section's comment
  and any wording that promises a redirect caught by the browser follow. Because this part lands
  in the graph, this change is carried there as a change document of the media extension.
- The sign-in row says plainly what to paste. After approving, the browser lands on a page that
  doesn't load, or on whatever else answers on `localhost:8765`, and the person copies that
  address.
- Release notes: a fix entry for Higgsfield sign-in, and a change entry saying the install uses
  three ports and an update drops the fourth. Calliopa Web's `install.md` follows the three-port
  row and the paste.

## Verification Planned

- The broker's suite and `TheSignInSeam` with the real Higgsfield CLI's authorize URL shape: the
  flow reaches `awaiting_redirect` on a port from `8765`–`8774`, and a pasted redirect reaches
  the listener.
- The authorize URL a real Higgsfield CLI prints in a throwaway stack's `media` container is
  accepted by Higgsfield's authorize endpoint, checked the way this document's starting point
  was.
- A throwaway install under its own compose project (never `calliopa`) on a free row: three ports
  published and nothing else; an update over a `0.5.0` `.env` removes the callback key.

## System Tasks

Transferred on 2026-10-02:

- [Media Service](../system/media-service.md), under The Service: the two fixed sign-in lines
  replaced by the user decision above, and `BO_0342_001` (the broker), `BO_0342_004` (the media
  extension in the graph, with this document carried there) and `BO_0342_005` (the real CLI's URL
  accepted by Higgsfield on a throwaway stack).
- [Distribution](../system/distribution.md), The Install's Ports: the row's two fixed lines down to
  three ports, and `BO_0342_002` (compose and its suites), `BO_0342_003` (`install.sh`, `.env`,
  README), `BO_0342_006` (release notes and the website's `install.md`) and `BO_0342_007` (the
  throwaway install and update).
