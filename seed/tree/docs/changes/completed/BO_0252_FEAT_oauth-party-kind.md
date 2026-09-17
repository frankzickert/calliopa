# BO_0252_FEAT_oauth-party-kind

Status: completed

Requested: 2026-09-14, from the analysis in `docs/material/publishing.md` (Decisions); revised 2026-09-15 with the user's decisions for `PU_0005` (YouTube) and against Google's documentation. The `publishing` extension's first social kind is YouTube, whose credential is an OAuth token and whose upload is a resumable session of chunks with headers the kernel's broker cannot carry today. `PU_0005` depends on this change; `PU_0001`–`PU_0009` and `CA_0049`/`CA_0050` do not.

## Where This Starts

- **One credential kind.** A party record holds `apiKey` secret fields with an authorization (header, scheme, secret field) and a probe (method, URL template, expected status); `status` parties hold nothing (`ui-kernel.md`, `BO_0207_003`). There is no token the kernel obtains itself, refreshes, or lets expire. The settings extension's row for a party is the `apiKey` row: the kind's fields and one write-only key (`CA_0049`); `publishing`'s roster says the oauth row arrives with this change.

- **The broker is one request.** `POST /__kernel/secrets/parties/<party>/request` takes a method, a path resolved against the party's configured address, and a JSON or base64 body, adds the credential, and answers the destination's status and body verbatim — no request header of the caller's, no response header, and a body of at most 512 MiB base64 in JSON.

- **What YouTube needs, verified 2026-09-15** (`developers.google.com`): the limited-input device flow — `POST https://oauth2.googleapis.com/device/code`, then polling `https://oauth2.googleapis.com/token` at the interval it names until the person confirms or the code expires (typically 1800 s) — is allowed for the `https://www.googleapis.com/auth/youtube` scope, which `videos.insert` accepts; the OAuth client must be of the *TVs and Limited Input devices* type. The upload is a resumable session: `POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=…` with the metadata and `X-Upload-Content-Length`/`X-Upload-Content-Type` headers answers a `Location` session URI on the same host; `PUT`s to it carry `Content-Range: bytes a-b/total` in chunks of a multiple of 256 KiB, all but the last the same size; `308` with a `Range` header says what arrived; `201` carries the video. The session URI is on `www.googleapis.com`, the API's host — no second host for YouTube.

- **Bytes are CCGW blobs**, content-addressed, streamed by `GET /v1/blobs/{hash}` (`binary-content.md`); the kernel can read one without the shell holding it.

- **The redirect flow is deferred.** A platform without a device flow (Instagram, TikTok, LinkedIn, X, …) needs a callback on an `https` origin of the instance; that flow and the TLS question it carries are their own `BO` change when such a platform is next. User decision, 2026-09-15.

## Intent

* **An `oauth` credential kind** in the kernel's secret store. The kernel obtains the token by the device flow, keeps the refresh token beside it encrypted at rest, renews the access token when it expires, and presents it as `Authorization: Bearer`; a caller of the broker sees no difference from an `apiKey` party.

* **The device flow is the sign-in.** The party's row in Settings holds the provider's client id and client secret as the party's fields and offers *Sign in*: the row shows the user code and the verification URL, the person confirms on any device, the kernel polls until the provider answers or the code expires, and the row moves to `verified` or says why not. The probe is the same test every party has, run with the access token.

* **Headers travel through the broker.** A request may carry headers of its own (`Content-Range`, `X-Upload-Content-Length`, `X-Upload-Content-Type`), and the answer carries the destination's `Location` and `Range` beside its status and body, so a resumable session can be opened, driven and resumed from the shell.

* **A streamed body from a blob.** The broker takes `body: {blob: "sha256:<hex>", range?: [a, b]}` and streams the object, or that slice of it, from CCGW to the destination with the `Content-Length` the slice has; the shell never holds the bytes. User decision, 2026-09-15.

* **A path outside the address but on its host is allowed** when the party declares it: YouTube's upload lives under `/upload/youtube/v3` beside the API's `/youtube/v3`. A party's record names the path prefixes its requests may use; the broker refuses any other, as it refuses another host today.

* **No plaintext leaves the kernel**: client secrets, refresh tokens and access tokens are values the store never answers, the same rule every party already follows.

* **A platform that needs an API key for one endpoint and a token for another is two parties.** A party has one credential kind. Decided here rather than asked: nothing in the first three kinds needs both.

## The Shape

- The party record gains `credential: "oauth"` with a provider block: the device authorization and token endpoints, the scopes, and the client id and client secret as secret fields. `PUT …/parties/<party>` merges it as it merges any record.

- `POST …/parties/<party>/sign-in` starts the device flow and answers `{ userCode, verificationUrl, expiresAt }`; `GET` on the record reports the flow's state (`awaiting`, `verified`, `failing` with the provider's reason). The kernel polls on its own until the outcome.

- Renewal happens inside the broker on a known expiry or on a `401`, once, before the request is repeated; a refresh that fails moves the record to `failing`.

- The broker's request gains `headers` (a map the kernel forwards, `Authorization` and `Content-Length` never among them) and answers `x-calliopa-party-location` and `x-calliopa-party-range` beside `x-calliopa-party-status`; the shell's `kernelSecrets.request` carries both ways.

- The settings extension's row for an `oauth` party (`CA` half, enumerated in `src/extensions/settings/docs/system/channels.md`): the client id and secret fields, *Sign in*, the code and URL while `awaiting`, the state after.

- The kernel's verification against a stub authorization server and a stub destination: a device flow to `verified`, an expired code to `failing`, a renewal before a request, a refused renewal, a request's headers arriving and the answer's `Location` and `Range` coming back, a streamed blob slice arriving intact with the right `Content-Length`, a path outside the declared prefixes refused.

## Out Of Scope

- The redirect flow and TLS on the instance.

- Any platform kind: `PU_0005` brings YouTube on top of this.
