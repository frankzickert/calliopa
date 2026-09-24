import type { SendOutcome, SendQuote, SendRequest, SenderAxis, SenderDescriptor } from "~/contract";
import { call } from "~/server/kernel/client";

import { makeGeneration, promptOf } from "./make";
import { chosenIcon, shortName } from "../lib/models";
import { captureAxes, offeredKey, offeredRoster, readOffered, type CapturedAxis } from "./offered";

/**
 * The generators, in the agent menu (`BO_0273_035`).
 *
 * A model stands beside the agents and a block is sent to it the way a block
 * is sent to an agent: **the press on *Send* is the whole gesture**, and it is
 * the press that spends. What it costs is reported after — on the process
 * while it runs, and on the picture's own panel afterwards — which replaces
 * the two-press confirmation (user decision, 2026-09-22, superseding the one
 * of 2026-09-21).
 *
 * Each model carries a short name and an icon of its own, because it has no
 * face and a borrowed one would say it was an agent. The extension names the
 * models it knows and the owner may rename any of them and choose its icon
 * (`BO_0273_037`) — which is the only way a job type they typed themselves can
 * be called anything but its raw id.
 */

const PREFIX = "media";

export const senderId = (service: string, model: string): string => `${PREFIX}:${service}:${model}`;

/** `media:<service>:<model>`, or null for an id this extension did not offer. */
export const senderParts = (id: string): { service: string; model: string } | null => {
  if (!id.startsWith(`${PREFIX}:`)) return null;
  const rest = id.slice(PREFIX.length + 1);
  const cut = rest.indexOf(":");
  if (cut <= 0 || cut === rest.length - 1) return null;
  return { service: rest.slice(0, cut), model: rest.slice(cut + 1) };
};

/**
 * One sender per model the owner offers on a signed-in service. A service that
 * is signed out is listed with the login to run rather than left out, as an
 * unconfigured runtime is listed: the menu says what could be there.
 */
/**
 * The two axes a model offers before the press, and what they are called
 * (`BO_0279_007`). A model reports more than these — `background`, `variant`,
 * `genre` — and they are captured and sent when chosen, but only the shape and
 * the size get a control: the reader asked for a ratio and a quality, and a
 * menu is not a form.
 *
 * *Quality* is the resolution, because that is what a reader means by it:
 * `1k`, `2k`, `720p`. The model's own `quality` axis, where it has one, is a
 * different thing and is left to its default.
 */
const DRAWN: readonly { readonly axis: string; readonly label: string }[] = [
  { axis: "aspect-ratio", label: "Ratio" },
  { axis: "resolution", label: "Quality" },
];

/** What a model lets a person choose, from what was captured when it was offered. */
export function axesOffered(captured: readonly CapturedAxis[] | undefined): readonly SenderAxis[] {
  if (captured === undefined) return [];
  const axes: SenderAxis[] = [];
  for (const drawn of DRAWN) {
    const held = captured.find((one) => one.axis === drawn.axis);
    // An axis with no values is no choice; an axis the model does not have is
    // not drawn at all, so a model with neither draws as a plain sender.
    if (held === undefined || held.values.length === 0) continue;
    axes.push({ axis: held.axis, label: drawn.label, values: held.values, start: held.default });
  }
  return axes;
}

export async function mediaSenders(): Promise<readonly SenderDescriptor[]> {
  const [services, held] = await Promise.all([offeredRoster(), readOffered()]);
  const offered: SenderDescriptor[] = [];
  for (const service of services) {
    for (const model of service.models) {
      const key = offeredKey(service.service, model.model);
      const axes = axesOffered(held.axes?.[key]);
      offered.push({
        id: senderId(service.service, model.model),
        // The owner's name, else the extension's, else the model's own id.
        label: held.names?.[key] ?? shortName(model.model),
        icon: chosenIcon(held.icons?.[key], model.kind),
        selectable: service.signedIn,
        reason: service.signedIn ? null : (service.reason ?? "Not signed in."),
        // A model whose axes nobody could read offers none, and a press then
        // takes the vendor's own defaults. BO_0279_014
        ...(axes.length === 0 ? {} : { options: axes }),
      });
    }
  }
  return offered;
}

/**
 * Whether a refusal names an axis this send carried (`BO_0279_017`).
 *
 * The adapters refuse in the vendor's own vocabulary — *"gpt_image_2 takes
 * aspect_ratio [...]"* — so a refusal mentioning an axis we chose a value for
 * means the captured set and the vendor disagree. The axis is matched in both
 * spellings, because the service's name is hyphenated and the vendor's is not.
 */
