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
