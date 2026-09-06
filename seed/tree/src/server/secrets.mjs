import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Secrets at rest: AES-256-GCM under `CALLIOPA_SECRETS_KEY`, 32 bytes as hex.
 * The stored form is `iv.tag.ciphertext`, each base64, so a row carries all it
 * needs to be opened with the key and nothing without it. GCM is what makes a
 * tampered row fail loudly instead of opening to something else.
 *
 * This is ESM with a sibling `secrets.d.mts`, for the reason
 * `api-clients.mjs` is: `pnpm run dev` reads the memory key under bare Node
 * while the server is compiled TypeScript, and neither may hold a second copy
 * of how a stored secret opens.
 */
const KEY_BYTES = 32;
const IV_BYTES = 12;
const KEY_PATTERN = new RegExp(`^[0-9a-fA-F]{${KEY_BYTES * 2}}$`, "u");

export class SecretsKeyError extends Error {
  constructor(detail) {
    super(`CALLIOPA_SECRETS_KEY ${detail}`);
    this.name = "SecretsKeyError";
  }
}

export class StoredSecretError extends Error {
  constructor(detail, cause) {
    super(`A stored secret ${detail}`, { cause });
    this.name = "StoredSecretError";
  }
}

/** The key is refused here, by name, rather than failing later inside a cipher. */
export function parseSecretsKey(hex) {
  const value = hex.trim();
  if (!KEY_PATTERN.test(value)) {
    throw new SecretsKeyError(
      `must be ${KEY_BYTES} bytes as ${KEY_BYTES * 2} hex characters`,
    );
  }
  return Buffer.from(value, "hex");
}

export function encryptSecret(plain, key) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body]
    .map((part) => part.toString("base64"))
    .join(".");
}

export function decryptSecret(stored, key) {
  const parts = stored.split(".");
  if (parts.length !== 3) {
    throw new StoredSecretError("is malformed");
  }
  const [iv, tag, body] = parts.map((part) => Buffer.from(part, "base64"));
  if (iv === undefined || tag === undefined || body === undefined) {
    throw new StoredSecretError("is malformed");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString(
      "utf8",
    );
  } catch (error) {
    // A wrong key and a tampered row are the same event to a caller: the row
    // does not open. The cause carries the detail for whoever reads the log.
    throw new StoredSecretError("could not be opened", error);
  }
}
