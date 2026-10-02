import type { GraphOutcome } from "~/server/outcome";

/** What a declined proposal is called in a notice: the first words it would
 * write, or what it would do when it writes none. DO_0024_001 */
export interface DeclinedItem {
  readonly kind: string;
  readonly block: object | null;
}

const WORDS = 40;

const nameOf = (item: DeclinedItem | undefined): string => {
  if (item === undefined) return "a proposal";
  const runs = item.block !== null && "runs" in item.block ? (item.block.runs as readonly { readonly text?: string }[]) : [];
  const words = runs.map((run) => run.text ?? "").join("").replace(/\s+/gu, " ").trim();
  if (words === "") return `a proposed ${item.kind}`;
  return `“${words.length > WORDS ? `${words.slice(0, WORDS).trimEnd()}…` : words}”`;
};

/**
 * The one notice for the declines of a marked selection that were refused:
 * each proposal that stayed is named, and why when there is one reason for
 * all. A proposal an earlier answer already settled is gone and never named
 * here. User decision, 2026-09-30. DO_0024_001
 */
export function declineNotice(
  stayed: readonly { readonly item: DeclinedItem | undefined; readonly outcome: GraphOutcome<unknown> }[],
  describe: (outcome: GraphOutcome<unknown>) => string,
): string {
  const names = stayed.map((entry) => nameOf(entry.item));
  const reasons = [...new Set(stayed.map((entry) => describe(entry.outcome)).filter((reason) => reason !== ""))];
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  const verb = names.length === 1 ? "was" : "were";
  return `${list} ${verb} not declined and stayed${reasons.length === 1 ? `: ${reasons[0]}` : "."}`;
}
