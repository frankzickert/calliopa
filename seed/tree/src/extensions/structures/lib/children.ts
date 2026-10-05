import type { FieldDeclaration, FieldValue } from "./structures";

/**
 * A field's children (`calliopa-bootstrap`'s `BO_0349`): a block dropped on a
 * structured block is nested into its focused work and put into the field the
 * person chose. The field holds the block itself, so editing the child is
 * editing the value and nothing is copied (`BO_0349_Q9`); a field holds
 * several, in the order they were put in (`BO_0349_Q12`).
 */

/** The children stored on a `roleFields` node: block ids per field key. */
export type StoredChildren = Readonly<Record<string, readonly string[]>>;

/** The children as stored, reading only what is a list of ids. */
export function childrenFrom(value: unknown): Record<string, string[]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const children: Record<string, string[]> = {};
  for (const [key, held] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(held)) continue;
    const ids = held.filter((one): one is string => typeof one === "string");
    if (ids.length > 0) children[key] = ids;
  }
  return children;
}

/** Whether putting a child into this field starts a run: a field whose kind
 * is not text has its value proposed, read off the child (`BO_0349_Q10`). */
export const startsRun = (field: FieldDeclaration): boolean =>
  field.type !== "text" && field.type !== "longText" && field.type !== "reference";

/**
 * The values a structure reads as, its children counted: a text field reads
 * its children's words in order, a long text field as paragraphs, a reference
 * as the list of them. A value typed before stays stored beneath and is read
 * again once no child is left. A field of any other kind keeps its own value,
 * which a run proposes. A child whose words did not read is left out.
 */
export function valuesWithChildren(
  fields: readonly FieldDeclaration[],
  values: Readonly<Record<string, FieldValue>>,
  children: StoredChildren,
  words: ReadonlyMap<string, string>,
): Record<string, FieldValue> {
  const read: Record<string, FieldValue> = { ...values };
  for (const field of fields) {
    if (startsRun(field)) continue;
    const standing = (children[field.key] ?? []).filter((id) => words.has(id));
    if (standing.length === 0) continue;
    if (field.type === "reference") read[field.key] = standing;
    else read[field.key] = standing.map((id) => words.get(id) ?? "").join(field.type === "longText" ? "\n\n" : " ");
  }
  return read;
}
