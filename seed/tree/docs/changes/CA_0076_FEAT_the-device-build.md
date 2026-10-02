# CA_0076_FEAT_the-device-build

Status: wip

Requested: 2026-10-01, by the user: scaffold the two apps of `BO_0319` (`calliopa-bootstrap`) as
changes that can be processed concurrently. This change is the shell's device build. The same
tree is built client-rendered for a WebView, its API routes are dispatched in the page to the
same handlers, and the port is answered over the native bridge by the device cell. `build`, which
the kernel runs, is unchanged. It shapes the work and authorizes no implementation.

## Transfer

Set to draft by the user on 2026-10-01 and transferred the same day: `BO_0319_042` became
`CA_0076_001` (the device port), `_002` (`build:device` and the in-page routes) and `_003` (the
behaviour suites in the desktop harness) in [Device](../system/foundation/device.md), *The Device
Build*, beside a line on the bridge as built; `BO_0319_044` became `CA_0076_004` in
[System](../system/system.md), *Fixed Stack*, unchanged. The harness's cell over a local socket is
Go code in `calliopa-bootstrap` (`BO_0319_058`), never shipped. Outbound HTTP goes through
Capacitor's native HTTP, since a page's cross-origin rules would refuse the vendors' APIs. Worked
in `calliopa-bootstrap`'s shared app track (`BO_0335`).

## What Is Asked

- The fixed lines are [Device](../system/foundation/device.md)'s. This change must keep these:
  no feature has device-specific UI code; the instance's behavior does not change; `build` stays
  what the kernel runs.
- `adapters/device/` and a `build:device` script: Qwik's client-rendered output of the same tree,
  with the API routes dispatched in the page and the port (`CA_0074`) answered through the bridge
  plugin (`calliopa-bootstrap`'s `BO_0326`).
- The adapter speaks the device cell's bridge as built (`calliopa-bootstrap`'s
  `docs/system/mobile.md`, `BO_0319_011`): one JSON request (`protocol`, `method`, `path`,
  `header`, `body`) answered with `protocol`, `status`, `header` and `body`, so a route the page
  dispatches reaches the same handler an instance serves. The cell refuses another protocol in
  words, and the page shows that refusal.
- The Fixed Stack's device line (`BO_0319_044`) becomes truth with it.

## Takes Over From BO_0319

- `BO_0319_042` whole, in [Device](../system/foundation/device.md), *The Device Build*.
- `BO_0319_044`, in [System](../system/system.md), *Fixed Stack*.

## Depends On

- `CA_0074` (the port) to start. The cell's bridge is built.
- Its verification runs the behaviour suites over a real device cell, so it completes after
  `CA_0075` (the extensions' server halves on the port) and `calliopa-bootstrap`'s `BO_0319_053`
  (the kernel's operations in the cell).
- Runs beside `CA_0075`, `BO_0329`, `BO_0333` and `BO_0334`.

## Owns

- `adapters/device/`, the `build:device` script in `package.json`.

## Notes For Draft

- The desktop harness `BO_0319_042` names (a WebView over a device cell, without a phone) needs a
  way to reach the cell from a desktop page. Proposed: a small Go test binary that opens the cell
  and answers the bridge's `call` over a local socket, used by the harness only and never shipped.
  The bridge plugin's definition stays the one interface. This is measured at draft, against
  `mobile.md`'s rule that heavy builds stay outside the main loop.

## Verification To Shape At Draft

- The behaviour suites run against the device adapter over a device cell in the desktop harness.
- `build` and the instance are unchanged: a pin builds and serves as before.

## Release Notes

- None. Nothing an installer or a user sees changes.

## Progress

- Implemented 2026-10-02 in `calliopa-bootstrap`'s shared app track (`BO_0335`): the device
  adapter (`CA_0076_001`) and `build:device` with the in-page server (`CA_0076_002`), verified in
  Chromium over a real device cell through the desktop harness. Open: the port's cases and the
  behaviour suites run against the device build (`CA_0076_001`, `CA_0076_003`), and the Fixed
  Stack's device line (`CA_0076_004`) with them.
