import { randomUUID } from "node:crypto";

import { configurationRefusal } from "~/lib/connections";
import { allOfType, commit, matching, one, properties } from "~/server/ccgw/script";
import { typeOf } from "~/server/ccgw/nodes";
import { bareId, contentOf, nodeRef } from "~/server/ccgw/nodes";
import { kernelSecrets, type PartyView } from "~/server/kernel/client";
import { conflictOutcome, refusal, type GraphOutcome } from "~/server/outcome";
import type { ReadResult } from "~/server/ccgw/client";
import type { StoredIndex } from "../lib/content-index";
import type { ChannelDetail, ChannelState, ChannelSummary, CredentialFacts } from "../lib/library";
import type { Kind } from "./kinds/contract";
import { kindOf, summarize } from "./kinds/registry";
import { channelWasPublishedTo } from "./releases";

/**
 * Channels as data. PU_0001_004
 *
 * A channel is a `channel` node in the graph — its kind and its title — and
 * a party record in the kernel's secret store under `publishing-<id>`, which
 * holds the kind's fields and the key beside them and is never read for a
 * value here. The state a row shows is the kernel's record laid over the
 * kind's own rule about what a usable configuration is, at read time, never
 * stored twice.
 */

export const CHANNEL_TYPE = "channel";
export const INDEX_TYPE = "contentIndex";
export const DECLARES = "declares";

const STATES: readonly string[] = ["unconfigured", "configured", "verified", "failing"];

/**
 * Runs one write, waiting out the kernel's per-node floor once: a write within
 * 250ms of the last one on the same node — an index read right after another,
 * a delete right after a read — is refused as `write_too_frequent`, and one
 * wait is what `commitEach` gives a revise too.
 */
async function withFloor<T>(run: () => Promise<GraphOutcome<T>>): Promise<GraphOutcome<T>> {
  const first = await run();
  if (first.outcome === "validationFailure" && first.failures[0].rule === "write_too_frequent") {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return run();
  }
  return first;
}

/** The kernel's party id for a channel. */
export const partyOf = (channelId: string): string => `publishing-${channelId}`;

export interface WrittenChannel {
  readonly channelId: string;
  readonly revisionId: string;
  readonly dataRevision: string;
}

interface ChannelNode {
  readonly channelId: string;
  readonly kind: string;
  readonly title: string;
  readonly revisionId: string;
  readonly retired: boolean;
}

function channelNodes(result: ReadResult): ChannelNode[] {
  return result.nodes
    .filter((node) => typeOf(node) === CHANNEL_TYPE)
    .map((node) => {
      const content = contentOf(node);
      return {
        channelId: bareId(node.id),
        kind: String(content["kind"] ?? ""),
        title: String(content["title"] ?? ""),
        revisionId: node.revision.id,
        retired: content["retired"] === true,
      };
    });
}

/**
 * The kernel's record for a channel, or nothing when it holds none — a
 * channel whose record was never written, or was removed, is unconfigured
 * rather than an error.
 */
async function partyView(channelId: string): Promise<PartyView | null> {
  try {
    return await kernelSecrets.read(partyOf(channelId));
  } catch {
    return null;
  }
}

/**
 * What the kernel's record says, laid over the kind's rule: a channel whose
 * configuration is incomplete is `unconfigured` however good its key, for the
 * reason a settings row is — a second copy of a derivable fact can disagree.
 */
export function credentialFacts(kind: Kind, view: PartyView | null): CredentialFacts {
  const configuration = view?.configuration ?? {};
  const keySet = view?.secretFields?.[kind.authorization.secretField]?.set ?? false;
  const stored = view !== null && STATES.includes(view.state) ? (view.state as ChannelState) : "unconfigured";
  const wrong = configurationRefusal({ id: kind.id, kind: "channel", fields: kind.fields }, configuration);
  return {
    state: wrong === null ? stored : "unconfigured",
    keySet,
    configuration,
    lastTestedAt: view?.lastTestedAt ?? null,
    lastError: wrong ?? view?.lastError ?? null,
  };
}

function summaryOf(node: ChannelNode, kind: Kind, view: PartyView | null): ChannelSummary {
  return {
    channelId: node.channelId,
    kind: node.kind,
    kindLabel: kind.label,
    title: node.title,
    state: credentialFacts(kind, view).state,
    retired: node.retired,
  };
}

/** Every channel with its state, for the library. A channel of a kind the build no longer ships lists by its kind's id. */
export async function listChannels(): Promise<GraphOutcome<readonly ChannelSummary[]>> {
  const outcome = await allOfType(CHANNEL_TYPE, "channels listing");
  if (outcome.outcome !== "success") return outcome as GraphOutcome<readonly ChannelSummary[]>;
  const nodes = channelNodes(outcome.result).sort((left, right) =>
    left.kind === right.kind ? left.title.localeCompare(right.title) : left.kind.localeCompare(right.kind),
  );
  const summaries = await Promise.all(
    nodes.map(async (node) => {
      const kind = kindOf(node.kind) ?? unknownKind(node.kind);
      return summaryOf(node, kind, await partyView(node.channelId));
    }),
  );
  return { outcome: "success", result: summaries };
}

