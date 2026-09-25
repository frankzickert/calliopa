import { kernelState } from "~/server/kernel/client";

import { NO_SETTINGS, type KeywordsSettings, type RoleChoice } from "../lib/keywords";

/**
 * The extension's per-instance settings (`BO_0301_012`): which document role
 * marks a keyword, which role holds a keyword's definition and which block
 * role its aliases. Kept in the kernel's settings record under this
 * extension's id, as the bibliography keeps the instance's citation style:
 * read by anyone signed in, written by the owner alone — the kernel refuses
 * anyone else, and the section says so. A fresh install holds no record,
 * which reads as no role chosen: nothing is matched and nothing is drawn.
 */
const RECORD = "keywords";

interface Stored {
  readonly id: string;
  readonly keywordRole?: unknown;
  readonly definitionRole?: unknown;
  readonly aliasRole?: unknown;
}

const roleId = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

const roleChoice = (value: unknown): RoleChoice | null => {
  if (typeof value !== "object" || value === null) return null;
  const record = value as { kind?: unknown; id?: unknown };
  const id = roleId(record.id);
  if (id === null || (record.kind !== "block" && record.kind !== "document")) return null;
  return { kind: record.kind, id };
};

export function settingsOf(stored: Stored | null): KeywordsSettings {
  if (stored === null) return NO_SETTINGS;
  return {
    keywordRole: roleId(stored.keywordRole),
    definitionRole: roleChoice(stored.definitionRole),
    aliasRole: roleId(stored.aliasRole),
  };
}

export async function readSettings(): Promise<KeywordsSettings> {
  try {
    return settingsOf(await kernelState.read<Stored>("settings", RECORD));
  } catch {
    return NO_SETTINGS;
  }
}

/** The settings written whole, as the owner; the kernel's refusal is thrown
 * as it comes, for the route to say in words. */
export async function writeSettings(settings: KeywordsSettings): Promise<KeywordsSettings> {
  await kernelState.write("settings", {
    id: RECORD,
    keywordRole: settings.keywordRole,
    definitionRole: settings.definitionRole,
    aliasRole: settings.aliasRole,
  });
  return settings;
}
