import type postgres from "postgres";

/**
 * The publication log: what actually happened at a destination.
 *
 * Append-only. An entry is added and never revised, so what the log says
 * happened is what happened, and every other surface that needs to know a
 * record's state at a destination reads it here rather than keeping a second
 * copy that could disagree with it.
 *
 * Nothing here reaches a destination. Delivery is the adapter's and the release
 * that performs it is `CA_0037_002`; this is the record it writes into.
 */

export const RECORD_KINDS = [
  "episode",
  "serial",
  "asset",
  "character",
  "category",
  "front",
] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

/** Publishing ends what a destination did not hold; retiring ends what it did. */
export const PUBLICATION_ACTS = ["publish", "retire"] as const;
export type PublicationAct = (typeof PUBLICATION_ACTS)[number];

export interface PublicationAttempt {
  /**
   * The record this was about, or null for a front. A front exists only at the
   * destination, so there is no record here for the entry to name; the channel
   * is what identifies it.
   */
  readonly recordId: string | null;
  readonly recordKind: RecordKind;
  /** Which episode an asset publication was for. */
  readonly episodeId?: string;
  readonly renditionId?: string;
  /** Every content-addressed object this publication sent. */
  readonly objectIds?: readonly string[];
  readonly channel: string;
  readonly act: PublicationAct;
}

export interface PublicationEntry extends PublicationAttempt {
  readonly id: string;
  readonly outcome: "succeeded" | "failed";
  readonly externalId: string | null;
  readonly detail: string | null;
  readonly at: string;
  readonly objectIds: readonly string[];
}

/**
 * What a record is at one destination.
 *
 * `never` and `retired` are the distinction an author most needs and the one a
 * blank panel destroys, so they are separate states rather than both being the
 * absence of a publication.
 */
export type DestinationState = "never" | "published" | "retired";

export interface RecordAtDestination {
  /** Null for a front, which is the one publication naming no record. */
  readonly recordId: string | null;
  readonly channel: string;
  readonly state: DestinationState;
  /** Set on the first success and never moved afterwards. */
  readonly firstPublishedAt: string | null;
  /** Moves with every successful publish. */
  readonly lastPublishedAt: string | null;
  /** What the destination holds, from the last successful publish. */
  readonly externalId: string | null;
  /** The most recent attempt, whatever it was and however it went. */
  readonly lastAttempt: PublicationEntry | null;
}

interface PublicationRow {
  readonly id: string;
  readonly record_id: string | null;
  readonly record_kind: RecordKind;
  readonly episode_id: string | null;
  readonly rendition_id: string | null;
  readonly object_ids: readonly string[];
  readonly channel: string;
  readonly act: PublicationAct;
  readonly outcome: "succeeded" | "failed";
  readonly external_id: string | null;
  readonly detail: string | null;
  readonly at: Date;
}

const toEntry = (row: PublicationRow): PublicationEntry => ({
  id: row.id,
  recordId: row.record_id,
  recordKind: row.record_kind,
  ...(row.episode_id === null ? {} : { episodeId: row.episode_id }),
  ...(row.rendition_id === null ? {} : { renditionId: row.rendition_id }),
  objectIds: row.object_ids,
  channel: row.channel,
  act: row.act,
  outcome: row.outcome,
  externalId: row.external_id,
  detail: row.detail,
  at: row.at.toISOString(),
});

/**
 * Records an attempt that reached the destination and was accepted. The
 * destination's own id for what it now holds is required, because an entry that
 * could not say what was published would not be worth keeping.
 */
export async function recordSuccess(
  db: postgres.Sql,
  input: PublicationAttempt & { readonly externalId: string },
): Promise<PublicationEntry> {
  return write(db, input, "succeeded", input.externalId, null);
}

/**
 * Records an attempt that did not land. A failure leaves an entry saying so
 * rather than nothing: a sequence that fails part-way is recorded as what
 * happened, and the reader is never left guessing whether anything was tried.
 */
