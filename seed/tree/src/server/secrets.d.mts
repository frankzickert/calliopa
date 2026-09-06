/** Types for `secrets.mjs`. The implementation is ESM so bare-Node scripts and
 * the compiled server share one account of how a stored secret opens. */

export class SecretsKeyError extends Error {
  constructor(detail: string);
}

export class StoredSecretError extends Error {
  constructor(detail: string, cause?: unknown);
}

export function parseSecretsKey(hex: string): Buffer;
export function encryptSecret(plain: string, key: Buffer): string;
export function decryptSecret(stored: string, key: Buffer): string;
