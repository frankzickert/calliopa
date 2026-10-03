import { insertBlock, readDocument } from "~/extensions/documents/server/documents";
import { write } from "~/server/ccgw/client";
import type { GraphOutcome } from "~/server/outcome";

import { FIELD_STRUCTURE, STRUCTURE_STRUCTURE, type StructureView } from "../lib/structures";
import { MIGRATIONS } from "../server/migrations";
import { readStructure, setStructure, setValues } from "../server/structures";

/**
 * How a behaviour suite shapes structures over the one graph, as a person
 * does (`RO_0005`): the migration an instance runs, a field added as a block
 * of the structure's document given *Field*, and what a structure allows set
 * as a value of *Structure*. Shared by every suite that needs a structure of
 * its own; it reaches the graph the suite's harness serves.
 */

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 350));

const ok = <T>(outcome: GraphOutcome<T>): T => {
  if (outcome.outcome !== "success") throw new Error(`expected success, got ${JSON.stringify(outcome)}`);
  return outcome.result;
};

/** The structures as documents, as an instance serving the pin writes
 * them; tried again past the kernel's per-node floor, since every suite
 * runs it. */
export async function structuresAsDocuments(): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const statement = ok(await MIGRATIONS["structures-as-documents"]!());
    if (statement.statement === "") return;
    const written = await write(statement.statement, statement.parameters, "structures as documents");
    if (written.outcome === "success") {
      await settle();
      return;
    }
    await settle();
  }
  throw new Error("the structures did not become documents");
}

/** A field added as a person adds one: a block of the structure's document
 * whose words are the field's name, given *Field* and these values; the
 * structure as it stands after. */
export async function addField(structureId: string, name: string, values: Record<string, unknown> = {}): Promise<StructureView> {
  const document = ok(await readDocument(structureId));
  const last = document.blocks.at(-1)!.blockId;
  const block = ok(await insertBlock({ documentId: structureId, block: { kind: "text", runs: [{ text: name }] }, placement: { after: last } })).blockId;
  await settle();
  ok(await setStructure({ documentId: structureId, blockId: block, structure: FIELD_STRUCTURE, taken: true }));
  await settle();
  if (Object.keys(values).length > 0) {
    ok(await setValues({ documentId: structureId, blockId: block, structure: FIELD_STRUCTURE, values }));
    await settle();
  }
  return ok(await readStructure(structureId));
}

/** What a structure allows, set in its header as the value of *Structure*. */
export async function allow(structureId: string, allowed: readonly string[]): Promise<StructureView> {
  ok(await setValues({ documentId: structureId, structure: STRUCTURE_STRUCTURE, values: { allows: allowed } }));
  await settle();
  return ok(await readStructure(structureId));
}
