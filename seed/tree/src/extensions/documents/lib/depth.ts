import type { BlockView, TextBlockView } from "../../documents/server/assemble";
import type { BlockProvenance, DocumentRelations, RelationProvenance, RelationView } from "../../documents/server/work";

/**
 * What a focused block's depth holds, decided without a browser (`CA_0046`):
 * which categories have material and so appear on the affordance line, in
 * which order the layers unfold, and which blocks are derived and where they
 * sit. The material's rules: depth is invisible while reading and
 * discoverable while interacting; only categories that hold material appear;
 * each layer adds a distinct kind of meaning; tension before background.
 */

/** The derived kinds a system run maintains, in the order their sections
 * follow the body, with the heading each renders under. */
export const DERIVED_SECTIONS = [
  { kind: "frontier", heading: "What matters now", icon: "flag" },
  { kind: "tension", heading: "Tension", icon: "warning" },
  { kind: "alternative", heading: "Alternatives", icon: "lightbulb" },
  { kind: "consequence", heading: "If accepted", icon: "arrow-circle-up" },
  { kind: "next", heading: "Next", icon: "caret-right" },
] as const;
export type DerivedSection = (typeof DERIVED_SECTIONS)[number]["kind"];

const isText = (block: BlockView): block is TextBlockView => block.kind === "text";

/**
 * The section a block renders in after the body, or null for a body block.
 * `frontier`, `tension` and `next` are derived by kind; an `alternative` or
 * `consequence` only when a run maintains it, which its `derivedFrom` says. A
 * `synthesis` stays in the body where it sits.
 */
export function derivedSection(block: BlockView): DerivedSection | null {
  if (!isText(block) || block.blockKind === undefined) return null;
  const kind = block.blockKind;
  if (kind === "frontier" || kind === "tension" || kind === "next") return kind;
  if ((kind === "alternative" || kind === "consequence") && (block.derivedFrom?.length ?? 0) > 0) return kind;
  return null;
}

/** Whether a block is one a run maintains: it sits in a derived section, or
 * a synthesis a run derived. */
export const isDerived = (block: BlockView): boolean =>
  derivedSection(block) !== null ||
  (isText(block) && block.blockKind === "synthesis" && (block.derivedFrom?.length ?? 0) > 0);

export type DepthLayer = "pressure" | "relevance" | "provenance" | "evidence" | "relations" | "history" | "derived";

export const LAYER_LABEL: Readonly<Record<DepthLayer, string>> = {
  pressure: "Changed upstream",
  relevance: "Why this matters now",
  provenance: "Provenance",
  evidence: "Evidence",
  relations: "Related work",
  history: "History",
  derived: "Derived for this root",
};

/** A piece of evidence: a relation landing on one of the block's claims. */
export interface EvidenceEntry {
  readonly relation: RelationView;
  /** *Accepted*, *Proposed*, or *Not yet tested* for an open question. */
  readonly standing: "Accepted" | "Proposed" | "Not yet tested";
  /** Contradicting and untested material comes before supporting. */
  readonly tension: boolean;
}

const claimIds = (relations: DocumentRelations, blockId: string): ReadonlySet<string> =>
  new Set((relations.claims[blockId] ?? []).map((claim) => claim.claimId));

const live = (relation: RelationView): boolean => relation.state !== "retired" && relation.state !== "orphaned";

/** The evidence layer's entries for a block, tension first. */
export function evidenceOf(relations: DocumentRelations | null, blockId: string): readonly EvidenceEntry[] {
  if (relations === null) return [];
  const mine = claimIds(relations, blockId);
  const entries: EvidenceEntry[] = [];
  for (const relation of relations.relations) {
    if (!live(relation) || !mine.has(relation.target.claimId)) continue;
    if (relation.kind === "contradicts") {
      entries.push({ relation, standing: relation.source.status === "established" ? "Accepted" : "Proposed", tension: true });
    } else if (relation.kind === "opensQuestionIn") {
      entries.push({ relation, standing: "Not yet tested", tension: true });
    } else if (relation.kind === "supports" || relation.kind === "evidences") {
      entries.push({ relation, standing: relation.source.status === "established" ? "Accepted" : "Proposed", tension: false });
    }
  }
  return [...entries.filter((entry) => entry.tension), ...entries.filter((entry) => !entry.tension)];
}

/** The block's orphaned relations — an end block retired or discarded —
 * drawn only in its history layer, so a dead edge is on record and never
 * fires. BO_0248_016 */