export function staleAxis(refusal: string, sent: readonly SenderAxis[]): boolean {
  const said = refusal.toLowerCase();
  return sent.some((axis) => {
    const name = axis.axis.toLowerCase();
    return said.includes(name) || said.includes(name.replace(/-/gu, "_"));
  });
}

/**
 * What this send would cost, asked before the press (`BO_0279_013`).
 *
 * The adapters' own dry run, which spends nothing and makes nothing, for the
 * model and the axes the reader has chosen — so `4k` at `max` reads as what it
 * is rather than as what `1k` costs. Anything that cannot be said is said as
 * nothing: the shell shows no number rather than a wrong one.
 */
export async function quoteToModel(request: SendRequest): Promise<SendQuote> {
  const parts = senderParts(request.sender);
  if (parts === null || request.blockId === "") return { ok: false };
  const prompt = await promptOf(request.documentId, request.blockId);
  if (prompt === "") return { ok: false };

  const services = await offeredRoster();
  const service = services.find((one) => one.service === parts.service);
  const model = service?.models.find((one) => one.model === parts.model);
  if (service === undefined || model === undefined || !service.signedIn) return { ok: false };

  const held = await readOffered();
  const offered = axesOffered(held.axes?.[offeredKey(parts.service, parts.model)]);
  const chosen: Record<string, string> = {};
  for (const axis of offered) {
    const value = request.options?.[axis.axis];
    if (typeof value === "string" && value !== "" && axis.values.includes(value)) {
      chosen[axis.axis] = value;
    }
  }

  const answer = await call("/__kernel/media/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service: parts.service,
      kind: model.kind,
      model: parts.model,
      prompt,
      ...(Object.keys(chosen).length === 0 ? {} : { options: chosen }),
    }),
  });
  if (!answer.ok) return { ok: false };
  const said = (await answer.json()) as {
    status?: string;
    request?: { cost_quote?: { credits?: unknown } };
  };
  const credits = said.request?.cost_quote?.credits;
  if (said.status !== "ok" || typeof credits !== "number") return { ok: false };
  // The vendor's own unit, in its own words: the shell only shows it.
  return { ok: true, cost: `${credits} credits` };
}

/** A block sent to a model: the press that spends. */
export async function sendToModel(request: SendRequest): Promise<SendOutcome> {
  const parts = senderParts(request.sender);
  if (parts === null) return { ok: false, error: `Nothing offers ${request.sender}.` };
  if (request.blockId === "") {
    return { ok: false, error: "A picture is made from a block's words, and this command names none." };
  }
  const services = await offeredRoster();
  const service = services.find((one) => one.service === parts.service);
  const model = service?.models.find((one) => one.model === parts.model);
  if (service === undefined || model === undefined) {
    return { ok: false, error: `${shortName(parts.model)} is not offered any more.` };
  }
  if (!service.signedIn) {
    return { ok: false, error: service.reason ?? `Sign in to ${parts.service} first.` };
  }

  // Only the axes this model actually offers travel: a value for an axis it
  // does not have would be refused by the vendor, and one nobody chose is
  // absent so the vendor applies its own default. BO_0279_012
  const held = await readOffered();
  const offered = axesOffered(held.axes?.[offeredKey(parts.service, parts.model)]);
  const chosen: Record<string, string> = {};
  for (const axis of offered) {
    const value = request.options?.[axis.axis];
    if (typeof value === "string" && value !== "" && axis.values.includes(value)) {
      chosen[axis.axis] = value;
    }
  }

  const making = await makeGeneration({
    workspaceId: request.workspaceId,
    documentId: request.documentId,
    blockId: request.blockId,
    service: parts.service,
    model: parts.model,
    kind: model.kind,
    ...(Object.keys(chosen).length === 0 ? {} : { options: chosen }),
  });
  if (!making.ok) {
    const refusal = making.refusal ?? "That could not be made.";
    // A refusal naming an axis this send carried is evidence that what was
    // captured is stale — the vendor has changed what it takes since the owner
    // last asked. Re-ask, and say so, rather than leaving the reader to press
    // the same thing again. BO_0279_017
    if (staleAxis(refusal, offered)) {
      await captureAxes(offeredKey(parts.service, parts.model));
      return {
        ok: false,
        error: `${refusal} What this model takes has been read again; the choices are up to date now.`,
      };
    }
    return { ok: false, error: refusal };
  }
  return { ok: true, ...(making.processId === undefined ? {} : { processId: making.processId }) };
}
