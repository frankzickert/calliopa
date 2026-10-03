import type { GraphOutcome } from "~/server/outcome";

/**
 * `keywords`' executable migration `merge-keyword-roles`
 * (`calliopa-bootstrap`'s `BO_0310_021`): the roles a person chose in the
 * Keywords section before `BO_0310` were merged into the built-ins *Keyword*,
 * *Definition* and *Alias*. Every instance an update reaches ran it on the
 * release that carried it, and a structure is now a document (`structures`'
 * `RO_0005`), which the merge of roles as nodes cannot reach, so it answers
 * nothing; the member stays so an instance never runs it twice.
 */

/** A migration's answer: one script, or an empty statement. */
export interface MigrationStatement {
  readonly statement: string;
  readonly parameters: Record<string, unknown>;
}

/** The migrations this extension runs, by the route segment its member
 * names; the kernel posts the owner's settings with the call. */
export const MIGRATIONS: Readonly<Record<string, (settings: unknown) => Promise<GraphOutcome<MigrationStatement>>>> = {
  "merge-keyword-roles": async () => ({ outcome: "success", result: { statement: "", parameters: {} } }),
};
