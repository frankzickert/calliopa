import type { DocumentView } from "../documents/assemble";
import type { AssetView, EpisodeView } from "../production/assemble";
import type { AssetRole } from "../production/vocabulary";
import {
  Refusals,
  type Destination,
  type EpisodeSubmission,
  type FrontSubmission,
  type Projected,
} from "./destinations";

/**
 * The `../homepage` destination.
 *
 * That repository owns its contract, serves it at `GET /v1/contract/author`,
 * and validates at its own boundary. This is Calliopa's model of it: the
 * projection onto homepage's document and the pre-validation that refuses
 * locally what homepage would refuse remotely, naming the same rule. Homepage's
 * boundary stays the truth regardless of what is checked here.
 *
 * Homepage takes a whole episode, because it is the site the author controls.
 */

export const HOMEPAGE_CHANNEL = "homepage";

/** Homepage slots assets by their role within the world, not by media type. */
export type HomepageRole = "scene" | "fragments" | "stills" | "prose";

/**
 * Calliopa's production roles project onto homepage's four. A production role
 * says what the author made an asset as; homepage's says what part it plays on
 * a page, and a destination mapping is exactly this translation.
 */
const ROLE_MAP: Readonly<Record<AssetRole, HomepageRole>> = {
  "complete-episode": "scene",
  "main-video": "scene",
  teaser: "fragments",
  crossover: "fragments",
  blooper: "fragments",
  "cinematic-image": "stills",
  statement: "stills",
  "image-teaser": "stills",
  "field-note": "prose",
};

export interface HomepageBlock {
  readonly type: "text" | "divider";
  readonly role?: string;
  readonly runs?: readonly {
    readonly text: string;
    readonly marks?: readonly string[];
    readonly link?: string;
  }[];
}

interface HomepageAssetCommon {
  readonly id: string;
  readonly label?: string;
  /** Homepage takes one point of view per asset, not a list. */
  readonly category?: string;
}

export interface HomepageFilm extends HomepageAssetCommon {
  readonly video: string;
  readonly transcript: string;
  readonly durationSeconds: number;
  readonly width: number;
  readonly height: number;
}

export interface HomepageStill extends HomepageAssetCommon {
  readonly media: string;
  readonly alt: string;
}

export interface HomepageProse extends HomepageAssetCommon {
  readonly title: string;
  readonly body: readonly HomepageBlock[];
}

export interface HomepageTeaser {
  readonly wide: string;
  readonly vertical: string;
  readonly square: string;
  readonly alt: string;
  /** The line that travels. Homepage carries it inside the teaser. */
  readonly text: string;
}

/**
 * The document `PUT /v1/episodes/{id}` accepts. Assets are grouped by the role
 * they play on the page rather than carrying a role field, which is homepage's
 * shape and not a translation of Calliopa's: the id is in the path, so the
 * document carries none.
 */
export interface HomepageEpisode {
  readonly title: string;
  readonly premise: string;
  readonly teaser: HomepageTeaser;
  readonly homeSerial?: string;
  readonly position?: number;
  readonly alsoIn: readonly string[];
  readonly characters: readonly string[];
  readonly scenes: readonly HomepageFilm[];
  readonly fragments: readonly HomepageFilm[];
  readonly stills: readonly HomepageStill[];
  readonly prose: readonly HomepageProse[];
}

const TEASER_FORMATS = [
  { name: "wide", aspect: "16:9" },
  { name: "vertical", aspect: "9:16" },
  { name: "square", aspect: "1:1" },
] as const;

/** Homepage takes one point of view per asset; Calliopa allows any number. */
function categoryOf(
  asset: AssetView,
  submission: EpisodeSubmission,
  refusals: Refusals,
): string | undefined {
  if (asset.categories.length === 0) return undefined;
  if (asset.categories.length > 1) {
    // Never silently pick one: a publish that drops an authored point of view
    // is a publish that lies about the work. Homepage widening its field to a
    // list is what removes this refusal.
    refusals.refuse(
      "oneCategoryPerAsset",
      `Asset ${asset.assetId} carries ${asset.categories.length} categories and homepage takes one.`,
    );
    return undefined;
  }
  const category = asset.categories[0] as { categoryId: string; label: string };
  const bound = submission.referenced.get(category.categoryId);
  if (bound === undefined) {
    refusals.refuse(
      "unpublishedCategory",
      `Asset ${asset.assetId} carries the category ${category.label}, which has no binding at homepage. A category is published before anything naming it.`,
    );
    return undefined;
  }
  return category.categoryId;
}