export async function recordFailure(
  db: postgres.Sql,
  input: PublicationAttempt & { readonly detail: string },
): Promise<PublicationEntry> {
  return write(db, input, "failed", null, input.detail);
}

async function write(
  db: postgres.Sql,
  input: PublicationAttempt,
  outcome: "succeeded" | "failed",
  externalId: string | null,
  detail: string | null,
): Promise<PublicationEntry> {
  const [row] = await db<PublicationRow[]>`
    insert into publication (
      record_id, record_kind, episode_id, rendition_id, object_ids,
      channel, act, outcome, external_id, detail
    ) values (
      ${input.recordId}, ${input.recordKind}, ${input.episodeId ?? null},
      ${input.renditionId ?? null}, ${db.array([...(input.objectIds ?? [])])},
      ${input.channel}, ${input.act}, ${outcome}, ${externalId}, ${detail}
    )
    returning *
  `;
  return toEntry(row as PublicationRow);
}

/** Every entry for one record at one destination, most recent first. */
export async function readPublications(
  db: postgres.Sql,
  input: { readonly recordId: string; readonly channel: string },
): Promise<readonly PublicationEntry[]> {
  const rows = await db<PublicationRow[]>`
    select * from publication
    where record_id = ${input.recordId} and channel = ${input.channel}
    order by at desc, id desc
  `;
  return rows.map(toEntry);
}

/**
 * What a record is at one destination, derived from its entries rather than
 * stored beside them. A stored state is a second fact that can disagree with
 * the history it was supposed to summarise.
 */
export async function readRecordAtDestination(
  db: postgres.Sql,
  input: { readonly recordId: string; readonly channel: string },
): Promise<RecordAtDestination> {
  return stateOf(await readPublications(db, input), input.recordId, input.channel);
}

/** The derivation itself, over entries a caller has already selected. */
function stateOf(
  entries: readonly PublicationEntry[],
  recordId: string | null,
  channel: string,
): RecordAtDestination {
  const succeeded = entries.filter((entry) => entry.outcome === "succeeded");
  const lastSuccess = succeeded[0];
  const lastPublish = succeeded.find((entry) => entry.act === "publish");
  const publishes = succeeded.filter((entry) => entry.act === "publish");

  const state: DestinationState =
    lastSuccess === undefined
      ? "never"
      : lastSuccess.act === "retire"
        ? "retired"
        : "published";

  return {
    recordId,
    channel,
    state,
    firstPublishedAt: publishes[publishes.length - 1]?.at ?? null,
    lastPublishedAt: lastPublish?.at ?? null,
    externalId: lastPublish?.externalId ?? null,
    lastAttempt: entries[0] ?? null,
  };
}

/** Every entry for one destination's front, most recent first. */
export async function readFrontPublications(
  db: postgres.Sql,
  channel: string,
): Promise<readonly PublicationEntry[]> {
  const rows = await db<PublicationRow[]>`
    select * from publication
    where record_kind = 'front' and channel = ${channel}
    order by at desc, id desc
  `;
  return rows.map(toEntry);
}

/**
 * What a destination's front is, derived from its entries the way a record's
 * state is. It is never `retired`: a front is replaced rather than retired,
 * because a destination's root is not addressed by an id and holds nothing to
 * tombstone.
 */
export async function readFrontAtDestination(
  db: postgres.Sql,
  channel: string,
): Promise<RecordAtDestination> {
  return stateOf(await readFrontPublications(db, channel), null, channel);
}

/**
 * Every object any successful publication sent. These bytes are permanent: a
 * publication must always be able to say what it published, so the sweep never
 * removes one of them.
 */
export async function publishedObjectIds(
  db: postgres.Sql,
): Promise<ReadonlySet<string>> {
  const rows = await db<{ object_id: string }[]>`
    select distinct unnest(object_ids) as object_id
    from publication
    where outcome = 'succeeded'
  `;
  return new Set(rows.map((row) => row.object_id));
}
