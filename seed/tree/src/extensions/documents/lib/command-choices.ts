import { FIRST_MODE, readWorkingMode, type WorkingMode } from "./working-mode";

/**
 * What a block's command line says about how it is sent (`DO_0025`): whether
 * *Keep as content* is on, and the working mode the command carries. Each
 * block remembers its own. The device keeps them per document and block for
 * the page and after a reload, as it keeps a prompt's marks; a device holding
 * none reads them back from what was sent — the mode from the latest run sent
 * from the block, *Keep as content* on when such a run exists and the block
 * does not stand as a prompt. A block never sent starts with *Keep as content*
 * off and the mode last sent in the document, or explore + create. Pure, so
 * the line and the shortcut cannot disagree. DO_0025_002 DO_0025_003
 */
export interface CommandChoice {
  readonly keep: boolean;
  readonly mode: WorkingMode;
  /** Whether the device held it, so a later read of the runs does not
   * overwrite what the person chose. */
  readonly stored: boolean;
}

/** A run of the document, as its run list answers it. */
export interface SentRun {
  readonly source: string | null;
  readonly startedAt: number;
  readonly mode?: { readonly field: string; readonly work: string };
  /** The run, its command's words and the group it staged, as the runs list
   * answers them: what a card names its run by. BO_0350_013 */
  readonly id?: string;
  readonly goal?: string;
  readonly group?: string | null;
}

/** Where the device keeps a block's choices, beside its marks. */
export const commandChoiceKey = (documentId: string, blockId: string): string =>
  `calliopa.command.${documentId}.${blockId}`;

/** What the device holds for a block, or nothing when it holds nothing it can
 * read. */
export function readStoredChoice(raw: string | null): { readonly keep?: boolean; readonly mode?: WorkingMode } {
  if (raw === null) return {};
  try {
    const value = JSON.parse(raw) as { keep?: unknown; mode?: unknown };
    const mode = readWorkingMode(value.mode);
    return {
      ...(typeof value.keep === "boolean" ? { keep: value.keep } : {}),
      ...(mode === null ? {} : { mode }),
    };
  } catch {
    return {};
  }
}

/** The device's form of a block's choices. */
export const storedChoice = (choice: Pick<CommandChoice, "keep" | "mode">): string =>
  JSON.stringify({ keep: choice.keep, mode: choice.mode });

/**
 * A block's choices: the device's where it holds them, else read back from the
 * runs sent from the block and its standing, else the start of a block never
 * sent.
 */
export function resolveChoice(
  stored: { readonly keep?: boolean; readonly mode?: WorkingMode },
  runs: readonly SentRun[],
  blockId: string,
  standing: string | undefined,
  lastSent: WorkingMode | null,
): CommandChoice {
  const sent = runs.filter((run) => run.source === blockId).sort((a, b) => b.startedAt - a.startedAt);
  const latestMode = sent.map((run) => readWorkingMode(run.mode)).find((mode) => mode !== null) ?? null;
  return {
    keep: stored.keep ?? (sent.length > 0 && standing !== "prompt"),
    mode: stored.mode ?? latestMode ?? lastSent ?? FIRST_MODE,
    stored: stored.keep !== undefined || stored.mode !== undefined,
  };
}

/** *Send*'s name, the way it sends now, with the shortcut. DO_0025_001 */
export const sendName = (keep: boolean, shortcut: string): string =>
  `${keep ? "Send, keep as content" : "Send as prompt"} · ${shortcut}`;
