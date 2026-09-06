import type postgres from "postgres";

import { readDocument } from "../documents/documents";
import type { DocumentView } from "../documents/assemble";
import { readObject } from "../object-store";
import { readAsset, readEpisode, readSerial } from "../production/production";
import { readBinding, type Binding } from "./bindings";
import { channelAccess, ensureMedia, putFront, putRecord, retireRecord } from "./client";
import { frontsNaming, readFront } from "./front";
import { HOMEPAGE_CHANNEL, projectEpisode, projectFront } from "./homepage";
import {
  readRecordAtDestination,
  recordFailure,
  recordSuccess,
  type PublicationEntry,
} from "./publications";

/**
 * The release: a person selects what goes and where, and this performs it.
 *
 * Every publication is a human act, so nothing here decides that something
 * should go out. What it owns is the order: gather, project, put the media
 * there, deliver, and record. Every attempt is recorded whether it landed or
 * not, because a sequence that fails part-way is recorded as what happened
 * rather than as nothing.
 */

export interface ReleaseOutcome {
  readonly released: boolean;
  readonly entry: PublicationEntry | null;
  /** Everything the projection refused, when it refused. */
  readonly refusals: readonly { readonly rule: string; readonly detail: string }[];
  readonly detail: string | null;
}

const notReleased = (
  detail: string,
  refusals: readonly { readonly rule: string; readonly detail: string }[] = [],
): ReleaseOutcome => ({ released: false, entry: null, refusals, detail });

/**
 * Publishes one episode to homepage.
 *
 * The projection is run before anything reaches the network, so an episode that
 * homepage would refuse never becomes a request. A projection refusal is not
 * logged as a failed publication: nothing was attempted, and an entry saying a
 * publication failed when none was made would be a false record.
 */
export async function releaseEpisodeToHomepage(
  db: postgres.Sql,
  key: Buffer,
  episodeId: string,
): Promise<ReleaseOutcome> {
  const episode = await readEpisode(db, episodeId);
  if (episode.outcome !== "success") {
    return notReleased(`No episode ${episodeId} to release.`);
  }
  const binding = await readBinding(db, {
    recordId: episodeId,
    channel: HOMEPAGE_CHANNEL,
  });
  if (binding === null) {
    return notReleased(
      `This episode has no address at ${HOMEPAGE_CHANNEL}. Bind it before releasing it.`,
    );
  }

  // Everything the episode names needs its own address there, so their
  // bindings are gathered before the projection rather than discovered by it.
  const referenced = new Map<string, Binding>();
  const names = [
    ...(episode.result.homeSerial === null ? [] : [episode.result.homeSerial.serialId]),
    ...episode.result.alsoIn.map((serial) => serial.serialId),
    ...episode.result.characters.map((character) => character.characterId),
    ...episode.result.assets.flatMap((asset) =>
      asset.categories.map((category) => category.categoryId),
    ),
  ];
  for (const recordId of new Set(names)) {
    const bound = await readBinding(db, { recordId, channel: HOMEPAGE_CHANNEL });
    if (bound !== null) referenced.set(recordId, bound);
  }

  const documents = new Map<string, DocumentView>();
  for (const asset of episode.result.assets) {
    if (asset.bodyDocumentId === null) continue;
    const document = await readDocument(db, asset.bodyDocumentId);
    if (document.outcome === "success") {
      documents.set(asset.bodyDocumentId, document.result);
    }
  }

  const projected = projectEpisode({
    episode: episode.result,
    binding,
    referenced,
    documents,
  });
  if (!projected.ok) {
    return notReleased(
      "Homepage would refuse this episode, so nothing was sent.",
      projected.refusals,
    );
  }

  const access = await channelAccess(db, key, HOMEPAGE_CHANNEL);
  if ("missing" in access) return notReleased(access.missing);

  const slug = binding.slug as string;
  const attempt = {
    recordId: episodeId,
    recordKind: "episode" as const,
    channel: HOMEPAGE_CHANNEL,
    act: "publish" as const,
  };

  // Media goes first: homepage refuses a record naming media it does not hold.
  // The teaser's three formats are media as much as the stills are, so every
  // object the document names is sent rather than only the obvious ones.
  const { teaser } = projected.document;
  const objectIds = [
    teaser.wide,
    teaser.vertical,
    teaser.square,
    ...projected.document.stills.map((still) => still.media),
  ].filter((objectId, index, all) => all.indexOf(objectId) === index);

  // What each object's bytes are is the rendition's own fact, so the type is
  // read from it rather than assumed from the slot it landed in.
  const contentTypes = new Map<string, string>();
  for (const asset of episode.result.assets) {
    for (const rendition of asset.renditions) {
      contentTypes.set(rendition.objectId, rendition.contentType);
    }
  }

  for (const objectId of objectIds) {
    const bytes = await readObject(objectId);
    const put = await ensureMedia(access, {
      objectId,
      bytes,
      contentType: contentTypes.get(objectId) ?? "application/octet-stream",
    });
    if (!put.ok) {
      const entry = await recordFailure(db, {
        ...attempt,
        objectIds,
        detail: `media ${objectId}: ${put.detail}`,
      });
      return { released: false, entry, refusals: [], detail: put.detail };
    }
  }

  const delivered = await putRecord(access, {
    collection: "episodes",
    slug,
    document: projected.document,
  });
  if (!delivered.ok) {
    const entry = await recordFailure(db, {
      ...attempt,
      objectIds,
      detail: delivered.detail,
    });
    return { released: false, entry, refusals: [], detail: delivered.detail };
  }

  const entry = await recordSuccess(db, {
    ...attempt,
    objectIds,
    externalId: delivered.result.externalId,
  });
  return { released: true, entry, refusals: [], detail: null };
}


