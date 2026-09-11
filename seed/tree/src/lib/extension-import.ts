/**
 * An extension import as the kernel stages and reports it (`ui-kernel.md`,
 * `BO_0224_003`, `BO_0224_004`): the summary the owner reads before accepting,
 * and the steps the import tab walks — open, accepted, then switched on or
 * served. Pure rules here; the tab and the section render them. BO_0224_011
 */

export interface ImportDependency {
  readonly id: string;
  readonly range: string;
  readonly held?: string;
  readonly present: boolean;
  readonly satisfied: boolean;
}

export interface ImportRefusal {
  readonly Path: string;
  readonly Reason: string;
}

export interface ImportSummary {
  readonly proposal?: string;
  readonly dataRevision?: number;
  readonly id: string;
  readonly kind: "new" | "update";
  readonly from?: string;
  readonly to: string;
  readonly category: string;
  readonly categoryRewritten: boolean;
  readonly files: {
    readonly added: readonly string[];
    readonly changed: readonly string[];
    readonly removed: readonly string[];
  };
  readonly members: Readonly<Record<string, number>>;
  readonly documents: number;
  readonly documentsSkipped: readonly string[];
  readonly migrations: readonly string[];
  readonly dependencies: readonly ImportDependency[];
  readonly refusals: readonly ImportRefusal[];
  readonly inactive: boolean;
  readonly rationale: string;
}

export interface ImportPromotion {
  readonly status: "running" | "promoted" | "refused";
  readonly reason?: string;
  readonly pin?: number;
  readonly detail?: string;
  readonly by?: string;
}

/** What the kernel answers about a staged import, on staging and on re-read. */
export interface ImportRecord {
  readonly proposal: string;
  readonly summary: ImportSummary;
  /** The group's state as the graph holds it: `open`, `accepted`, `rejected`, or `unknown`. */
  readonly state: string;
  readonly by: string;
  readonly stagedAt: string;
  readonly promotion?: ImportPromotion;
}

/** The title the import tab carries. */
export function importTitle(summary: Pick<ImportSummary, "id" | "to">): string {
  return `Import ${summary.id} ${summary.to}`;
}

/**
 * The step after acceptance: a new extension arrives switched off and is
 * switched on through the state route (the range check and the gate); an
 * update leaves the state alone and is served by a promotion of head.
 */
export function nextStep(summary: Pick<ImportSummary, "kind" | "inactive">): "switch-on" | "serve" {
  return summary.kind === "new" || summary.inactive ? "switch-on" : "serve";
}

/** One line per fact of the summary, in the order the tab lists them. */
export function describeImport(summary: ImportSummary): readonly string[] {
  const lines: string[] = [];
  lines.push(
    summary.kind === "new"
      ? `New extension ${summary.id} at version ${summary.to}`
      : `Update of ${summary.id} from ${summary.from ?? "?"} to ${summary.to}`,
  );
  if (summary.categoryRewritten) {
    lines.push("The archive said bundled; it lands as individual, so a release of this instance never ships it.");
  }
  lines.push(
    `Files: ${summary.files.added.length} added, ${summary.files.changed.length} changed, ${summary.files.removed.length} removed`,
  );
  const members = Object.entries(summary.members).sort(([a], [b]) => a.localeCompare(b));
  if (members.length > 0) {
    lines.push(`Members: ${members.map(([kind, count]) => `${count} ${kind}`).join(", ")}`);
  }
  lines.push(
    `Change documents: ${summary.documents} staged` +
      (summary.documentsSkipped.length > 0
        ? `, ${summary.documentsSkipped.length} skipped by title (${summary.documentsSkipped.join(", ")})`
        : ""),
  );
  for (const migration of summary.migrations) {
    lines.push(`Migration ${migration}: runs when the extension is served`);
  }
  for (const dependency of summary.dependencies) {
    lines.push(
      `Depends on ${dependency.id} ${dependency.range}: ` +
        (dependency.present
          ? `the instance holds ${dependency.held ?? "?"}, ${dependency.satisfied ? "in range" : "out of range"}`
          : "absent from the instance"),
    );
  }
  for (const refusal of summary.refusals) {
    lines.push(`Refused ${refusal.Path}: ${refusal.Reason}`);
  }
  if (summary.inactive) {
    lines.push("Arrives switched off: nothing runs until you switch it on.");
  }
  return lines;
}
