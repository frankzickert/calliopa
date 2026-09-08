# Secret Storage

## Secret Storage

* A stored secret must never be readable from the application's API, and must never appear in `.env.dev` or in a log line.
* Since `BO_0207_013` the shell stores no secret itself: a party's record — configuration, secret fields, authorization, probe, state and last outcome — is kept by the kernel in its secret store on its data volume, encrypted at rest under the kernel's own `kernel_secrets_key` (`ui-kernel.md`, `BO_0207_003`), and the shell reaches it only through the kernel's endpoints, which answer everything but the values.

- The kernel encrypts a party's record with AES-256-GCM under its key, 32 bytes as hex, generated once by the bootstrap one-shot and never rotated by it. The shell's own encryption under `CALLIOPA_SECRETS_KEY` (`src/server/secrets.mjs`) is retired with the `connection` table; what follows describes it as it was. Secrets were encrypted with AES-256-GCM under `CALLIOPA_SECRETS_KEY`, 32 bytes as hex. The stored form carries its own initialization vector and authentication tag beside the ciphertext, so a row holds everything needed to open it with the key and nothing without it.
- The authentication tag is what makes a tampered row fail loudly instead of decrypting to something else. That is why the mode is GCM rather than a bare cipher.
- This uses Node's own `crypto` and adds no dependency, as the inbound half's verifier does.
- Rotating `CALLIOPA_SECRETS_KEY` invalidates every stored secret, because nothing re-encrypts them. That is acceptable for a development instance where re-entering a key is a minute's work, and it is stated rather than discovered.
- A malformed key is refused where it is parsed, naming the variable and the expected shape, rather than failing later inside the cipher.
- `src/server/secrets.ts` holds it: `parseSecretsKey` refuses a key that is not 32 bytes as hex by naming the variable and the shape, `encryptSecret` writes `iv.tag.ciphertext` with each part base64, and `decryptSecret` opens one or throws. A wrong key and a tampered row are the same event to a caller — the row does not open — so both answer one `StoredSecretError` carrying the cipher's own error as its cause. Unit coverage proves a round trip, a refused key of the wrong length and the wrong alphabet, one secret encrypting to two different stored forms, a stored form another key cannot open, a tampered initialization vector, tag, or ciphertext failing rather than answering, and a malformed stored form refused before the cipher sees it (`CA_0021_002`).


