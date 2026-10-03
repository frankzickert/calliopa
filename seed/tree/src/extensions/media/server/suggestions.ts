import type { SuggestionAnswer, SuggestionSource } from "~/contract";
import { INPUT_KINDS } from "~/extensions/structures/lib/structures";

import { modelOptions, roster, SERVICES, type ModelAxis } from "./media";

/**
 * What a format's fields suggest (`calliopa-bootstrap`'s `BO_0336_020`): the
 * services signed in, the chosen service's models that make the format's
 * type, and the chosen model's axes as the vendor describes them. A field is
 * never limited to them — a value typed is sent as typed, and a vendor that
 * does not take it says so in its own words.
 *
 * The vendor is asked when a field opens its suggestions, never on the path
 * of *Send*, and each model's description is kept in this process, per
 * service and model, so the next field to open does not wait on the vendor.
 * Kept here rather than in the extension's settings, since that record is the
 * owner's to write and anyone who edits a format opens these. A description
 * that could not be read leaves the one kept before. Technical decision at
 * implementation, 2026-10-02.
 */

const NAMES: Readonly<Record<string, string>> = { higgsfield: "Higgsfield", openart: "OpenArt" };

/** The axes the service reports a format's ratio under. */
export const RATIO_AXES: readonly string[] = ["aspect-ratio"];

/**
 * The axes a format's quality is read from, in the order one is taken: the
 * resolution where the model has one — *1k*, *1080p* — else its quality.
 */
export const QUALITY_AXES: readonly string[] = ["resolution", "quality"];

const described = new Map<string, readonly ModelAxis[]>();

const keyOf = (service: string, model: string): string => `${service}:${model}`;

/** What one model takes, asked of the vendor and kept, or what was kept. */
async function axesOf(service: string, model: string): Promise<{ axes: readonly ModelAxis[]; reason?: string }> {
  const answer = await modelOptions(service, model);
  if (answer.axes.length > 0) {
    described.set(keyOf(service, model), answer.axes);
    return { axes: answer.axes };
  }
  const kept = described.get(keyOf(service, model));
  if (kept !== undefined) return { axes: kept };
  return { axes: [], ...(answer.reason === undefined ? {} : { reason: answer.reason }) };
}

/**
 * The axis a format's quality is sent under for a model: the first of
 * `QUALITY_AXES` its kept description holds, and `resolution` when nothing was
 * kept, which is what the format's examples are. Read without asking the
 * vendor, since this is on the path of *Send*.
 */
export function qualityAxisOf(service: string, model: string): string {
  const kept = described.get(keyOf(service, model)) ?? [];
  return QUALITY_AXES.find((axis) => kept.some((one) => one.axis === axis)) ?? "resolution";
}

/** Forgets what was kept, for a test. */
export function forgetDescriptions(): void {
  described.clear();
}

const text = (value: string | undefined): string => (value ?? "").trim();

/** The services a format may name: those signed in, Codex never among them,
 * since it makes nothing yet (`BO_0320_014`). */
async function providers(): Promise<SuggestionAnswer> {
  const services = await roster();
  if (services.length === 0) return { suggestions: [], note: "The media service is not answering." };
  const signedIn = services.filter((one) => one.signedIn && (SERVICES as readonly string[]).includes(one.service));
  if (signedIn.length === 0) return { suggestions: [], note: "Nothing is signed in: sign in to Higgsfield or OpenArt in Settings." };
  return { suggestions: signedIn.map((one) => ({ value: one.service, label: NAMES[one.service] ?? one.service })) };
}

/** The chosen service's models that make the format's type, under the
 * vendor's own names. */
async function models(values: Readonly<Record<string, string>>): Promise<SuggestionAnswer> {
  const provider = text(values["provider"]);
  if (provider === "") return { suggestions: [], note: "Choose a provider first." };
  const services = await roster();
  if (services.length === 0) return { suggestions: [], note: "The media service is not answering." };
  const service = services.find((one) => one.service === provider);
  if (service === undefined) return { suggestions: [], note: `There is no ${provider} service on this instance.` };
  if (!service.signedIn) return { suggestions: [], note: service.reason ?? `Sign in to ${NAMES[provider] ?? provider} in Settings.` };
  const type = text(values["type"]);
  const kind = type === "image" || type === "video" ? type : null;
  return { suggestions: service.models.filter((one) => kind === null || one.kind === kind).map((one) => ({ value: one.model })) };
}

/** The chosen model's values on the first of these axes it takes. */
const axis =
  (names: readonly string[], what: string) =>
  async (values: Readonly<Record<string, string>>): Promise<SuggestionAnswer> => {
    const provider = text(values["provider"]);
    const model = text(values["model"]);
    if (provider === "" || model === "") return { suggestions: [], note: "Choose a provider and a model first." };
    const read = await axesOf(provider, model);
    if (read.axes.length === 0) return { suggestions: [], note: read.reason ?? `${model} did not say what it takes.` };
    const found = names.map((name) => read.axes.find((one) => one.axis === name)).find((one) => one !== undefined);
    if (found === undefined) return { suggestions: [], note: `${model} takes no ${what}.` };
    return {
      suggestions: found.values.map((value) => ({ value, ...(value === found.default ? { label: `${value} (the model's own)` } : {}) })),
    };
  };

/** An input's name from its kind (`ME_0002_013`): the alias a vendor's
 * prompt names it by, `@start` for a start frame. */
async function inputName(values: Readonly<Record<string, string>>): Promise<SuggestionAnswer> {
  const kind = INPUT_KINDS.find((one) => one.label === text(values["kind"]));
  if (kind === undefined) return { suggestions: [], note: "Choose the input's kind first." };
  return { suggestions: [{ value: kind.role }] };
}

export const SUGGESTION_SOURCES: readonly SuggestionSource[] = [
  { name: "provider", label: "Generation services signed in", answer: providers },
  { name: "model", label: "The provider's models", answer: models },
  { name: "ratio", label: "The model's ratios", answer: axis(RATIO_AXES, "ratio") },
  { name: "quality", label: "The model's qualities", answer: axis(QUALITY_AXES, "quality") },
  { name: "inputName", label: "An input's name, from its kind", answer: inputName },
];
