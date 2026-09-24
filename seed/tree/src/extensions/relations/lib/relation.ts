import type { Run } from "~/lib/runs";

/**
 * What a relation is, as this extension declares it in the graph
 * (`BO_0288_015`). A relation anchors a block, not a claim: any block says
 * something, and a claim only ever existed where refinement had been
 * (`BO_0288`, user decision 2026-09-23).
 */
export const RELATION_TYPE = "relation";
export const SOURCE = "source";
export const TARGET = "target";

export const RELATION_KINDS = [
  "dependsOn",
  "supports",
  "contradicts",
  "qualifies",
  "constrains",
  "implements",
  "supersedes",
  "evidences",
  "opensQuestionIn",
  "affectedBy",
] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

export const RELATION_ORIGINS = ["declared", "derived", "inferred"] as const;
export type RelationOrigin = (typeof RELATION_ORIGINS)[number];

export const isRelationKind = (value: unknown): value is RelationKind =>
  typeof value === "string" && (RELATION_KINDS as readonly string[]).includes(value);
export const isRelationOrigin = (value: unknown): value is RelationOrigin =>
  typeof value === "string" && (RELATION_ORIGINS as readonly string[]).includes(value);

/** One end of a relation: a block, of this document or another. */
export interface RelationEndInput {
  readonly blockId: string;
}

export interface RelationInput {
  readonly kind: RelationKind;
  readonly reason: readonly Run[];
  readonly origin?: RelationOrigin;
  readonly source: RelationEndInput;
  readonly target: RelationEndInput;
}
