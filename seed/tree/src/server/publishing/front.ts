import type postgres from "postgres";

import type { BindingOutcome } from "./bindings";
import { readFrontAtDestination } from "./publications";

/**
 * A front binding: what a destination shows as itself.
 *
 * It is a binding like any other — authored values for one destination, with
 * everything observed left to the publication log — except that it is keyed by
 * the destination alone. A front is that destination's own document and no
 * record here stands behind it.
 *
 * The values are homepage's vocabulary, which is deliberate: a flagship scene,
 * an entry serial and a wall mean something at that destination and nowhere
 * else, and a record in the work layer carrying them would be its document
 * mirrored into content. The hero's picture is the exception and stays an
 * ordinary asset, because the bytes and the log need it to be one.
 */

export interface Front {
  readonly channel: string;
  readonly headline: string | null;
  readonly line: string | null;
  readonly heroAsset: string | null;
  readonly flagshipEpisode: string | null;
  readonly flagshipScene: string | null;
  readonly entrySerial: string | null;
  readonly wall: readonly string[];
}

/**
 * What a write may say about a front. An omitted field is left as it stands and
 * an explicit `null` clears it, so a surface editing one value at a time never
 * has to send back the values it is not editing.
 */
export interface FrontInput {
  readonly channel: string;
  readonly headline?: string | null;
  readonly line?: string | null;
  readonly heroAsset?: string | null;
  readonly flagshipEpisode?: string | null;
  readonly flagshipScene?: string | null;
  readonly entrySerial?: string | null;
  readonly wall?: readonly string[];
}

const refuse = <T>(rule: string, detail: string): BindingOutcome<T> => ({
  outcome: "refused",
  rule,
  detail,
});

interface FrontRow {
  readonly channel: string;
  readonly headline: string | null;
  readonly line: string | null;
  readonly hero_asset: string | null;
  readonly flagship_episode: string | null;
  readonly flagship_scene: string | null;
  readonly entry_serial: string | null;
  readonly wall: readonly string[];
}

const toFront = (row: FrontRow): Front => ({
  channel: row.channel,
  headline: row.headline,
  line: row.line,
  heroAsset: row.hero_asset,
  flagshipEpisode: row.flagship_episode,
  flagshipScene: row.flagship_scene,
  entrySerial: row.entry_serial,
  wall: row.wall,
});

/**
 * What is refused before anything reaches the database. The table refuses the
 * blank values too; this is what names the rule instead of raising a constraint.
 *
 * What a *complete* front must carry is not checked here. A front is written
 * over time, and refusing to store a half-written one would make the surface
 * unusable for the work it exists for; the projection refuses an incomplete one
 * at the point where it would be published.
 */
function shapeRefusal(input: FrontInput): BindingOutcome<never> | null {
  for (const [field, value] of [
    ["headline", input.headline],
    ["line", input.line],
  ] as const) {
    if (typeof value === "string" && value.trim() === "") {
      return refuse(
        "valueNotWritten",
        `A ${field} that is present and empty is not a ${field}. Clear it or write one.`,
      );
    }
  }
  if (input.wall !== undefined) {
    const seen = new Set(input.wall);
    if (seen.size !== input.wall.length) {
      return refuse(
        "wallRepeats",
        "The wall names one episode twice, and a wall that showed the same episode twice would be the surface saying it twice.",
      );
    }
  }
  return null;
}

async function channelExists(db: postgres.Sql, channel: string): Promise<boolean> {
  const rows = await db<{ party: string }[]>`
    select party from connection where party = ${channel}
  `;
  return rows.length > 0;
}

export async function readFront(
  db: postgres.Sql,
  channel: string,
): Promise<Front | null> {
  const [row] = await db<FrontRow[]>`
    select * from front_binding where channel = ${channel}
  `;
  return row === undefined ? null : toFront(row as FrontRow);
}

/**
 * Creates or revises a front.
 *
 * There is no rule here about a published front becoming permanent, which is
 * what a slug has: a front carries no address, the destination replaces it
 * whole on every write, and it is never retired. Revising one is an ordinary
 * edit however many times it has been published.
 */
export async function writeFront(
  db: postgres.Sql,
  input: FrontInput,
): Promise<BindingOutcome<Front>> {
  const shape = shapeRefusal(input);
  if (shape !== null) return shape;

  if (!(await channelExists(db, input.channel))) {
    return refuse(
      "noSuchChannel",
      `This instance has no ${input.channel} channel, so it has nothing to show a front at.`,
    );
  }

  const existing = await readFront(db, input.channel);
  const settled = <T>(given: T | undefined, held: T): T =>
    given === undefined ? held : given;
  const next: Front = {
    channel: input.channel,
    headline: settled(input.headline, existing?.headline ?? null),
    line: settled(input.line, existing?.line ?? null),
    heroAsset: settled(input.heroAsset, existing?.heroAsset ?? null),
    flagshipEpisode: settled(input.flagshipEpisode, existing?.flagshipEpisode ?? null),
    flagshipScene: settled(input.flagshipScene, existing?.flagshipScene ?? null),
    entrySerial: settled(input.entrySerial, existing?.entrySerial ?? null),
    wall: settled(input.wall, existing?.wall ?? []),
  };

  const [row] = await db<FrontRow[]>`
    insert into front_binding (
      channel, headline, line, hero_asset, flagship_episode, flagship_scene,
      entry_serial, wall
    ) values (
      ${next.channel}, ${next.headline}, ${next.line}, ${next.heroAsset},
      ${next.flagshipEpisode}, ${next.flagshipScene}, ${next.entrySerial},
      ${db.array([...next.wall])}::uuid[]
    )
    on conflict (channel) do update set
      headline = excluded.headline,
      line = excluded.line,
      hero_asset = excluded.hero_asset,
      flagship_episode = excluded.flagship_episode,
      flagship_scene = excluded.flagship_scene,
      entry_serial = excluded.entry_serial,
      wall = excluded.wall,
      updated_at = now()
    returning *
  `;
  return { outcome: "success", result: toFront(row as FrontRow) };
}

/**
 * The destinations whose live front names this record.
 *
 * Retiring or deleting one is refused while this answers anything. Homepage
 * checks that everything its front names is published at the moment of that
 * write and never again, and its retirement path does not read the front, so a
 * record retired after the front was written would leave the first thing an
 * arrival sees naming a tombstone. Calliopa is the only writer there, so this
 * is preventable here and nowhere else.
 */
export async function frontsNaming(
  db: postgres.Sql,
  recordId: string,
): Promise<readonly string[]> {
  const rows = await db<{ channel: string }[]>`
    select channel from front_binding
    where hero_asset = ${recordId}::uuid
       or flagship_episode = ${recordId}::uuid
       or flagship_scene = ${recordId}::uuid
       or entry_serial = ${recordId}::uuid
       or ${recordId}::uuid = any(wall)
    order by channel
  `;
  const naming: string[] = [];
  for (const row of rows) {
    const at = await readFrontAtDestination(db, row.channel);
    if (at.state === "published") naming.push(row.channel);
  }
  return naming;
}