export function orphanedOf(relations: DocumentRelations | null, blockId: string): readonly RelationView[] {
  if (relations === null) return [];
  const mine = claimIds(relations, blockId);
  return relations.relations.filter((relation) => relation.state === "orphaned" && (mine.has(relation.source.claimId) || mine.has(relation.target.claimId)));
}

/** Every other declared relation on the block's claims, as the relations
 * layer lists them: the ones evidence does not show, live ones only. */
export function relatedOf(relations: DocumentRelations | null, blockId: string): readonly RelationView[] {
  if (relations === null) return [];
  const mine = claimIds(relations, blockId);
  const evidence = new Set(evidenceOf(relations, blockId).map((entry) => entry.relation.relationId));
  return relations.relations.filter(
    (relation) => live(relation) && !evidence.has(relation.relationId) && (mine.has(relation.source.claimId) || mine.has(relation.target.claimId)),
  );
}

/** The derived blocks whose `derivedFrom` names this block: why it matters now. */
export const relevanceOf = (blocks: readonly BlockView[], blockId: string): readonly TextBlockView[] =>
  blocks.filter((block): block is TextBlockView => isText(block) && isDerived(block) && (block.derivedFrom ?? []).includes(blockId));

/**
 * Whether provenance and history have anything to say: a block a person wrote
 * in one revision has nothing to reveal, so a plain paragraph in a document
 * with no relations shows nothing on focus but its focus ring. A run's hand
 * anywhere in the history, or a maintained block, is material.
 */
export const provenanceMatters = (provenance: BlockProvenance | null): boolean =>
  provenance !== null && provenance.provenance !== "" && provenance.provenance !== "human-authored";

/**
 * The categories the affordance line names for a focused block, in the
 * order the layers unfold. Empty when nothing holds material.
 */
export function affordanceOf(input: {
  readonly block: BlockView;
  readonly blocks: readonly BlockView[];
  readonly relations: DocumentRelations | null;
  readonly provenance: BlockProvenance | null;
  /** Whether unresolved pressure stands on the block: its layer comes
   * before every other. BO_0248_008 */
  readonly pressure?: boolean;
  /** Whether any judgement is on record for the block, which its history lists. BO_0248_016 */
  readonly judged?: boolean;
}): readonly DepthLayer[] {
  const { block, blocks, relations, provenance } = input;
  const pressure: DepthLayer[] = input.pressure === true ? ["pressure"] : [];
  if (isDerived(block)) {
    return [...pressure, "derived", "provenance"];
  }
  const layers: DepthLayer[] = [...pressure];
  if (relevanceOf(blocks, block.blockId).length > 0) layers.push("relevance");
  if (provenanceMatters(provenance)) layers.push("provenance");
  if (evidenceOf(relations, block.blockId).length > 0) layers.push("evidence");
  if (relatedOf(relations, block.blockId).length > 0) layers.push("relations");
  // History has material once anything else does, or once more than one
  // hand touched the block; on request either way.
  if (layers.length > 0 || provenanceMatters(provenance) || input.judged === true || orphanedOf(relations, block.blockId).length > 0) layers.push("history");
  return layers;
}

/** The kind a relation reads as, in the relations layer's words. */
export const KIND_WORDS: Readonly<Record<string, string>> = {
  dependsOn: "Depends on",
  supports: "Supports",
  contradicts: "Contradicts",
  qualifies: "Qualifies",
  constrains: "Constrains",
  implements: "Implements",
  supersedes: "Supersedes",
  evidences: "Provides evidence for",
  opensQuestionIn: "Opens a question in",
  affectedBy: "Is affected by",
};


/**
 * A relation's provenance in words, for the line under it in the layers:
 * its origin, who drafted the reason, who confirmed it, who edited it after —
 * in that order, each part only where it holds, joined by middle dots:
 * *system-inferred · system-drafted reason · confirmed by Alice · later
 * edited by Ben*; a person's own relation says *declared · reason by Alice*.
 * Confirmation launders nothing. BO_0247_006
 */
export function provenanceWords(provenance: RelationProvenance): string {
  const parts: string[] = [];
  parts.push(provenance.origin === "inferred" ? "system-inferred" : provenance.origin === "derived" ? "derived" : "declared");
  if (provenance.draftedBy !== "") {
    parts.push(provenance.draftedBy.startsWith("agent:") ? "system-drafted reason" : `reason by ${provenance.draftedBy}`);
  }
  if (provenance.confirmedBy !== null && provenance.confirmedBy !== "") parts.push(`confirmed by ${provenance.confirmedBy}`);
  if (provenance.editedBy.length > 0) parts.push(`later edited by ${provenance.editedBy.join(", ")}`);
  return parts.join(" · ");
}
