/**
 * Instructions (`calliopa-bootstrap`'s `BO_0298`, `BO_0311` and `BO_0338`, [Block Document Model](../docs/system/documents/block-document-model.md#profiles)):
 * an instruction is a document carrying `record: instruction`, reusable instructions a
 * person keeps for agents and chooses per command in the chip, which the
 * kernel reads at a run's start. The words are this extension's because the
 * record slot is declared on its `document` type; the chip, the grant control
 * and the routes are the `instructions` extension's. Client-safe: nothing here
 * reaches the graph.
 */

/** The `record` value that tells an instruction apart. Knowledge, never a fence. */
export const INSTRUCTION_RECORD = "instruction";

/** The `record` value instructions carried as profiles before `BO_0338`, which
 * `instructions`' migration moves to `INSTRUCTION_RECORD`; read by it alone. */
export const FORMER_INSTRUCTION_RECORD = "profile";

/** An instruction as the chip offers it and the Structures category lists it. */
export interface InstructionSummary {
  readonly id: string;
  readonly title: string;
}

/** *Fill a field*'s fixed id: the built-in instruction `instructions` makes,
 * which a block put into a field whose kind is not text runs under
 * (`calliopa-bootstrap`'s `BO_0349_033`). Named here, beside the record, so
 * `structures`, which starts the run, names it without depending on
 * `instructions`. */
export const FILL_A_FIELD_INSTRUCTION = "d0dd4941-2dc8-4efb-bb48-790b722f5173";

/** *Shape an instruction*'s fixed id: the built-in a block dropped on an
 * instruction's header runs under, proposing the revision of that instruction
 * which would have produced the block (`calliopa-bootstrap`'s `BO_0349_014`). */
export const SHAPE_AN_INSTRUCTION = "8b229a16-2e68-4311-9852-22ce4d7c0daf";

/** *Extend a structure*'s fixed id: the built-in a block dropped on a
 * structure's header runs under, proposing the fields the structure lacks,
 * read off the block (`calliopa-bootstrap`'s `BO_0349_036`). */
export const EXTEND_A_STRUCTURE = "24e0336f-03f0-49e7-9f93-9b561b1d4d16";

/** *Apply a structure*'s fixed id: the built-in a structure dropped on a
 * document's body runs under, proposing the structure on the document with
 * the values its words hold (`calliopa-bootstrap`'s `BO_0349_012`). */
export const APPLY_A_STRUCTURE = "e1642e4e-a51e-44ee-8b51-3e5864ed8830";
