import type { InstructionSummary } from "~/extensions/documents/lib/instruction";

/**
 * The words `instructions` shares between its server half and its views
 * (`calliopa-bootstrap`'s `BO_0311`). Client-safe: nothing here reaches the
 * graph or the kernel.
 */

/** The built-in structure every instruction uses: `structures`' fixed id,
 * named there once (`RO_0005`). */
export { INSTRUCTION_STRUCTURE } from "~/extensions/structures/lib/structures";

/** The option the chip sets on a command, which the kernel reads. */
export const INSTRUCTION_OPTION = "instruction";

/** The chip's mark that *No instruction* was chosen for a command, since the
 * shell keeps no option set to nothing; the runs route does not read it
 * (`PF_0001_001`). */
export const NO_INSTRUCTION_OPTION = "no-instruction";

/** An instruction as the chip offers it: grouped first when it carries a role the
 * block or its document takes. */
export interface InstructionChoice extends InstructionSummary {
  readonly matches: boolean;
}

/** What the chip is handed for a block. */
export interface InstructionChoices {
  readonly reachable: boolean;
  /** The document the chip stands in is itself an instruction. */
  readonly isInstruction: boolean;
  readonly instructions: readonly InstructionChoice[];
  /** The instruction the person last sent with in this document, or null. */
  readonly last: string | null;
  /** The instruction standing on the chip's block, else on its document, or
   * null: what a command carrying no choice starts with, before the person's
   * last (`calliopa-bootstrap`'s `BO_0349_031`). */
  readonly standing?: string | null;
}

/** What a command carrying no choice starts with (`BO_0349_031`): the
 * instruction standing on its block, else on its document, else the one the
 * person last sent with — each only while it is still an instruction. */
export function startingInstruction(choices: InstructionChoices): string | null {
  const offered = (id: string | null | undefined): id is string =>
    id !== null && id !== undefined && choices.instructions.some((instruction) => instruction.id === id);
  if (offered(choices.standing)) return choices.standing;
  return offered(choices.last) ? choices.last : null;
}

/** A code block of an instruction as a tool, with the state of its grant. */
export interface ToolState {
  readonly block: string;
  readonly name: string;
  readonly description: string;
  /** Granted as it stands, changed since the grant, or never granted. */
  readonly state: "granted" | "changed" | "never";
}

/** The kernel's answer on an instruction's grant. */
export interface GrantView {
  readonly instruction: string;
  readonly granted: boolean;
  readonly runtime: string | null;
  readonly tools: readonly ToolState[];
  readonly grantedBy?: string;
  readonly grantedAt?: number;
  readonly secrets?: readonly string[];
}

/** A named secret as the owner sees it: never its value. */
export interface SecretView {
  readonly name: string;
  readonly set: boolean;
  readonly suffix: string;
}

/** A grant as the owner's Settings section lists it, with the instruction's title. */
export interface GrantRow {
  readonly instruction: string;
  readonly title: string;
  readonly grantedBy: string;
  readonly grantedAt: number;
  readonly secrets: readonly string[];
}

/** What the owner's Settings section is handed. */
export interface InstructionGrants {
  readonly grants: readonly GrantRow[];
  readonly secrets: readonly SecretView[];
}

/** What the grant control and the headlines are handed for a document. */
export type InstructionTools =
  | { readonly instruction: false }
  | { readonly instruction: true; readonly owner: boolean; readonly grant: GrantView | null; readonly secrets: readonly SecretView[] };

/** The chip's options in their order: *No instruction*, then the instructions
 * carrying a role the block or its document takes, then the rest, each by
 * title. */
export function orderedChoices(instructions: readonly InstructionChoice[]): readonly InstructionChoice[] {
  const byTitle = (left: InstructionChoice, right: InstructionChoice) => left.title.localeCompare(right.title) || (left.id < right.id ? -1 : 1);
  return [...instructions.filter((instruction) => instruction.matches).sort(byTitle), ...instructions.filter((instruction) => !instruction.matches).sort(byTitle)];
}

/** What a tool's state reads as on its code block. */
export const TOOL_STATE_WORDS: Readonly<Record<ToolState["state"], string>> = {
  granted: "granted",
  changed: "changed since the grant",
  never: "offline",
};

