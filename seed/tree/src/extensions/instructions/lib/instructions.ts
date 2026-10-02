import type { InstructionSummary } from "~/extensions/documents/lib/instruction";

/**
 * The words `instructions` shares between its server half and its views
 * (`calliopa-bootstrap`'s `BO_0311`). Client-safe: nothing here reaches the
 * graph or the kernel.
 */

/** The built-in role every instruction takes (`structures`' built-ins). */
export const INSTRUCTION_STRUCTURE = "builtin:profile";

/** The option the chip sets on a command, which the kernel reads. */
export const INSTRUCTION_OPTION = "instruction";

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
