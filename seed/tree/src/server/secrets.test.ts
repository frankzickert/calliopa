import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  SecretsKeyError,
  StoredSecretError,
  decryptSecret,
  encryptSecret,
  parseSecretsKey,
} from "./secrets.mjs";

const key = () => parseSecretsKey(randomBytes(32).toString("hex"));

/** Replaces one part of `iv.tag.ciphertext` with different bytes of the same length. */
function tamper(stored: string, part: 0 | 1 | 2): string {
  const parts = stored.split(".");
  const bytes = Buffer.from(parts[part] ?? "", "base64");
  bytes[0] = (bytes[0] ?? 0) ^ 0xff;
  parts[part] = bytes.toString("base64");
  return parts.join(".");
}

describe("the secrets key", () => {
  it("Given 32 bytes as hex, When the key is read, Then it is accepted with surrounding space ignored", () => {
    const hex = randomBytes(32).toString("hex");

    expect(parseSecretsKey(` ${hex}\n`)).toEqual(Buffer.from(hex, "hex"));
  });

  it("Given a key of the wrong length, When it is read, Then it is refused by name", () => {
    expect(() => parseSecretsKey(randomBytes(16).toString("hex"))).toThrow(
      SecretsKeyError,
    );
    expect(() => parseSecretsKey("")).toThrow(
      /CALLIOPA_SECRETS_KEY must be 32 bytes as 64 hex characters/u,
    );
  });

  it("Given a key outside the hex alphabet, When it is read, Then it is refused", () => {
    expect(() => parseSecretsKey("z".repeat(64))).toThrow(SecretsKeyError);
  });
});

describe("a secret at rest", () => {
  it("Given a secret, When it is encrypted, Then the stored form carries no plaintext", () => {
    const stored = encryptSecret("sk-proj-not-a-real-key", key());

    expect(stored).not.toContain("sk-proj-not-a-real-key");
    expect(stored.split(".")).toHaveLength(3);
  });

  it("Given a stored secret, When it is opened with its key, Then the secret returns", () => {
    const secretsKey = key();

    expect(decryptSecret(encryptSecret("sk-a-b-c", secretsKey), secretsKey)).toBe(
      "sk-a-b-c",
    );
  });

  it("Given one secret encrypted twice, When the stored forms are compared, Then they differ", () => {
    const secretsKey = key();

    expect(encryptSecret("same", secretsKey)).not.toBe(
      encryptSecret("same", secretsKey),
    );
  });

  it("Given another key, When a stored secret is opened, Then it does not open", () => {
    expect(() => decryptSecret(encryptSecret("sk-a-b-c", key()), key())).toThrow(
      StoredSecretError,
    );
  });

  it("Given a tampered initialization vector, tag, or ciphertext, When it is opened, Then it fails rather than answers", () => {
    const secretsKey = key();
    const stored = encryptSecret("sk-a-b-c", secretsKey);

    for (const part of [0, 1, 2] as const) {
      expect(() => decryptSecret(tamper(stored, part), secretsKey)).toThrow(
        StoredSecretError,
      );
    }
  });

  it("Given a malformed stored form, When it is opened, Then it is refused rather than throwing from the cipher", () => {
    expect(() => decryptSecret("not-a-stored-secret", key())).toThrow(
      /A stored secret is malformed/u,
    );
  });
});
