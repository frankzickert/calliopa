import { outsideBranch } from "~/server/ccgw/branch-scope";
import { query, type ReadRelation } from "~/server/ccgw/client";
import { bareId, nodeRef } from "~/server/ccgw/nodes";
import { commit } from "~/server/ccgw/script";
import type { GraphOutcome } from "~/server/outcome";
import { readDocument, instructionSummary } from "~/extensions/documents/server/documents";
import type { InstructionSummary } from "~/extensions/documents/lib/instruction";

/**
 * An instruction standing on a block or a document (`calliopa-bootstrap`'s
 * `BO_0349_030`): one `usesInstruction` relation from the subject — the
 * document node or a block in its reading order — to an instruction's
 * document, at most one per subject, so a new one replaces the one standing.
 * It is the default every command there starts with (`BO_0349_Q2`). Written
 * as the person's truth at once, as taking a structure is.
 */
export const USES_INSTRUCTION = "usesInstruction";

const refuse = <T>(rule: string, detail: string): GraphOutcome<T> => ({
  outcome: "validationFailure",
  failures: [{ operation: null, rule, detail }],
});

const active = (relation: ReadRelation): boolean =>
  relation.type === USES_INSTRUCTION && relation.validity.status === "active" && relation.to.nodeId !== undefined;

/** What stands on a document and its blocks: the document's own, and each
 * block's that has one, by block id. */
export interface StandingInstructions {
  readonly document: InstructionSummary | null;
  readonly blocks: Readonly<Record<string, InstructionSummary>>;
}

/** The active relations from these subjects, by subject id. */
async function relationsFrom(subjects: readonly string[]): Promise<GraphOutcome<Map<string, ReadRelation>>> {
  const found = new Map<string, ReadRelation>();
  if (subjects.length === 0) return { outcome: "success", result: found };
  const read = await query({
    statement: `MATCH (s)-[u:${USES_INSTRUCTION}]->(i) RETURN GRAPH s, u, i ROOT s`,
    roots: subjects.map(nodeRef),
    unbounded: true,
    metadataOnly: true,
    purpose: "standing instructions",
  });
  if (read.outcome === "noResult") return { outcome: "success", result: found };
  if (read.outcome !== "success") return read as GraphOutcome<never>;
  for (const relation of read.result.relations) if (active(relation)) found.set(bareId(relation.fromNodeId), relation);
  return { outcome: "success", result: found };
}

/** The instructions standing on a document and on each of its blocks, each
 * named by its title; one whose document is no instruction any more is left out. */
export async function standingOf(documentId: string): Promise<GraphOutcome<StandingInstructions>> {
  const document = await readDocument(documentId);
  if (document.outcome !== "success") return document as GraphOutcome<never>;
  const blocks = document.result.blocks.flatMap((block) => [block.blockId, ...(block.kind === "admonition" ? block.children.map((child) => child.blockId) : [])]);
  const relations = await relationsFrom([documentId, ...blocks]);
  if (relations.outcome !== "success") return relations as GraphOutcome<never>;
  const named = new Map<string, InstructionSummary | null>();
  const nameOf = async (id: string): Promise<InstructionSummary | null> => {
    if (!named.has(id)) {
      const summary = await instructionSummary(id);
      named.set(id, summary.outcome === "success" ? summary.result : null);
    }
    return named.get(id) ?? null;
  };
  let own: InstructionSummary | null = null;
  const byBlock: Record<string, InstructionSummary> = {};
  for (const [subject, relation] of relations.result) {
    const summary = await nameOf(bareId(relation.to.nodeId ?? ""));
    if (summary === null) continue;
    if (subject === documentId) own = summary;
    else byBlock[subject] = summary;
  }
  return { outcome: "success", result: { document: own, blocks: byBlock } };
}

/**
 * The person stands an instruction on a block or a document, or takes the one
 * standing off with `null` (`BO_0349_030`): refused in words for a block not
 * in the document's reading order and for a document that is no instruction.
 * A new one closes the one standing in the same script. Answers what stands
 * on the document after.
 */
export async function setStanding(input: {
  readonly documentId: string;
  readonly blockId?: string;
  readonly instruction: string | null;
}): Promise<GraphOutcome<StandingInstructions>> {
  const document = await readDocument(input.documentId);
  if (document.outcome === "noResult") return refuse("unknownDocument", `Document ${input.documentId} is not here.`);
  if (document.outcome !== "success") return document as GraphOutcome<never>;
  const subject = input.blockId ?? input.documentId;
  if (input.blockId !== undefined) {
    const inOrder = document.result.blocks.some(
      (block) => block.blockId === input.blockId || (block.kind === "admonition" && block.children.some((child) => child.blockId === input.blockId)),
    );
    if (!inOrder) return refuse("unknownBlock", `Block ${input.blockId} is not in the reading order of document ${input.documentId}.`);
  }
  if (input.instruction !== null) {
    const summary = await instructionSummary(input.instruction);
    if (summary.outcome !== "success" || summary.result === null)
      return refuse("notAnInstruction", `Document ${input.instruction} is no instruction, so it cannot stand on ${input.blockId === undefined ? "a document" : "a block"}.`);
  }
  const standing = await relationsFrom([subject]);
  if (standing.outcome !== "success") return standing as GraphOutcome<never>;
  const current = standing.result.get(subject);
  if (current !== undefined && current.to.nodeId === nodeRef(input.instruction ?? "")) return standingOf(input.documentId);
  const statements: string[] = [];
  const parameters: Record<string, unknown> = {};
  if (current !== undefined) {
    statements.push("CLOSE u");
    Object.assign(parameters, { uRelationId: current.id, uFrom: nodeRef(subject) });
  }
  if (input.instruction !== null) {
    statements.push(`RELATE sref -[n:${USES_INSTRUCTION}]-> iref`);
    Object.assign(parameters, { sref: nodeRef(subject), iref: nodeRef(input.instruction) });
  }
  if (statements.length > 0) {
    const write = () =>
      outsideBranch(() =>
        commit(statements.join("; "), parameters, input.instruction === null ? "an instruction taken off" : "an instruction stands", async () => undefined),
      );
    let written = await write();
    if (written.outcome === "validationFailure" && written.failures[0]?.rule === "write_too_frequent") {
      await new Promise((resolve) => setTimeout(resolve, 300));
      written = await write();
    }
    if (written.outcome !== "success") return written as GraphOutcome<never>;
  }
  return standingOf(input.documentId);
}
