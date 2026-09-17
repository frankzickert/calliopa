import type { ProposedTarget } from "~/contract";
import { SERVER_REGISTRY } from "~/registry.server.gen";
import { qualify } from "~/registry";
import { readBridgeRun } from "./bridge";

/**
 * What a run proposed, as the run detail lists it.
 *
 * The frame knows a run has a proposal group and nothing about what a group
 * means: each extension reads its own content and answers what the run staged
 * into it (`proposedTargets`), and this merges those answers in extension
 * order with each kind qualified. An extension that throws contributes
 * nothing, the way a section reader that throws renders its section empty.
 * BO_0207_015 BO_0255_007
 */
export interface ProposedItem extends ProposedTarget {
  /** The qualified kind, so the detail can open what it names. */
  readonly openKind: string;
}

export async function runProposals(runId: string): Promise<readonly ProposedItem[]> {
  const run = await readBridgeRun(runId);
  if (!run.ok || !run.value.group) return [];
  const group = run.value.group;
  const listed: ProposedItem[] = [];
  for (const { extension, read } of SERVER_REGISTRY.proposedTargets) {
    let answered: readonly ProposedTarget[];
    try {
      answered = await read(group);
    } catch {
      continue;
    }
    for (const target of answered) {
      listed.push({ ...target, openKind: qualify(extension, target.kind) });
    }
  }
  return listed.sort((left, right) => left.title.localeCompare(right.title));
}