const common = (
  asset: AssetView,
  category: string | undefined,
): HomepageAssetCommon => ({
  id: asset.assetId,
  ...(asset.label === null ? {} : { label: asset.label }),
  ...(category === undefined ? {} : { category }),
});

function toBlocks(document: DocumentView, refusals: Refusals): HomepageBlock[] {
  const blocks: HomepageBlock[] = [];
  for (const block of document.blocks) {
    if (block.kind === "divider") {
      blocks.push({ type: "divider" });
      continue;
    }
    if (block.kind !== "text") {
      // A block this build cannot read is not silently dropped from a publish.
      refusals.refuse(
        "unsupportedBlock",
        `The document ${document.title} holds a block this build cannot read, so it cannot be published without losing it.`,
      );
      continue;
    }
    blocks.push({
      type: "text",
      role: block.role,
      runs: block.runs.map((run) => ({
        text: run.text,
        ...(run.marks === undefined || run.marks.length === 0
          ? {}
          : { marks: [...run.marks] }),
        ...(run.link === undefined ? {} : { link: run.link }),
      })),
    });
  }
  return blocks;
}

function projectFilm(
  asset: AssetView,
  submission: EpisodeSubmission,
  refusals: Refusals,
  role: "scene" | "fragment",
): HomepageFilm | null {
  const category = categoryOf(asset, submission, refusals);
  const rendition = asset.renditions[0];
  if (rendition === undefined) {
    refusals.refuse(
      "noExport",
      `Asset ${asset.assetId} is a ${role} and carries no export, so there is nothing to publish.`,
    );
    return null;
  }
  if (asset.durationSeconds === null) {
    refusals.refuse(
      "filmNeedsDuration",
      `Asset ${asset.assetId} is a ${role} and carries no duration; homepage refuses one without it.`,
    );
  }
  if (asset.transcript === null) {
    refusals.refuse(
      "filmNeedsTranscript",
      `Asset ${asset.assetId} is a ${role} and carries no transcript; homepage refuses one without it.`,
    );
  }
  // Homepage holds only the video's id at its host and stores no bytes, so a
  // film cannot be published until its bytes are at that host and it has an id
  // from there. A Garage object id is not one: sending it would publish a
  // reference that resolves to nothing. The upload that mints a real one is
  // `CA_0033_010`, and until it exists a film is refused rather than published
  // broken.
  refusals.refuse(
    "filmNeedsItsHostId",
    `Asset ${asset.assetId} is a ${role} and has not been uploaded to the video host, so homepage has no id to hold for it.`,
  );
  if (asset.durationSeconds === null || asset.transcript === null) return null;
  return {
    ...common(asset, category),
    video: rendition.objectId,
    transcript: asset.transcript,
    durationSeconds: Math.round(asset.durationSeconds),
    width: rendition.width,
    height: rendition.height,
  };
}

function projectStill(
  asset: AssetView,
  submission: EpisodeSubmission,
  refusals: Refusals,
): HomepageStill | null {
  const category = categoryOf(asset, submission, refusals);
  const rendition = asset.renditions[0];
  if (rendition === undefined) {
    refusals.refuse(
      "noExport",
      `Asset ${asset.assetId} is a still and carries no export, so there is nothing to publish.`,
    );
    return null;
  }
  if (asset.altText === null) {
    refusals.refuse(
      "stillNeedsAltText",
      `Asset ${asset.assetId} is a still and carries no alt text; homepage refuses one without it.`,
    );
    return null;
  }
  return { ...common(asset, category), media: rendition.objectId, alt: asset.altText };
}

