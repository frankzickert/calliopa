# CA_0021_FEAT_connections-and-credentials

Status: completed

Requested: 2026-08-30

## Intent

Calliopa can prove who is calling *in*. [API Authentication](../../../../../../docs/system/identity/api-authentication.md)
issues client records and `cak_` bearer credentials, and `resolveCaller` resolves
every request to exactly one client or refuses uniformly. There is no other
half. Calliopa has nowhere to keep a credential it uses to reach *out*: no
secrets key, no credential store, and no settings surface to administer one
from.

This change adds that half: a connection record for one external party, its
secret encrypted at rest in Postgres, administered from a settings surface the
shell does not have yet.

It stops there. [CA_0022_FEAT_agent-layer](../../../../../../docs/changes/completed/CA_0022_FEAT_agent-layer.md) is
where the agent arrives, and this change is what it stands on.

## Why This Is Its Own Change

The agent layer was proposed as one change and split on 2026-08-30. The reasons
are worth keeping, because they also say what this half must not reach for.

- The credential store is what everything else depends on, and its shape does
  not depend on the agent. A key must be enterable without being readable back,
  encrypted at rest, and reachable by the server that uses it. None of that
  changes with what consumes it.
- The sizes are not comparable. This change adds no compose service and does not
  touch the Postgres image. The agent half adds three services, swaps
  `postgres:17` for `pgvector/pgvector:pg17` under a development volume already
  in use, and pins and patches an upstream Python distribution.
- The functional questions the combined proposal carried were all answered on
  2026-08-30, but the risk was never in the questions — it was in the size of
  one reviewable change. Splitting halves it.

- Honesty about the cost of the split: this half lands with no consumer. Its
  first stored secret is the OpenAI key Honcho needs, and Honcho arrives in
  CA_0022. What makes it reviewable on its own is that the store is exercised by
  its own tests, not that anything in the product uses it yet.

## Where This Comes From

- The store and the settings surface come from `/home/calliopa/projects/studio`,
  Calliopa's sibling in shape — Qwik City, Postgres, Garage, Compose, the same
  scripts, the same docs model — so what is copied lands on matching ground. Its
  authority is `src/extensions/settings/docs/system/connections.md`.
- The agent half's design comes from somewhere else entirely, and CA_0022
  records why. That matters here only in one place: the subscription sign-ins
  are *not* in this change, because the design that works keeps them out of this
  store. See Subscription Sign-In below.

## Connections

* A connection is a record for one external party.
* Connection states are `unconfigured`, `configured`, `verified`, and `failing`.
* A connection's secret lives in Postgres, encrypted at rest with a new
  `CALLIOPA_SECRETS_KEY` from `.env.dev`. The database never holds a plaintext
  secret and no API response contains one.
* An API-key connection takes a key that is write-only in the interface. After
  saving, the row shows that a key is set and its last characters, and never the
  key.

- The kind this change builds is the API key, and the row it is proven against
  is `honcho` — the OpenAI key the agent's memory needs. It is the only secret
  Calliopa will hold at rest when CA_0022 lands, which is what makes it the
  right one to build the store around.
- A connection may also carry no secret at all and hold only reported status.
  That kind exists for the subscription sign-ins and is specified in CA_0022,
  where the thing that reports the status lives. This change does not build it,
  because a status row with nothing to report is not testable.
- The secrets key is 32 bytes as hex, generated with `openssl rand -hex 32`, and
  is a required variable — so it joins `config/required-env.json`,
  `.env.dev.example`, and the Compose application environment together, which
  `tests/behavior/compose-environment.test.ts` already keeps in agreement.
  `pnpm run bootstrap` generates it, like the Garage credentials.
- Rotating `CALLIOPA_SECRETS_KEY` invalidates every stored secret, because
  nothing re-encrypts them. That is acceptable for a development instance where
  re-entering a key is a minute's work, and it is stated rather than discovered.
- Connections are instance-wide. Calliopa has no project or user to scope them
  to, so the table carries no owner column and gains one when that arrives.

## The Settings Surface

* Settings is reached from a control in the shell header, which opens settings
  in a tab.

- The header is already the row for chrome that belongs to the instance rather
  than to any document: the theme toggle, the layout controls, and the process
  indicator, all transparent icon buttons that gain a surface on hover.
  A settings control is the same kind of thing and takes the same idiom.
- Settings opens as a tab so it inherits everything a tab already does, rather
  than becoming a second kind of place with its own rules. Studio has the same
  shape — an icon bar opening a `settings` tab kind — and it is the arrangement
  this shell is closest to already.
- The tab needs a target identity of its own. [Workspace Shell](../../../../../../docs/system/workspace/frame.md)
  finds a tab by its target so that opening one reveals an existing tab rather
  than opening a second; a tab with no target would have to special-case that.
  Settings therefore carries a synthetic instance-wide target, and the reveal
  rule works unchanged.
- This is the first tab whose target is not content. `document` is a target kind
  answered by [Block Document Model](../../../../../../docs/system/documents/block-document-model.md), and a
  settings tab is a tab kind that resolves to nothing in the graph — which is
  the part of this the system docs have to say plainly.
- The library was considered and rejected. It is a content tree listing
  documents, and a `Settings` category holding one entry that is not a document
  would make the drawer mean two things.
- A route outside the shell was rejected too. It is the least work and it leaves
  the bounded frame the whole shell is built around, taking the tabs, the
  inspector, and the dock with it.
- The settings tab is unprotected, like the rest of the shell. Human sign-in
  arrives through its own change.
