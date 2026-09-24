# CA_0051_FIX_settings-builds-without-publishing

Status: completed

Completed 2026-09-17. `settings`' `tests/behavior/parties.test.ts` imports nothing from `publishing`; its channel block is
`publishing`'s `tests/behavior/roster.test.ts` (`CA_0051_001`, `_002`). The tree builds as promotion builds without
`publishing`, and without `documents` and `publishing`; the dev instance switched `publishing` off and on, served
(`_003`). The release-notes line is in `calliopa-bootstrap` (`_004`); release `0.3.11` follows with `BO_0260`.

Requested: 2026-09-17. The user's install, updated to `0.3.10`, switched `publishing` off and the promotion was refused:

> Promotion refused: build: pnpm run typecheck exited with code 2; last output: [ELIFECYCLE] Command failed with exit code 2.. The graph says inactive; the served pin 76 still carries the previous shape. Switch back to undo.

The same refusal met the dev instance the same day, and pin 1359 under `BO_0232` before it. A change of `settings`, with the tests it moves landing in `publishing`.

## Where This Starts

- **`publishing` is bundled and not required**, so an owner may switch it off (`kernel extension deactivate publishing`, or the Extensions section), and a general workplace without publishing is a reasonable instance to run.
- **One file stops the build without it.** An absence check on the dev instance at dataRevision 26 (`publishing` and the four `individual` extensions removed from a checkout, the registry regenerated, `pnpm run typecheck`) reports exactly one error: `src/extensions/settings/tests/behavior/parties.test.ts(5,68)`, *Cannot find module '~/extensions/publishing/server/channels'*. `settings`' runtime code already reads the channel roster through a reader `publishing` provides (`CA_0049`), and an instance without `publishing` lists no dynamic rows; only the test reaches into `publishing` directly.
- **The test is `publishing`'s concern in `settings`' tree.** Its `describe("a channel the author made")` block creates a channel with `createChannel`, checks its row in the roster, saves, proves and clears its key, and deletes the channel — the dynamic roster seen from the channel's side. `publishing` depends on `settings` (`>=1.0.0`), so the same block can import `settings`' connection functions from `publishing`'s tests without any extension reaching the other way.
- **`documents` is not affected on its own:** without it the registry refuses because `publishing` depends on it, which is the activation gate working; switching `documents` off means switching `publishing` off first.

## Intent

- Switching `publishing` off on an install builds and serves: `settings` imports nothing from `publishing`, in its code or its tests.
- The dynamic channel roster stays proven, from `publishing`'s own behavior tests.

## Transferred

- 2026-09-17: `settings`' [Channels](../system/channels.md), Without Publishing (`CA_0051_001` the test split,
  `_003` verification, `_004` the release-notes line); `publishing`'s
  [Channels](../../../publishing/docs/system/channels/channels.md) (`CA_0051_002` the roster test). Release `0.3.11`
  follows in `calliopa-bootstrap` once this and `BO_0260` are completed.

## Decided 2026-09-17

User decisions on the open points:

- **The fix ships alone as release `0.3.11`**, verified as a fresh install and as an update from `0.3.10`, with an install switching `publishing` off after the update as part of its verification.
- **Verification gains an absence check:** a checkout with each non-required bundled extension removed, with whatever depends on it, must typecheck and build before a release. The check belongs to the fixed layer's release verification (`distribution.md`, Verifying A Release) rather than to `settings`, so it is its own change in `calliopa-bootstrap`: `BO_0260`. This change removes the one leak the check finds today.
