# CA_0036_FEAT_distribution-channels

Status: completed

Requested: 2026-09-04

## Intent

Build the scaffold: a settings surface where the author enters the credentials a
distribution channel needs, and the record behind it that holds them. Homepage is
the one channel it ships with, and it is there to prove the scaffold against a
real credential rather than to be the point of the change.

Every further channel — TikTok, LinkedIn, whatever follows — is its own change.

## Settled Scope

Decided by the user on 2026-09-04.

- This change is the scaffold and nothing else. The surface, the record, saving,
  proving, and clearing.
- One channel per change. A channel arrives with the change that needs it, which
  is the rule [Settings](../../system/connections.md) already applies to connections.
- Homepage is the only channel here.
- Channels get their own settings section, separate from `Connections`. The two
  are different kinds of thing — `honcho` is an internal service the agent needs,
  a channel is somewhere the author's work goes — and the author's channels are
  not made easier to read by sitting in a list with the agent's memory key. This
  is the second section [Settings](../../system/connections.md) said would arrive with
  the change that needed one.
- No adapter, no mapping, no transport, and nothing published. Holding a
  credential is the whole of it.

## What Exists To Build On

- [Settings](../../system/connections.md) is implemented and does most of this already:
  a record per external party, its secret encrypted at rest under
  `CALLIOPA_SECRETS_KEY`, write-only in the interface, showing its state and the
  last characters of the key and never the key. States are `unconfigured`,
  `configured`, `verified`, `failing`. Clearing removes the secret and returns the
  row to `unconfigured`.
- Proving a party is already defined as "the smallest real authenticated call to
  it", and a service's own error message is stripped of the presented secret
  before it is stored.
- The settings tab is sectioned, `Connections` is its one section, and Settings
  states that sections are the extension point and "the second section arrives
  with the change that needs it". This is that change.
- `src/server/connections.ts`, `src/server/connection-tests.ts`,
  `src/lib/connections.ts`, `migrations/0006_connection.sql`, the
  `/api/settings/connections` routes, and `src/components/views/settings.tsx` are
  the parts to extend. None of them is reimplemented here.

**The one gap.** A connection holds a secret and nothing else — a party, a state,
the masked suffix, a last-tested stamp, an error. There is no field for an
address, an endpoint, or an account. Homepage needs an address *and* a key, so
the scaffold's real work is giving a channel somewhere to put configuration that
is not secret.

## The Homepage Channel

`../homepage`'s publishing API is built and serving; `HP_0003_FEAT_publishing-api`
is in that repository's `docs/changes/completed/`. Calliopa's
[Publishing](../../../../calliopa-video/docs/system/publishing/publishing.md) still says it "is still an idea in that
repository", which is stale — but that document belongs to `CA_0033`, which is
`wip` in another session, so this change does not touch it.

What the channel holds:

- **Address** — the base URL of the homepage instance this Calliopa instance
  publishes to. Not secret, and readable back.
- **Key** — `hpk_<public credential id>_<secret>`, presented as
  `Authorization: Bearer`. Write-only, exactly as a connection secret already is.

The key is issued by the operator running `pnpm run client` in the homepage repo
against its real database. There is no environment-seeded credential and no
shared package, so obtaining it is a deliberate act in the other repository and
this change neither automates nor assumes it.

Proving the channel is `GET /v1/contract/author`, which sits behind homepage's
write guard: it answers the author contract with a valid token and homepage's
uniform 401 without one. That is the smallest real authenticated call to this
destination, so the scaffold's proof is a real one on day one.

**Why the address must be entered rather than fixed.** There is one homepage on
this machine today, the development instance at `http://100.114.122.91:4460`, and
homepage carries a production compose file for one that does not yet run.
Calliopa's own instances are already separate, with their own databases and their
own secrets keys, so a development Calliopa pointing at a development homepage and
a production Calliopa pointing at the real one is the arrangement this needs to
express. A hardcoded address makes that impossible and makes a development
experiment write to the live site.

## Technical Decisions

Made by the agent; they carry no product consequence beyond what is stated, and
the user should say so if any is wrong.

- The scaffold extends the connection store rather than introducing a second one.
  A channel is a connection that happens to be a publishing destination, and a
  parallel store would duplicate the encryption, the masking, the state model, the
  accessor, and the clearing classification.
- A channel row carries typed configuration beside its write-only secret. The
  configuration is readable back; the secret never is. This is the field the store
  does not have today.
- Configuration lives here rather than on the destination record from
  `CA_0033_008`, because that record does not exist and belongs to a change that
  is `wip` elsewhere. If it later wants the address, moving one field is a smaller
  change than blocking this one on it.
- One row per channel per instance. Two homepage channels on one Calliopa is not
  a case anyone has: the instances are already separate, which is what makes two
  addresses expressible.

## Constraints Already Settled Elsewhere

- The secret is encrypted under `CALLIOPA_SECRETS_KEY`, never readable from any
  API response, never in a log line, never in an environment file. Existing
  machinery, reused.
- Connections are instance-wide and each instance has its own secrets key, so
  credentials entered in development do not configure production. The author
  enters them again there. That follows from the instance separation
  [Application Foundation](../../../../../../docs/system/foundation/runtime.md) fixes.
- Clearing development data leaves connections untouched, because clearing is
  about content and not about access. `connection` is a preserved table and a
  channel's credentials survive `pnpm run db:clear`.
- Holding a channel's credential grants no authority to publish. Publishing stays
  a human act against an adapter that does not exist yet.
- The settings surface is unprotected, like the rest of the shell. This change
  puts a publishing credential behind no sign-in, which is worth stating rather
  than discovering.

## Where It Lands In The Docs

- [Settings](../../system/connections.md) takes all of it: the new section, the channel
  row, configuration beside the secret, and what proving a channel means. Its
  `Out Of Scope` currently rules out "a general settings area, further sections,
  and further header controls", which this change reverses in part.
- [Publishing](../../../../calliopa-video/docs/system/publishing/publishing.md) is not touched. It already states that
  Settings owns the outbound credentials a destination presents, and everything
  about destinations, mappings and transports stays `CA_0033`'s.
- [Workspace Shell](../../../../../../docs/system/workspace/frame.md) needs nothing; the settings tab
  already exists.

## Verification Impact

- The channel's proof is a real authenticated call to a running homepage with a
  real `hpk_` token. A gate with no egress reports the transport's refusal, which
  is the same proof that a refusal is not swallowed — the pattern `honcho`'s test
  already established.
- The existing API-level assertion, that no response shape carries the secret or
  the ciphertext under any state, extends to the new fields. The configuration
  must be readable while the secret beside it is not, and that distinction is
  worth asserting directly.
- A browser scenario matching what `tests/browser/settings.spec.ts` proves for
  `Connections`: saving an address and a key, reloading and seeing the address
  and the masked key, testing, clearing, and a clean axe scan.
- `tests/integration/db-clear.test.ts` already proves a stored key survives a
  clear; the channel row joins that.

## Out Of Scope

- Every channel other than homepage. Each is its own change.
- OAuth, refresh lifecycles, and redirect flows. They arrive with the first
  platform that needs one, and that change owns the problem that this instance
  answers on an address a platform cannot reach.
- Account or page selection within a channel.
- Adapters, mappings, transports, the publication log, the distribution panel,
  and anything that actually publishes.
- Correcting the stale homepage line in `publishing.md`, which belongs to the
  session holding `CA_0033`.
- Human sign-in for the settings surface.