function projectProse(
  asset: AssetView,
  submission: EpisodeSubmission,
  refusals: Refusals,
): HomepageProse | null {
  const category = categoryOf(asset, submission, refusals);
  if (asset.bodyDocumentId === null) {
    refusals.refuse(
      "proseNeedsABody",
      `Asset ${asset.assetId} is prose and carries no body document.`,
    );
    return null;
  }
  const document = submission.documents.get(asset.bodyDocumentId);
  if (document === undefined) {
    refusals.refuse(
      "proseBodyMissing",
      `The body document of asset ${asset.assetId} could not be read.`,
    );
    return null;
  }
  // A prose asset's name is its body document's title. The block model permits
  // an empty title and homepage does not, so it is refused here rather than
  // remotely.
  if (document.title.trim() === "") {
    refusals.refuse(
      "proseNeedsATitle",
      `The body document of asset ${asset.assetId} is untitled, and homepage requires a title on prose.`,
    );
    return null;
  }
  return {
    ...common(asset, category),
    title: document.title,
    body: toBlocks(document, refusals),
  };
}

function projectTeaser(
  episode: EpisodeView,
  refusals: Refusals,
): Omit<HomepageTeaser, "text"> | null {
  if (episode.teaserAssetId === null) {
    refusals.refuse(
      "teaserRequired",
      "Homepage requires a teaser, and this episode names no asset as its teaser.",
    );
    return null;
  }
  const teaser = episode.assets.find(
    (asset) => asset.assetId === episode.teaserAssetId,
  );
  if (teaser === undefined) {
    refusals.refuse(
      "teaserNotHeld",
      "The asset this episode names as its teaser is not among the assets it holds.",
    );
    return null;
  }
  if (teaser.altText === null) {
    refusals.refuse(
      "teaserNeedsAltText",
      "A teaser carries alt text, because it is the picture a machine and a screen reader meet first.",
    );
  }

  const found: Record<string, string> = {};
  for (const format of TEASER_FORMATS) {
    const rendition = teaser.renditions.find(
      (candidate) => candidate.aspect === format.aspect,
    );
    if (rendition === undefined) {
      refusals.refuse(
        "teaserFormatMissing",
        `The teaser carries no ${format.aspect} export, and homepage requires ${format.name}.`,
      );
      continue;
    }
    found[format.name] = rendition.objectId;
  }
  const { wide, vertical, square } = found;
  if (
    wide === undefined ||
    vertical === undefined ||
    square === undefined ||
    teaser.altText === null
  ) {
    return null;
  }
  return { wide, vertical, square, alt: teaser.altText };
}

/**
 * Projects an episode onto homepage's document, or answers every rule it
 * breaks. Every rule rather than the first: an author fixing a publish wants
 * the whole list rather than a conversation.
 */