import { APPLY_A_STRUCTURE, EXTEND_A_STRUCTURE, FILL_A_FIELD_INSTRUCTION, SHAPE_AN_INSTRUCTION } from "~/extensions/documents/lib/instruction";

export { APPLY_A_STRUCTURE, EXTEND_A_STRUCTURE, FILL_A_FIELD_INSTRUCTION, SHAPE_AN_INSTRUCTION };

/**
 * The instructions the release makes on every instance (`BO_0349_033`): each
 * a document under its fixed id carrying `record: instruction` and the
 * built-in *Instruction*, its words the release's, made once by the migration
 * `builtin-instructions` where an instance holds none. A person reads and
 * revises one as any instruction, and nothing of the release is written over
 * it again. The drops that start work run under them (`BO_0349_Q4`).
 */
export const BUILTIN_INSTRUCTIONS: readonly { readonly id: string; readonly title: string; readonly words: readonly string[] }[] = [
  {
    id: FILL_A_FIELD_INSTRUCTION,
    title: "Fill a field",
    words: [
      "A block was put into a field of a structure, and the field holds a kind of value that is not text: a number, a date, true or false, a choice, or a file. Read the value off that block.",
      "The request names the structured block (#1), the block put into the field (#2), the structure, the field and its kind. Read #2's words, then propose the field's value on #1 with propose_structures, for that structure and that field alone.",
      "Write the value as the field's kind takes it: a number as a number, a date as YYYY-MM-DD, true or false, a choice exactly as one of its options is written. A file cannot be read off words: propose nothing for it and say so.",
      "Propose nothing else: no other field, no other structure, no change to either block's words. If #2 says nothing that fits the field, propose nothing and say why in one sentence.",
    ],
  },
  {
    id: SHAPE_AN_INSTRUCTION,
    title: "Shape an instruction",
    words: [
      "Someone dropped a block (#1) on the instruction this run is aimed at, as an example of what the instruction should produce. Teach the instruction by that example.",
      "Read the instruction's blocks and #1. Find what #1 does that the instruction does not yet ask for — its voice, its form, its length, what it includes and what it leaves out — and what the instruction asks for that #1 contradicts.",
      "Propose revisions to the instruction's own blocks so that, followed, it would produce material like #1: rewrite a block, add one, or remove one, and keep what already holds. Teach #1's manner, never its subject: no fact, name or topic of #1 goes into the instruction.",
      "Propose nothing outside the instruction and never change #1. If the instruction would already produce material like #1, propose nothing and say so in one sentence.",
    ],
  },
  {
    id: EXTEND_A_STRUCTURE,
    title: "Extend a structure",
    words: [
      "Someone dropped a block (#1) on the structure this run is aimed at, as an example of what the structure should hold. Read the structure's fields off its document and find what #1 says that no field holds yet.",
      "For each thing #1 says that a block using the structure would want to hold as a value of its own — a date, a number, a name, a choice among a few options, a longer text — propose a new field: insert a block into the structure's document whose words are the field's name, and propose Field on it with propose_structures, giving its type and, for a choice, its options.",
      "Propose only fields the structure lacks, named as a reader of the structure would name them, never #1's own words as a field's name and never a value of #1. Change no field that stands, and never change #1.",
      "If every thing #1 says already has a field, propose nothing and say so in one sentence.",
    ],
  },
  {
    id: APPLY_A_STRUCTURE,
    title: "Apply a structure",
    words: [
      "Someone dropped a structure (#1) on the document this run is aimed at, to apply it to what the document already says. Read the structure's fields off #1 and the document's blocks.",
      "Propose the structure on the document with propose_structures, and for each field the document's words answer, propose its value: a text field the words that play it, a number as a number, a date as YYYY-MM-DD, a choice exactly as one of its options is written, a reference the block that plays it.",
      "Read values off the words that stand; never rewrite, add or remove a block, and never invent a value the document does not say. A required field the document does not answer stays empty and is said in one sentence.",
      "If the document already uses the structure, propose only the values it lacks. If the structure cannot be used here, propose nothing and say why in one sentence.",
    ],
  },
];
