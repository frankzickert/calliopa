import { randomUUID } from "node:crypto";
import { outsideBranch } from "~/server/ccgw/branch-scope";
import { query, write } from "~/server/ccgw/client";
import { bareId, contentOf, typeOf } from "~/server/ccgw/nodes";
import { isBlobReference, type BlobReference } from "~/server/ccgw/blobs";
import type { GraphOutcome } from "~/server/outcome";

export interface AdmonitionPattern {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly image?: BlobReference | string;
  readonly footline?: string;
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
const valid = (value: unknown): value is Omit<AdmonitionPattern, "id"> => {
  const input = record(value);
  return input !== null && typeof input.name === "string" && input.name.trim() !== "" &&
    typeof input.color === "string" && /^#[0-9a-f]{6}$/iu.test(input.color) &&
    (input.image === undefined || input.image === null || input.image === "" || isBlobReference(input.image) || typeof input.image === "string") &&
    (input.footline === undefined || typeof input.footline === "string");
};
const toPattern = (id: string, value: Record<string, unknown>): AdmonitionPattern => {
  const image = value.image;
  return {
    id, name: String(value.name ?? ""), color: String(value.color ?? "#607d8b"),
    ...(typeof image === "string" && image !== "" || isBlobReference(image) ? { image } : {}),
    ...(typeof value.footline === "string" && value.footline !== "" ? { footline: value.footline } : {}),
  };
};

export async function listAdmonitionPatterns(): Promise<GraphOutcome<readonly AdmonitionPattern[]>> {
  const answer = await outsideBranch(() => query({
    statement: "MATCH (p:admonition_pattern) RETURN GRAPH p",
    unbounded: true,
    purpose: "admonition patterns",
  }));
  if (answer.outcome === "noResult") return { outcome: "success", result: [] };
  if (answer.outcome !== "success") return answer as GraphOutcome<never>;
  return {
    outcome: "success",
    result: answer.result.nodes.filter((node) => typeOf(node) === "admonition_pattern" && node.revision.status === "established")
      .map((node) => toPattern(bareId(node.id), contentOf(node))).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function saveAdmonitionPattern(input: unknown, id?: string): Promise<GraphOutcome<AdmonitionPattern>> {
  if (!valid(input) || id === undefined && typeof input.image === "string" && input.image !== "") return { outcome: "validationFailure", failures: [{ operation: null, rule: "admonition-pattern", detail: "A pattern has a name, a six-digit hex color, an optional uploaded image, and an optional footline." }] };
  const patternId = id ?? randomUUID();
  const values = { name: input.name.trim(), color: input.color.toLowerCase(), image: input.image ?? "", footline: input.footline ?? "" };
  const statement = id === undefined
    ? "CREATE (p:admonition_pattern {id: $id, name: $name, color: $color, image: $image, footline: $footline, status: \"established\"})"
    : "MATCH (p:admonition_pattern {id: $id}) SET p.name = $name, p.color = $color, p.image = $image, p.footline = $footline";
  const answer = await outsideBranch(() => write(statement, { id: patternId, ...values }, id === undefined ? `create admonition pattern ${values.name}` : `revise admonition pattern ${patternId}`));
  if (answer.outcome !== "success") return answer as GraphOutcome<never>;
  return { outcome: "success", result: toPattern(patternId, values) };
}

export async function updateAdmonitionPattern(id: string, value: unknown): Promise<GraphOutcome<AdmonitionPattern>> {
  const found = await listAdmonitionPatterns();
  if (found.outcome !== "success") return found as GraphOutcome<never>;
  const existing = found.result.find((pattern) => pattern.id === id);
  if (existing === undefined) return { outcome: "noResult", detail: `No admonition pattern ${id}.` };
  const image = record(value)?.image;
  if (typeof image === "string" && image !== "" && existing.image !== image) {
    return { outcome: "validationFailure", failures: [{ operation: null, rule: "admonition-pattern", detail: "Choose an image file to set a pattern image." }] };
  }
  return saveAdmonitionPattern(value, id);
}
