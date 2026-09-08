# Settings

## Purpose

- This document is the authoritative description of Calliopa's instance-level settings: the settings surface, the connection records for the external parties Calliopa reaches out to, the distribution channels the author's work goes to, and the encrypted store their secrets live in.
- `CA_0021_FEAT_connections-and-credentials` is the originating change.
- [API Authentication](../../../../../docs/system/identity/api-authentication.md) is the inbound half: it proves who is calling Calliopa. This document is the outbound half: it holds the credentials Calliopa presents to someone else. They are two stores with two lifecycles and neither implements the other.
- [Workspace Shell](../../../../../docs/system/workspace/tabs.md) owns the header control, the `settings` tab kind, and the synthetic target that makes the settings tab an ordinary tab. This document owns what the tab holds.
- The kernel owns the key secrets are encrypted under since `BO_0207_013` (`ui-kernel.md`, `BO_0207_003`); `CALLIOPA_SECRETS_KEY` is no longer a required application variable. Before it, [Application Foundation](../../../../../docs/system/foundation/development-environment.md) owned it as a required variable and its generation during bootstrap. This document owns what the key protects.
- Every section here is implemented and verified. `honcho` is the one connection and `homepage` the one channel, and until a key is entered each holds none.

## Topics

- [Connections](./connections.md)
- [Channels](./channels.md)
- [Secret Storage](./secret-storage.md)
- [Settings Surface](./settings-surface.md)
- [Agent Sign In](./agent-sign-in.md)
