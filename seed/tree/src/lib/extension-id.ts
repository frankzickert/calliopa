/**
 * The extension id rule, the kernel's exactly (`extensions.IDRule`,
 * `BO_0224_001`): lowercase letters and digits, starting with a letter, in
 * parts joined by a dot or a hyphen. The form checks it before asking so a
 * refusal reads at once; the kernel checks it again and is the authority.
 * BO_0224_009
 */
export const EXTENSION_ID_RULE = /^[a-z][a-z0-9]*([.-][a-z0-9]+)*$/u;

export const EXTENSION_ID_WORDS =
  "lowercase letters and digits, starting with a letter, in parts joined by a dot or a hyphen";

export function isExtensionId(id: string): boolean {
  return EXTENSION_ID_RULE.test(id);
}