export function projectEpisode(
  submission: EpisodeSubmission,
): Projected<HomepageEpisode> {
  const refusals = new Refusals();
  const { episode, binding } = submission;

  refusals.require(
    binding.slug !== null,
    "slugRequired",
    "An episode needs an address at homepage before it can be published there.",
  );
  const premise = episode.premise ?? "";
  const teaserText = episode.teaserText ?? "";
  refusals.require(
    premise.trim() !== "",
    "premiseRequired",
    "Homepage requires a premise and never derives one, because it is what every card and door renders.",
  );
  refusals.require(
    teaserText.trim() !== "",
    "teaserTextRequired",
    "Homepage requires a teaser text, which is the line that travels where the premise does not.",
  );

  const teaserImage = projectTeaser(episode, refusals);

  const addressOf = (recordId: string, what: string): string | null => {
    const bound = submission.referenced.get(recordId);
    if (bound === undefined || bound.slug === null) {
      refusals.refuse(
        "unpublishedReference",
        `This episode names ${what}, which has no address at homepage. It is published before the episode naming it.`,
      );
      return null;
    }
    return bound.slug;
  };

  const homeSerial =
    episode.homeSerial === null
      ? null
      : addressOf(episode.homeSerial.serialId, `the serial ${episode.homeSerial.name}`);
  const alsoIn = episode.alsoIn
    .map((serial) => addressOf(serial.serialId, `the serial ${serial.name}`))
    .filter((slug): slug is string => slug !== null);
  const characters = episode.characters
    .map((character) =>
      addressOf(character.characterId, `the character ${character.name}`),
    )
    .filter((slug): slug is string => slug !== null);

  // The teaser is the teaser and nothing else: it does not also appear among
  // the stills, because one picture in two places is the page saying it twice.
  const held = episode.assets.filter(
    (asset) => asset.assetId !== episode.teaserAssetId,
  );

  const scenes: HomepageFilm[] = [];
  const fragments: HomepageFilm[] = [];
  const stills: HomepageStill[] = [];
  const prose: HomepageProse[] = [];

  for (const asset of held) {
    const slot = ROLE_MAP[asset.role];
    if (slot === "scene" || slot === "fragments") {
      const film = projectFilm(
        asset,
        submission,
        refusals,
        slot === "scene" ? "scene" : "fragment",
      );
      if (film !== null) (slot === "scene" ? scenes : fragments).push(film);
      continue;
    }
    if (slot === "stills") {
      const still = projectStill(asset, submission, refusals);
      if (still !== null) stills.push(still);
      continue;
    }
    const piece = projectProse(asset, submission, refusals);
    if (piece !== null) prose.push(piece);
  }

  if (refusals.any || teaserImage === null || binding.slug === null) {
    return { ok: false, refusals: refusals.refusals };
  }

  return {
    ok: true,
    document: {
      title: episode.title,
      premise,
      teaser: { ...teaserImage, text: teaserText },
      ...(homeSerial === null ? {} : { homeSerial }),
      ...(episode.position === null ? {} : { position: episode.position }),
      alsoIn,
      characters,
      scenes,
      fragments,
      stills,
      prose,
    },
  };
}


/**
 * The document `PUT /v1/site` accepts: homepage's front.
 *
 * It is written whole, has no id, and replaces what was there. Its hero reuses
 * the teaser's three formats because the hero is full-bleed at a different
 * shape on a phone and on a desktop and that surface crops nothing; it carries
 * no teaser text, because the hero has a line of its own.
 */
export interface HomepageFront {
  readonly hero: {
    readonly headline: string;
    readonly media: {
      readonly wide: string;
      readonly vertical: string;
      readonly square: string;
      readonly alt: string;
    };
    readonly line: string;
    readonly flagship: { readonly episode: string; readonly scene: string };
  };
  readonly entrySerial: string;
  readonly wall: readonly string[];
}

/** The three formats the hero shares with a teaser, found on one asset. */
function heroMedia(
  hero: AssetView | null,
  refusals: Refusals,
): HomepageFront["hero"]["media"] | null {
  if (hero === null) {
    refusals.refuse(
      "heroRequired",
      "Homepage requires a hero image, and this front names none that could be read.",
    );
    return null;
  }
  if (hero.medium !== "image") {
    refusals.refuse(
      "heroIsAnImage",
      `The hero is a ${hero.medium} asset. Homepage's hero is an image and never a loop, because a loop could only come from the video host and that host is not contacted before a reader presses play.`,
    );
    return null;
  }
  if (hero.altText === null) {
    refusals.refuse(
      "heroNeedsAltText",
      "The hero carries no alt text, and it is the picture a machine and a screen reader meet first.",
    );
  }

  const found: Record<string, string> = {};
  for (const format of TEASER_FORMATS) {
    const rendition = hero.renditions.find(
      (candidate) => candidate.aspect === format.aspect,
    );
    if (rendition === undefined) {
      refusals.refuse(
        "heroFormatMissing",
        `The hero carries no ${format.aspect} export, and homepage requires ${format.name}.`,
      );
      continue;
    }
    found[format.name] = rendition.objectId;
  }
  const { wide, vertical, square } = found;
  if (
    wide === undefined ||
    vertical === undefined ||
    square === undefined ||
    hero.altText === null
  ) {
    return null;
  }
  return { wide, vertical, square, alt: hero.altText };
}

