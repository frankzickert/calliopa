import type { IconName } from "~/components/shell/icons";

/**
 * What a model is called and what it wears (`BO_0273_035`, `BO_0273_037`).
 *
 * Server-free on purpose: the settings view and the senders both read it, and
 * a view that reached into a server module would drag the request context into
 * the browser bundle — which is what the contract's two halves exist to stop.
 */

/** The short names, kept here because the vendors' ids are not readable. */
const SHORT: Readonly<Record<string, string>> = {
  gpt_image_2: "GPT Image",
  gpt_image_2_5: "GPT Image 2.5",
  seedream_v5_pro: "Seedream",
  seedance_2_0_mini: "Seedance mini",
  seedance_2_5: "Seedance",
  "byte-plus-seedream-5-pro": "Seedream",
  "byte-plus-seedance-2-mini": "Seedance mini",
};

/** A model the table does not name — a job type the owner typed — keeps its own id. */
export const shortName = (model: string): string => SHORT[model] ?? model;

/** What a model wears when the owner has not said: a picture, or a moving one. */
export const iconFor = (kind: string): IconName => (kind === "video" ? "film-strip" : "image");

/**
 * The icons an owner may choose from, a short list of the shell's own: the
 * contract refuses a name its table does not hold, so the choice is offered
 * rather than typed.
 */
export const ICONS: readonly IconName[] = [
  "image",
  "film-strip",
  "sparkle",
  "presentation",
  "lightbulb",
  "robot",
];

/** The icon a model wears: the owner's if it is one the shell holds, else its kind's. */
export const chosenIcon = (given: string | undefined, kind: string): IconName =>
  given !== undefined && (ICONS as readonly string[]).includes(given)
    ? (given as IconName)
    : iconFor(kind);