/**
 * Publishes homepage's front.
 *
 * The same order every release takes — gather, project, put the media there,
 * deliver, record — over a document that names records instead of holding them.
 * What it names is read rather than trusted, so a front pointing at something
 * that was retired since it was chosen is refused here rather than published
 * against a tombstone.
 */
export async function releaseFrontToHomepage(
  db: postgres.Sql,
  key: Buffer,
): Promise<ReleaseOutcome> {
  const front = await readFront(db, HOMEPAGE_CHANNEL);
  if (front === null) {
    return notReleased(
      `Nothing has been written for ${HOMEPAGE_CHANNEL}'s front, so there is nothing to publish.`,
    );
  }

  const hero = front.heroAsset === null ? null : await readAsset(db, front.heroAsset);
  const flagship =
    front.flagshipEpisode === null ? null : await readEpisode(db, front.flagshipEpisode);
  const entrySerial =
    front.entrySerial === null ? null : await readSerial(db, front.entrySerial);

  const named = [front.flagshipEpisode, front.entrySerial, ...front.wall].filter(
    (recordId): recordId is string => recordId !== null,
  );
  const referenced = new Map<string, Binding>();
  const published = new Set<string>();
  for (const recordId of new Set(named)) {
    const bound = await readBinding(db, { recordId, channel: HOMEPAGE_CHANNEL });
    if (bound !== null) referenced.set(recordId, bound);
    const at = await readRecordAtDestination(db, { recordId, channel: HOMEPAGE_CHANNEL });
    if (at.state === "published") published.add(recordId);
  }

  const projected = projectFront({
    front,
    hero,
    flagship: flagship?.outcome === "success" ? flagship.result : null,
    entrySerial,
    referenced,
    published,
  });
  if (!projected.ok) {
    return notReleased(
      "Homepage would refuse this front, so nothing was sent.",
      projected.refusals,
    );
  }

  const access = await channelAccess(db, key, HOMEPAGE_CHANNEL);
  if ("missing" in access) return notReleased(access.missing);

  const attempt = {
    recordId: null,
    recordKind: "front" as const,
    channel: HOMEPAGE_CHANNEL,
    act: "publish" as const,
  };

  const { media } = projected.document.hero;
  const objectIds = [media.wide, media.vertical, media.square].filter(
    (objectId, index, all) => all.indexOf(objectId) === index,
  );
  const contentTypes = new Map(
    (hero?.renditions ?? []).map((rendition) => [
      rendition.objectId,
      rendition.contentType,
    ]),
  );

  for (const objectId of objectIds) {
    const bytes = await readObject(objectId);
    const put = await ensureMedia(access, {
      objectId,
      bytes,
      contentType: contentTypes.get(objectId) ?? "application/octet-stream",
    });
    if (!put.ok) {
      const entry = await recordFailure(db, {
        ...attempt,
        objectIds,
        detail: `media ${objectId}: ${put.detail}`,
      });
      return { released: false, entry, refusals: [], detail: put.detail };
    }
  }

  const delivered = await putFront(access, projected.document);
  if (!delivered.ok) {
    const entry = await recordFailure(db, {
      ...attempt,
      objectIds,
      detail: delivered.detail,
    });
    return { released: false, entry, refusals: [], detail: delivered.detail };
  }

  const entry = await recordSuccess(db, {
    ...attempt,
    objectIds,
    externalId: delivered.result.externalId,
  });
  return { released: true, entry, refusals: [], detail: null };
}

/**
 * Retires an episode at homepage.
 *
 * Retiring is a publication like any other: a deliberate act against one
 * destination, recorded in the log. The address stays reserved there forever
 * and answers a tombstone, which is what stops a citation coming to mean
 * something else.
 */
export async function retireEpisodeAtHomepage(
  db: postgres.Sql,
  key: Buffer,
  episodeId: string,
): Promise<ReleaseOutcome> {
  const binding = await readBinding(db, {
    recordId: episodeId,
    channel: HOMEPAGE_CHANNEL,
  });
  if (binding === null || binding.slug === null) {
    return notReleased(`This episode has no address at ${HOMEPAGE_CHANNEL}.`);
  }
  const at = await readRecordAtDestination(db, {
    recordId: episodeId,
    channel: HOMEPAGE_CHANNEL,
  });
  if (at.state !== "published") {
    return notReleased(
      at.state === "never"
        ? `This episode has never been published at ${HOMEPAGE_CHANNEL}, so there is nothing to retire.`
        : `This episode is already retired at ${HOMEPAGE_CHANNEL}.`,
    );
  }

  // Retiring what the live front names would leave the first thing an arrival
  // sees pointing at a tombstone, and that destination would not notice.
  const fronts = await frontsNaming(db, episodeId);
  if (fronts.length > 0) {
    return notReleased(
      `The front at ${fronts.join(", ")} names this episode. Point that front elsewhere before retiring it.`,
    );
  }

  const access = await channelAccess(db, key, HOMEPAGE_CHANNEL);
  if ("missing" in access) return notReleased(access.missing);

  const attempt = {
    recordId: episodeId,
    recordKind: "episode" as const,
    channel: HOMEPAGE_CHANNEL,
    act: "retire" as const,
  };
  const retired = await retireRecord(access, {
    collection: "episodes",
    slug: binding.slug,
  });
  if (!retired.ok) {
    const entry = await recordFailure(db, { ...attempt, detail: retired.detail });
    return { released: false, entry, refusals: [], detail: retired.detail };
  }
  const entry = await recordSuccess(db, {
    ...attempt,
    externalId: retired.result.externalId,
  });
  return { released: true, entry, refusals: [], detail: null };
}