- The tab is sectioned, and `Connections` is the first section. Themes, layout,
  and anything else that might later belong in settings are not moved into it
  here.

## Subscription Sign-In

The Claude and Codex subscription sign-ins were in this change when it was
split, and were moved out on 2026-08-30 when the working prior art was found.
The reason belongs here, because it is the reason this store is smaller than
studio's.

- Studio's design stores the tokens encrypted in this table and materialises
  them into a fresh credential home for each run. It is unbuilt and unproven.
- The design that ran — in `_calliopa-old/calliopa-bootstrap`, dogfood-verified
  on both subscriptions — keeps the credential homes on the agent's own data
  volume and drives the logins from a broker inside the agent container. Hermes
  resolves its subscription credentials from its own auth store, so a token
  round-tripped through Postgres has to be adopted back into that store anyway,
  and Codex's refresh tokens are single-use, which makes a second copy a hazard
  rather than a backup.
- So the subscription credential never enters this store. What this store would
  hold for `claude-code` and `codex` is a status row, and the thing that reports
  the status is the agent container. Both belong to
  [CA_0022](../../../../../../docs/changes/completed/CA_0022_FEAT_agent-layer.md).
- The consequence, recorded there: losing the agent's data volume means signing
  in again.

## What Credential Custody Proves

* `Test` on a row uses the stored key against the real service and reports what
  came back. It is what moves a connection from `configured` to `verified`, and
  a failure moves it to `failing` with the error text in the row.

- This is the whole deliverable and it is judgeable on its own: a key entered
  once, stored encrypted, never readable back, and usable by the server against
  the real service.
- It is also the thing most likely to be wrong in a way nothing else would
  catch. A secret that is written correctly but logged, returned in an API
  response, or stored alongside its plaintext fails silently and stays wrong
  until someone reads the database.
- Nothing here is mocked. If a key is absent or rejected, the row says so and
  offers nothing.

## What This Is Not

- Not the agent layer. No Hermes, no Honcho, no compose service, no Postgres
  image change, no MCP tool surface, and no delegation. Those are
  [CA_0022](../../../../../../docs/changes/completed/CA_0022_FEAT_agent-layer.md).
- Not the subscription sign-ins, for the reason above.
- Not a second credential system. The inbound half stays
  [API Authentication](../../../../../../docs/system/identity/api-authentication.md); connections are the
  outbound half. The agent's own inbound credential, when it arrives, is an
  ordinary client record issued by the existing script.
- Not an identity or authorization change. Connections are instance-wide and the
  settings surface is unprotected, like the rest of the shell.
- Not a general settings area.

## Verification Impact

* A stored secret must never be readable from the application's API, and must
  never appear in `.env.dev` or in a log line.

- Provable in the gate: a stored connection secret is ciphertext in Postgres and
  absent from every API response; the row reports that a key is set and its last
  characters and never the key; a wrong key moves the row to `failing` with the
  service's own message; the settings tab opens from the header, reveals rather
  than duplicates on a second press, and survives a reload like any other tab;
  the axe scans stay clean on both form factors.
- Not provable in the gate: `Test` against a real OpenAI account, which needs a
  real key. What is provable without one is that the key reaches the request and
  that a refusal is reported rather than swallowed.
- The verification stack publishes no ports and a behavior test asserts it. This
  change adds no service, so that stays true without new work.
- `pnpm run verify` gates the result.

## System Work

Transferred on 2026-08-31 and implemented the same day. The truth lives in
`docs/system/`; this document is the coordination record and is not where the
work is read from.

- [Settings](../../system/connections.md) is the new document: the connection record,
  its states, the encrypted store, the credential accessor, what proving a
  connection means, and the settings surface. It carried `CA_0021_002`,
  `CA_0021_003`, `CA_0021_004`, and `CA_0021_006`.
- [Application Foundation](../../../../../../docs/system/foundation/runtime.md) carried
  `CA_0021_001`: `CALLIOPA_SECRETS_KEY` as a required variable, generated once
  by `pnpm run bootstrap` and per run by the verification stack.
- [Workspace Shell](../../../../../../docs/system/workspace/frame.md) carried `CA_0021_005`: the
  header control, the `settings` target kind, and the synthetic target that
  keeps the reveal rule true.

## What The Gate Cost

The completion gate ran seven times. The first failure was this change's own:
the settings view read its rows from a task that runs while the page is
rendered on the server and is not run again when the page resumes, so a
restored settings tab came back with no rows. The block editor already had the
right idiom and it was not followed.

The other six runs failed on three races that predate this change, each a test
reading a state without waiting for it to settle. Two were recorded as unowned
notes and this change took them:

- `CA_0021_007` in [Workspace Shell](../../../../../../docs/system/workspace/frame.md): the strip
  marked the active tab with an attribute present on one tab, and a tab that
  stopped being active kept it. It is now a value on every tab, `aria-current`
  included, so what went stale was an accessible marker and not only a test
  hook.
- `CA_0021_008` in [Block Editor View](../../../../../../docs/system/documents/block-editor.md): the
  typed-save scenarios waited on a transient between a keystroke and the write
  behind it. They now read the document's change count before the gesture and
  wait for it to rise.

The third had no note: the helper that cycles the dock read its position
without waiting for the press it had just made. That was a driver correction
with no product implication and was folded into `CA_0021_008`.

Taking those on was the user's call, asked and answered twice. Recorded because
the split is what the next change inherits: the suite has a pattern of racing
the surface, and one unowned note remains, on the cross-block drag scenario.
