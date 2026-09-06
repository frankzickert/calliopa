import type postgres from "postgres";

import { readRecordAtDestination, type RecordAtDestination } from "./publications";

/**
 * A destination binding: what one record is worth at one destination.
 *
 * It holds the values authored for that destination and nothing the record
 * itself carries. What was observed back — when it was published, what state it
 * is in — stays in the publication log and is read from there, so there is
 * never a second copy to disagree with the history.
 */

export const BOUND_KINDS = ["episode", "serial", "character", "category"] as const;
export type BoundKind = (typeof BOUND_KINDS)[number];

const SLUG = /^[a-z0-9-]+$/;
const ROOT_ADDRESS = /^\/[a-z0-9/-]*$/;

export interface Binding {
  readonly recordId: string;
  readonly recordKind: BoundKind;
  readonly channel: string;
  readonly slug: string | null;
  readonly listed: boolean | null;
  readonly rootAddress: string | null;
  readonly colour: string | null;
}

/** A binding beside what the log says has happened to it. */
export interface BoundRecord {
  readonly binding: Binding;
  readonly at: RecordAtDestination;
  /**
   * Whether the slug may still be edited in place. It may until the record has
   * been published at this destination; after that the address is a permanent
   * citation target and changing it is a retirement and a new publication.
   */
  readonly slugIsSettled: boolean;
}

export type BindingOutcome<T> =
  | { readonly outcome: "success"; readonly result: T }
  | { readonly outcome: "refused"; readonly rule: string; readonly detail: string };

const refuse = <T>(rule: string, detail: string): BindingOutcome<T> => ({
  outcome: "refused",
  rule,
  detail,
});

interface BindingRow {
  readonly record_id: string;
  readonly record_kind: BoundKind;
  readonly channel: string;
  readonly slug: string | null;
  readonly listed: boolean | null;
  readonly root_address: string | null;
  readonly colour: string | null;
}

const toBinding = (row: BindingRow): Binding => ({
  recordId: row.record_id,
  recordKind: row.record_kind,
  channel: row.channel,
  slug: row.slug,
  listed: row.listed,
  rootAddress: row.root_address,
  colour: row.colour,
});

export interface BindingInput {
  readonly recordId: string;
  readonly recordKind: BoundKind;
  readonly channel: string;
  readonly slug?: string;
  readonly listed?: boolean;
  readonly rootAddress?: string | null;
  readonly colour?: string;
}

/**
 * Checks what the record kind may carry before anything reaches the database.
 * The table refuses the same things; this is what names the rule.
 */
function shapeRefusal(input: BindingInput): BindingOutcome<never> | null {
  const addressed = input.recordKind !== "category";

  if (addressed) {
    if (input.slug === undefined) {
      return refuse("slugRequired", `A ${input.recordKind} binding carries a slug.`);
    }
    if (!SLUG.test(input.slug)) {
      return refuse(
        "slugShape",
        `A slug is lowercase letters, digits and hyphens; ${input.slug} is not.`,
      );
    }
    if (input.colour !== undefined) {
      return refuse(
        "colourIsACategorys",
        "Only a category binding carries a colour, because only a category has one value that depends on a destination's ground.",
      );
    }
  } else if (input.slug !== undefined) {
    return refuse(
      "categoryHasNoAddress",
      "A category is a fact about assets rather than a destination, so it takes no address.",
    );
  }

  if (input.recordKind !== "serial") {
    if (input.listed !== undefined) {
      return refuse(
        "listingIsASerials",
        "Listing is a serial's. An episode inherits its home serial's, so it carries none of its own.",
      );
    }
    if (input.rootAddress !== undefined && input.rootAddress !== null) {
      return refuse("rootAddressIsASerials", "Only a serial declares a root address.");
    }
  }
  if (
    input.rootAddress !== undefined &&
    input.rootAddress !== null &&
    !ROOT_ADDRESS.test(input.rootAddress)
  ) {
    return refuse(
      "rootAddressShape",
      `A root address is a site-relative path; ${input.rootAddress} is not.`,
    );
  }
  return null;
}