/** A kind the build does not ship: the channel still lists, by its id, so it can be deleted. */
const unknownKind = (id: string): Kind => ({
  id,
  label: id,
  purpose: "",
  credential: "apiKey",
  fields: [],
  authorization: { secretField: "apiKey" },
  probe: { url: "" },
  offer: { fixed: [] },
  units: [],
  acts: [],
});

/**
 * A new channel: a kind the registry holds and a title. The node is
 * established and the kernel's party record written under the channel's
 * party id with the kind's authorization and probe, so the settings row can
 * save, test and clear it (`CA_0049`). Each refusal is in words before
 * anything is written.
 */
export async function createChannel(input: {
  readonly kind: string;
  readonly title: string;
}): Promise<GraphOutcome<WrittenChannel>> {
  const kind = kindOf(input.kind);
  if (kind === undefined) {
    return refusal("unknownKind", `${input.kind} is not a kind of channel this instance ships.`);
  }
  const title = input.title.trim();
  if (title === "") return refusal("titleRequired", "A channel needs a title.");

  const channelId = randomUUID();
  const parameters: Record<string, unknown> = {};
  const statement = `CREATE (c:${CHANNEL_TYPE} {${properties("c", { id: channelId, kind: kind.id, title }, parameters)}})`;
  const written = await commit(statement, parameters, `create channel ${channelId}`, async (dataRevision, revisionOf) => ({
    channelId,
    revisionId: await revisionOf(channelId),
    dataRevision,
  }));
  if (written.outcome !== "success") return written;
  // The record after the node: a party record with no channel behind it
  // would be a credential nothing can use, while a channel with no record
  // is simply unconfigured until the row is saved.
  await kernelSecrets.write(partyOf(channelId), {
    kind: kind.credential === "apiKey" ? "apiKey" : kind.credential,
    authorization: kind.authorization,
    test: kind.probe,
    ...(kind.provider === undefined ? {} : { provider: { ...kind.provider, scopes: [...kind.provider.scopes] } }),
    ...(kind.paths === undefined ? {} : { paths: [...kind.paths] }),
    ...(kind.fixed === undefined ? {} : { configuration: { ...kind.fixed } }),
  });
  return written;
}

/** One channel by identity, with its kind, its credential facts and the index it declares. */
export async function readChannel(channelId: string): Promise<GraphOutcome<ChannelDetail>> {
  const outcome = await one(channelId, "channel read");
  if (outcome.outcome !== "success") return outcome as GraphOutcome<ChannelDetail>;
  const node = channelNodes(outcome.result)[0];
  if (node === undefined) return { outcome: "noResult", detail: `No channel ${channelId} in this graph.` };
  const kind = kindOf(node.kind) ?? unknownKind(node.kind);
  const view = await partyView(channelId);
  const index = await readStoredIndex(channelId);
  if (index.outcome !== "success") return index as GraphOutcome<ChannelDetail>;
  return {
    outcome: "success",
    result: {
      channel: summaryOf(node, kind, view),
      revisionId: node.revisionId,
      kindSummary: summarize(kind),
      credential: credentialFacts(kind, view),
      index: index.result?.stored ?? null,
    },
  };
}

export interface HeldIndex {
  readonly indexId: string;
  readonly stored: StoredIndex;
}

/** The index a channel declared, read by the channel it belongs to; `null` before the first read. */
export async function readStoredIndex(channelId: string): Promise<GraphOutcome<HeldIndex | null>> {
  const outcome = await matching(INDEX_TYPE, { channel: channelId }, "index read");
  if (outcome.outcome !== "success") return outcome as GraphOutcome<HeldIndex | null>;
  const node = outcome.result.nodes.find((candidate) => typeOf(candidate) === INDEX_TYPE);
  if (node === undefined) return { outcome: "success", result: null };
  const content = contentOf(node);
  return {
    outcome: "success",
    result: {
      indexId: bareId(node.id),
      stored: {
        readAt: String(content["readAt"] ?? ""),
        containers: (content["containers"] as StoredIndex["containers"] | undefined) ?? [],
        slots: (content["slots"] as StoredIndex["slots"] | undefined) ?? [],
        copy: (content["copy"] as StoredIndex["copy"] | undefined) ?? [],
      },
    },
  };
}

/**
 * Writes what a read declared: the first read creates the index node and
 * relates the channel to it; a later read revises it. One node per channel,
 * by this read before the write, since the graph validates one node at a time.
 */
