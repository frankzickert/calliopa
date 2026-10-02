import { createContextId, type QRL } from "@builder.io/qwik";

import type { Run } from "~/lib/runs";

import type { TriggerEntry } from "../lib/inline-triggers";

/**
 * The inline triggers the editor offers while a text block is edited
 * (`calliopa-bootstrap`'s `BO_0310_011`), by the extension that registers
 * them: a decoration provider mounted around the document writes its own and
 * bumps `version`, as it writes its inline annotations. The editor draws the
 * list `#` draws, filled from what the provider registered, and writes the run
 * a choice answers. With no provider, the character is a character.
 */
export interface InlineTrigger {
  /** The character that opens the list. */
  readonly character: string;
  /** What the list offers, narrowed by the words typed. */
  readonly entries: readonly TriggerEntry[];
  /** What the list's last entry says before the words typed, when the
   * extension can create an entry for them: *Create keyword*. */
  readonly createLabel?: string;
  /** The run a chosen entry writes in place of the character and the words. */
  readonly run$: QRL<(entry: TriggerEntry) => Run>;
  /** Creates an entry for the words typed, or says why not in words. */
  readonly create$?: QRL<(typed: string) => Promise<TriggerEntry | { readonly failure: string }>>;
}

export interface InlineTriggers {
  triggers: Record<string, InlineTrigger>;
  version: number;
}

export const InlineTriggersContext = createContextId<InlineTriggers>("documents.inline-triggers");

/** The registered triggers, by character; `#` is the editor's own and never
 * one of them. */
export function triggersByCharacter(store: InlineTriggers | null): Record<string, InlineTrigger> {
  const found: Record<string, InlineTrigger> = {};
  if (store === null) return found;
  for (const source of Object.keys(store.triggers).sort()) {
    const trigger = store.triggers[source];
    if (trigger === undefined || trigger.character === "#" || [...trigger.character].length !== 1) continue;
    if (found[trigger.character] === undefined) found[trigger.character] = trigger;
  }
  return found;
}
