import { kernelState } from "~/server/kernel/client";

import { modelOptions, roster, type OfferedModel, type ServiceView } from "./media";

/**
 * Which models the dropdown offers (`BO_0273_029`).
 *
 * The service answers everything it can validate; the owner says which of those
 * are worth offering. The record is the extension's settings, which the kernel
 * keeps and only the owner may write — so the choice is the instance's, not a
 * person's, and the dropdown does not have to ask who is looking.
 *
 * **An empty set means everything.** A fresh instance offers what the services
 * answer rather than nothing, and an owner who has never chosen has not
 * accidentally turned the extension off.
 */

const RECORD = "media";

export interface OfferedSet {
  readonly id: string;
  /** `"<service>:<model>"` for each model the owner offers. Empty means all. */
  readonly models: readonly string[];
  /** Higgsfield job types the owner named, because that set is open. */
  readonly named: readonly string[];
  /**
   * What the owner calls a model, by `"<service>:<model>"` (`BO_0273_037`).
   * Absent leaves the extension's own short name, and a job type the owner
   * typed has none to leave — nothing can name that for them.
   */
  readonly names?: Readonly<Record<string, string>>;
  /** The icon the owner gave a model, by the same key. Absent follows its kind. */
  readonly icons?: Readonly<Record<string, string>>;
  /**
   * What each model takes, captured from the vendor when the owner offered it
   * and kept here (`BO_0279_011`). Keyed as the rest are. A model absent from
   * this has axes nobody could read, which is not a reason to hide it: a press
   * then sends no options and the vendor applies its own defaults
   * (`BO_0279_014`).
   */
  readonly axes?: Readonly<Record<string, readonly CapturedAxis[]>>;
}

/** One axis as the service reported it. `BO_0279_001` decides the shape. */
export interface CapturedAxis {
  readonly axis: string;
  readonly values: readonly string[];
  readonly default: string | null;
}

const empty: OfferedSet = { id: RECORD, models: [], named: [], names: {}, icons: {}, axes: {} };

/** The captured axes of one model, keeping only what is shaped like an axis. */
const axesOf = (value: unknown): Readonly<Record<string, readonly CapturedAxis[]>> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const kept: Record<string, readonly CapturedAxis[]> = {};
  for (const [key, held] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(held)) continue;
    const axes = held.filter(
      (one): one is CapturedAxis =>
        one !== null && typeof one === "object" &&
        typeof (one as CapturedAxis).axis === "string" &&
        Array.isArray((one as CapturedAxis).values),
    );
    if (axes.length > 0) kept[key] = axes;
  }
  return kept;
};

/** A record of strings, keeping only the entries that are strings. */
const table = (value: unknown): Record<string, string> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const kept: Record<string, string> = {};
  for (const [key, held] of Object.entries(value as Record<string, unknown>)) {
    if (typeof held === "string" && held.trim() !== "") kept[key] = held.trim();
  }
  return kept;
};

export const offeredKey = (service: string, model: string): string => `${service}:${model}`;

export async function readOffered(): Promise<OfferedSet> {
  const held = await kernelState.read<OfferedSet>("settings", RECORD);
  if (held === null) return empty;
  return {
    id: RECORD,
    models: Array.isArray(held.models) ? held.models.filter((one) => typeof one === "string") : [],
    named: Array.isArray(held.named) ? held.named.filter((one) => typeof one === "string") : [],
    names: table(held.names),
    icons: table(held.icons),
    axes: axesOf(held.axes),
  };
}

/** The owner's alone: the kernel refuses anyone else, so nothing here checks. */
export async function writeOffered(input: {
  models: readonly string[];
  named: readonly string[];
  names?: Readonly<Record<string, unknown>>;
  icons?: Readonly<Record<string, unknown>>;
  /** What each offered model takes, as the vendor last described it. BO_0279_011 */
  axes?: Readonly<Record<string, unknown>>;
}): Promise<OfferedSet> {
  const record: OfferedSet = {
    id: RECORD,
    models: [...new Set(input.models.filter((one) => typeof one === "string" && one !== ""))],
    named: [...new Set(input.named.filter((one) => typeof one === "string" && one.trim() !== "").map((one) => one.trim()))],
    names: table(input.names),
    icons: table(input.icons),
    axes: axesOf(input.axes),
  };
  await kernelState.write("settings", record);
  return record;
}

/**
 * Asks the vendor what each offered model takes, and keeps it (`BO_0279_011`).
 *
 * Run when the owner sets a model up and whenever the Generators section is
 * opened, never on the path of a press: a description is a few hundred
 * milliseconds and both CLIs cache on disk, but a menu must not wait on a
 * vendor. A model the vendor will not describe keeps whatever was captured
 * before, or none — it is offered either way (`BO_0279_014`).
 */
export async function captureAxes(only?: string): Promise<OfferedSet> {
  const [services, held] = await Promise.all([offeredRoster(), readOffered()]);
  const keys: string[] = [];
  for (const service of services) {
    for (const model of service.models) {
      const key = offeredKey(service.service, model.model);
      if (only === undefined || only === key) keys.push(key);
    }
  }
  const asked = await Promise.all(
    keys.map(async (key) => {
      const cut = key.indexOf(":");
      const described = await modelOptions(key.slice(0, cut), key.slice(cut + 1));
      return [key, described.axes.map((axis) => ({
        axis: axis.axis,
        values: axis.values,
        default: axis.default,
      }))] as const;
    }),
  );
  const axes: Record<string, readonly CapturedAxis[]> = { ...(held.axes ?? {}) };
  for (const [key, captured] of asked) {
    // Nothing read leaves what was read before rather than forgetting it: a
    // vendor down for a minute must not empty a menu.
    if (captured.length > 0) axes[key] = captured;
  }
  return writeOffered({
    models: held.models,
    named: held.named,
    names: held.names ?? {},
    icons: held.icons ?? {},
    axes,
  });
}

/**
 * The roster as the dropdown should show it: the services, each carrying only
 * the models the owner offers, plus any job type they named for an open set.
 */
export async function offeredRoster(): Promise<readonly ServiceView[]> {
  const [services, offered] = await Promise.all([roster(), readOffered()]);
  const all = offered.models.length === 0;
  return services.map((service) => {
    const kept = service.models.filter((model) => all || offered.models.includes(offeredKey(service.service, model.model)));
    // A named job type belongs to whichever service has an open set for it;
    // today that is Higgsfield's video, and the roster says which.
    const openKind = Object.entries(service.openSet).find(([, open]) => open)?.[0];
    const named: OfferedModel[] =
      openKind === undefined
        ? []
        : offered.named
            .filter((model) => !kept.some((one) => one.model === model))
            .map((model) => ({ model, kind: openKind === "video" ? "video" : "image", default: false }));
    return { ...service, models: [...kept, ...named] };
  });
}