export async function writeStoredIndex(
  channelId: string,
  held: HeldIndex | null,
  stored: StoredIndex,
): Promise<GraphOutcome<{ readonly indexId: string; readonly dataRevision: string }>> {
  const parameters: Record<string, unknown> = {};
  if (held === null) {
    const indexId = randomUUID();
    const statement = [
      `CREATE (i:${INDEX_TYPE} {${properties("i", { id: indexId, channel: channelId, ...stored }, parameters)}})`,
      `RELATE c -[d:${DECLARES}]-> iref`,
    ].join("; ");
    parameters["cNodeId"] = nodeRef(channelId);
    parameters["iref"] = nodeRef(indexId);
    return commit(statement, parameters, `store the index ${channelId} declares`, async (dataRevision) => ({
      indexId,
      dataRevision,
    }));
  }
  parameters["iNodeId"] = nodeRef(held.indexId);
  parameters["i_readAt"] = stored.readAt;
  parameters["i_containers"] = stored.containers;
  parameters["i_slots"] = stored.slots;
  parameters["i_copy"] = stored.copy;
  return withFloor(() =>
    commit(
      "SET i.readAt = $i_readAt, i.containers = $i_containers, i.slots = $i_slots, i.copy = $i_copy",
      parameters,
      `revise the index ${channelId} declares`,
      async (dataRevision) => ({ indexId: held.indexId, dataRevision }),
    ),
  );
}

/**
 * Deletes a channel: the node retired with the index it declared, the
 * kernel's party record removed with it. Refused when the record moved under
 * the caller, and refused once anything was ever published to it — the log
 * keeps naming a destination that existed, so such a channel is retired
 * instead (`retireChannel`). PU_0003_005
 */
export async function deleteChannel(input: {
  readonly channelId: string;
  readonly baseRevisionId: string;
}): Promise<GraphOutcome<WrittenChannel>> {
  const existing = await one(input.channelId, "channel read");
  if (existing.outcome !== "success") return existing as GraphOutcome<WrittenChannel>;
  const node = channelNodes(existing.result)[0];
  if (node === undefined) return { outcome: "noResult", detail: `No channel ${input.channelId} in this graph.` };
  if (node.revisionId !== input.baseRevisionId) {
    return conflictOutcome<WrittenChannel>([
      { nodeId: nodeRef(input.channelId), expectedRevisionId: input.baseRevisionId, currentRevisionId: node.revisionId },
    ]) as GraphOutcome<WrittenChannel>;
  }
  const published = await channelWasPublishedTo(input.channelId);
  if (published.outcome !== "success") return published as GraphOutcome<WrittenChannel>;
  if (published.result) return refusal("channelPublishedTo", "Something was published to this channel; retire it instead, so the log keeps naming it.");
  const held = await readStoredIndex(input.channelId);
  if (held.outcome !== "success") return held as GraphOutcome<WrittenChannel>;
  const statements = ["RETIRE c"];
  const parameters: Record<string, unknown> = { cNodeId: nodeRef(input.channelId) };
  if (held.result !== null) {
    statements.push("RETIRE i");
    parameters["iNodeId"] = nodeRef(held.result.indexId);
  }
  const retire = () =>
    commit(statements.join("; "), parameters, `delete channel ${input.channelId}`, async (dataRevision) => ({
      channelId: input.channelId,
      revisionId: input.baseRevisionId,
      dataRevision,
    }));
  const written = await withFloor(retire);
  if (written.outcome !== "success") return written;
  try {
    await kernelSecrets.remove(partyOf(input.channelId));
  } catch {
    // A record the kernel never held: nothing to remove.
  }
  return written;
}

/**
 * Retires a channel anything was published to: the node stays, marked
 * retired, its party record removed, so the log's entries keep naming a
 * destination that existed and no credential stays for one that is gone.
 * PU_0003_005
 */
export async function retireChannel(input: { readonly channelId: string; readonly baseRevisionId: string }): Promise<GraphOutcome<WrittenChannel>> {
  const existing = await one(input.channelId, "channel read");
  if (existing.outcome !== "success") return existing as GraphOutcome<WrittenChannel>;
  const node = channelNodes(existing.result)[0];
  if (node === undefined) return { outcome: "noResult", detail: `No channel ${input.channelId} in this graph.` };
  if (node.revisionId !== input.baseRevisionId) {
    return conflictOutcome<WrittenChannel>([
      { nodeId: nodeRef(input.channelId), expectedRevisionId: input.baseRevisionId, currentRevisionId: node.revisionId },
    ]) as GraphOutcome<WrittenChannel>;
  }
  if (node.retired) return refusal("alreadyRetired", "This channel is already retired.");
  const parameters: Record<string, unknown> = { cNodeId: nodeRef(input.channelId), c_retired: true };
  const written = await withFloor(() =>
    commit("SET c.retired = $c_retired", parameters, `retire channel ${input.channelId}`, async (dataRevision, revisionOf) => ({
      channelId: input.channelId,
      revisionId: await revisionOf(input.channelId),
      dataRevision,
    })),
  );
  if (written.outcome !== "success") return written;
  try {
    await kernelSecrets.remove(partyOf(input.channelId));
  } catch {
    // A record the kernel never held: nothing to remove.
  }
  return written;
}
