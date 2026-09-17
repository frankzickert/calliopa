import { kernelSecrets } from "~/server/kernel/client";
import { refusal, type GraphOutcome, type ValidationFailure } from "~/server/outcome";
import { parseContentIndex, reconcileIndex } from "../lib/content-index";
import type { IndexReadReport } from "../lib/library";
import { assignedKeys } from "./assignments";
import { partyOf, readChannel, readStoredIndex, writeStoredIndex } from "./channels";
import { INDEX_PATH, underAddress } from "./kinds/website";

/**
 * Reading what a website declares: `GET <address>/index` through the
 * kernel's broker, which adds the key; the answer parsed strictly; the result
 * laid over what was stored, retiring keys the site no longer lists while
 * something is assigned to them and dropping the rest. PU_0001_007
 *
 * The set of assigned keys is read from the channel's assignments unless the
 * caller hands one in.
 */
export async function readIndex(
  channelId: string,
  assigned?: ReadonlySet<string>,
  now: () => Date = () => new Date(),
): Promise<GraphOutcome<IndexReadReport>> {
  const detail = await readChannel(channelId);
  if (detail.outcome !== "success") return detail as GraphOutcome<IndexReadReport>;
  if (!detail.result.kindSummary.readsIndex) {
    return refusal("noIndex", `A ${detail.result.kindSummary.label} channel declares no index.`);
  }
  if (detail.result.credential.state === "unconfigured") {
    return refusal(
      "unconfigured",
      detail.result.credential.lastError ?? "The channel holds no address and no key; save them in Settings first.",
    );
  }

  let answer: { readonly status: number; readonly text: string };
  try {
    answer = await kernelSecrets.request(partyOf(channelId), { method: "GET", path: underAddress(detail.result.credential.configuration["address"] ?? "", INDEX_PATH) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return refusal("unreachable", `The site could not be asked for its index: ${message}`);
  }
  if (answer.status < 200 || answer.status >= 300) {
    return refusal("refusedByTheSite", `The site answered ${answer.status} instead of its index.`);
  }
  let body: unknown;
  try {
    body = JSON.parse(answer.text) as unknown;
  } catch {
    // A page served for a route that does not exist, or an error overlay
    // while the site restarts, answers 200 with HTML. That is not an index.
    return refusal("notAnIndex", "The site answered something that is not JSON where its index should be.");
  }
  const parsed = parseContentIndex(body);
  if (!parsed.ok) {
    const failures = parsed.refusals.map(
      (found): ValidationFailure => ({
        operation: null,
        rule: "indexShape",
        detail: `${found.entry}${found.field === "" ? "" : `.${found.field}`}: ${found.message}`,
      }),
    );
    const [first, ...rest] = failures;
    return { outcome: "validationFailure", failures: [first as ValidationFailure, ...rest] };
  }

  const held = await readStoredIndex(channelId);
  if (held.outcome !== "success") return held as GraphOutcome<IndexReadReport>;
  // What the channel's assignments name is what a vanished key is kept for. PU_0003_002
  const kept = assigned ?? (await assignedKeys(channelId));
  const reconciled = reconcileIndex(held.result?.stored ?? null, parsed.index, kept, now().toISOString());
  const written = await writeStoredIndex(channelId, held.result, reconciled.stored);
  if (written.outcome !== "success") return written as GraphOutcome<IndexReadReport>;
  return {
    outcome: "success",
    result: {
      index: reconciled.stored,
      retired: reconciled.retired,
      dropped: reconciled.dropped,
      reclassed: reconciled.reclassed,
    },
  };
}