/**
 * Projects a front onto homepage's site document, or answers every rule it
 * breaks.
 *
 * Everything it names must already be live there. Homepage checks that at the
 * moment of the write, so this is the same rule read early rather than a
 * stricter one — except that it is also what stops a front being written
 * against a record that was retired since it was chosen.
 */
export function projectFront(submission: FrontSubmission): Projected<HomepageFront> {
  const refusals = new Refusals();
  const { front } = submission;

  const headline = front.headline ?? "";
  const line = front.line ?? "";
  refusals.require(
    headline.trim() !== "",
    "headlineRequired",
    "Homepage requires a headline, which is the first line an arrival reads.",
  );
  refusals.require(
    line.trim() !== "",
    "lineRequired",
    "Homepage requires a line under the headline, and it is also what a pasted link to the site unfurls as.",
  );

  const media = heroMedia(submission.hero, refusals);

  /** An address at this destination, for something that is live there now. */
  const addressOf = (recordId: string | null, what: string): string | null => {
    if (recordId === null) {
      refusals.refuse("frontIsIncomplete", `This front names no ${what}.`);
      return null;
    }
    const bound = submission.referenced.get(recordId);
    if (bound === undefined || bound.slug === null) {
      refusals.refuse(
        "unpublishedReference",
        `This front names ${what} that has no address at homepage. It is published before the front naming it.`,
      );
      return null;
    }
    if (!submission.published.has(recordId)) {
      refusals.refuse(
        "unpublishedReference",
        `The ${what} this front names is not live at homepage, and homepage refuses a front naming anything it is not serving.`,
      );
      return null;
    }
    return bound.slug;
  };

  const flagship = addressOf(front.flagshipEpisode, "flagship episode");
  const entrySerial = addressOf(front.entrySerial, "entry serial");
  const wall = front.wall
    .map((episodeId) => addressOf(episodeId, `wall episode ${episodeId}`))
    .filter((slug): slug is string => slug !== null);

  // The entry serial is the left door, which invites someone to start at the
  // beginning of something. An unordered serial has no beginning.
  if (submission.entrySerial !== null && !submission.entrySerial.ordered) {
    refusals.refuse(
      "entrySerialIsOrdered",
      `${submission.entrySerial.name} is unordered, and homepage's entry point leads to the beginning of a serial.`,
    );
  }

  // The hero plays one film large and scenes are unranked, so the front names
  // which one rather than leaving the surface to derive it from list order.
  const scene = front.flagshipScene;
  if (scene === null) {
    refusals.refuse(
      "frontIsIncomplete",
      "This front names no flagship scene, and homepage's hero plays one film large.",
    );
  } else if (submission.flagship !== null) {
    const held = submission.flagship.assets.find((asset) => asset.assetId === scene);
    if (held === undefined) {
      refusals.refuse(
        "flagshipSceneNotHeld",
        `The scene this front names is not among the assets ${submission.flagship.title} holds.`,
      );
    } else if (ROLE_MAP[held.role] !== "scene") {
      refusals.refuse(
        "flagshipSceneIsAScene",
        `The scene this front names is a ${held.role}, which homepage does not slot as a scene.`,
      );
    } else if (submission.flagship.teaserAssetId === scene) {
      refusals.refuse(
        "flagshipSceneIsAScene",
        "The scene this front names is that episode's teaser, which is published as its teaser and not among its scenes.",
      );
    }
  }

  if (
    refusals.any ||
    media === null ||
    flagship === null ||
    entrySerial === null ||
    scene === null
  ) {
    return { ok: false, refusals: refusals.refusals };
  }

  return {
    ok: true,
    document: {
      hero: { headline, media, line, flagship: { episode: flagship, scene } },
      entrySerial,
      wall,
    },
  };
}

export const homepage: Destination<HomepageEpisode, HomepageFront> = {
  channel: HOMEPAGE_CHANNEL,
  units: ["episode", "front"],
  projectEpisode,
  projectFront,
};
