/**
 * A new block's identity, minted in the browser: a version 4 UUID, the form
 * the server checks a split's tail against (`CA_0045_004`).
 *
 * It is built from `crypto.getRandomValues`, which a browser offers in any
 * context. `crypto.randomUUID` exists only in a secure one, so on an instance
 * served over plain HTTP at its network address it is missing, and Enter
 * ended in a `TypeError` before the split was drawn. DO_0003_001
 */
export function newBlockId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