export async function readBinding(
  db: postgres.Sql,
  input: { readonly recordId: string; readonly channel: string },
): Promise<Binding | null> {
  const [row] = await db<BindingRow[]>`
    select * from destination_binding
    where record_id = ${input.recordId} and channel = ${input.channel}
  `;
  return row === undefined ? null : toBinding(row as BindingRow);
}

/** Every binding for one record, so a reader can see everywhere it stands. */
export async function readBindings(
  db: postgres.Sql,
  recordId: string,
): Promise<readonly Binding[]> {
  const rows = await db<BindingRow[]>`
    select * from destination_binding where record_id = ${recordId}
    order by channel
  `;
  return rows.map(toBinding);
}

/**
 * The binding beside the log's answers about it, which is what a surface needs
 * to say both what was authored and what happened.
 */
export async function readBoundRecord(
  db: postgres.Sql,
  input: { readonly recordId: string; readonly channel: string },
): Promise<BoundRecord | null> {
  const binding = await readBinding(db, input);
  if (binding === null) return null;
  const at = await readRecordAtDestination(db, input);
  return { binding, at, slugIsSettled: at.firstPublishedAt !== null };
}

/**
 * Creates or updates a binding.
 *
 * A slug may be changed until the record has been published at this
 * destination. After that the address is a permanent citation target: the
 * destination reserves it forever and answers a retired one with a tombstone,
 * so changing it is a retirement and a publication at a new address rather than
 * an edit, and every link already pasted anywhere would resolve to the
 * tombstone. It is refused here rather than warned about.
 */
export async function writeBinding(
  db: postgres.Sql,
  input: BindingInput,
): Promise<BindingOutcome<Binding>> {
  const shape = shapeRefusal(input);
  if (shape !== null) return shape;

  const existing = await readBinding(db, input);
  if (existing !== null && input.slug !== undefined && input.slug !== existing.slug) {
    const at = await readRecordAtDestination(db, input);
    if (at.firstPublishedAt !== null) {
      return refuse(
        "slugIsSettled",
        `${existing.slug} is published at ${input.channel} and its address is permanent. Retire it there and publish at ${input.slug} rather than renaming it.`,
      );
    }
  }

  const taken = await db<{ record_id: string }[]>`
    select record_id from destination_binding
    where channel = ${input.channel}
      and record_kind = ${input.recordKind}
      and slug = ${input.slug ?? null}
      and record_id <> ${input.recordId}
  `;
  if (taken.length > 0) {
    return refuse(
      "slugTaken",
      `${input.slug} is already the address of another ${input.recordKind} at ${input.channel}.`,
    );
  }

  const [row] = await db<BindingRow[]>`
    insert into destination_binding (
      record_id, record_kind, channel, slug, listed, root_address, colour
    ) values (
      ${input.recordId}, ${input.recordKind}, ${input.channel},
      ${input.slug ?? null}, ${input.listed ?? null},
      ${input.rootAddress ?? null}, ${input.colour ?? null}
    )
    on conflict (record_id, channel) do update set
      slug = excluded.slug,
      listed = excluded.listed,
      root_address = excluded.root_address,
      colour = excluded.colour,
      updated_at = now()
    returning *
  `;
  return { outcome: "success", result: toBinding(row as BindingRow) };
}

/**
 * Where a record is still live. Deleting a record is refused while this answers
 * anything, because the harm is a page the author believes is gone that is
 * still being served.
 */
export async function liveAt(
  db: postgres.Sql,
  recordId: string,
): Promise<readonly string[]> {
  const bindings = await readBindings(db, recordId);
  const live: string[] = [];
  for (const binding of bindings) {
    const at = await readRecordAtDestination(db, {
      recordId,
      channel: binding.channel,
    });
    if (at.state === "published") live.push(binding.channel);
  }
  return live;
}

/** Removes a binding. Only legal while the record is live nowhere. */
export async function removeBinding(
  db: postgres.Sql,
  input: { readonly recordId: string; readonly channel: string },
): Promise<BindingOutcome<null>> {
  const at = await readRecordAtDestination(db, input);
  if (at.state === "published") {
    return refuse(
      "liveAtDestination",
      `This record is live at ${input.channel}. Retire it there before removing what it is bound as.`,
    );
  }
  await db`
    delete from destination_binding
    where record_id = ${input.recordId} and channel = ${input.channel}
  `;
  return { outcome: "success", result: null };
}
