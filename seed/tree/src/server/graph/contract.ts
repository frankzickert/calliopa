import type { JSONValue } from "postgres";

/**
 * A list that cannot be empty. The read contract uses it for roots, so an
 * unrooted read is not expressible rather than refused at runtime.
 */
export type NonEmpty<T> = readonly [T, ...T[]];

/** Which revision of the graph a read resolves against. */
export type RevisionSelection =
  | { readonly at: "current" }
  | { readonly at: "dataRevision"; readonly dataRevision: string };

/** Which way a relation points, relative to the node being expanded. */
export type TraversalDirection = "outgoing" | "incoming" | "both";

/**
 * One traversal step. `depth` is required, so every step states how far it
 * goes and no request can ask the graph to follow relations indefinitely.
 */
export interface TraversalStep {
  readonly direction: TraversalDirection;
  readonly depth: number;
  /** Absent means every relation type. Present narrows to these. */
  readonly relationTypes?: readonly string[];
}

export interface GraphReadRequest {
  readonly roots: NonEmpty<string>;
  readonly traverse?: readonly TraversalStep[];
  readonly selection?: RevisionSelection;
  /**
   * A proposal group to lay over established truth. Absent means truth alone,
   * which is what every read that did not ask for a proposal answers.
   */
  readonly proposalGroupId?: string;
}

/** The deepest total traversal a single read may ask for. */
export const MAX_TRAVERSAL_DEPTH = 16;

/**
 * Root resolution by node type: how a consumer obtains roots it cannot name
 * in advance. It follows no relation and reads no revision content, so a
 * consumer still has to ask for what it wants through a rooted read.
 */
export interface RootResolutionRequest {
  readonly semanticType: string;
}

export interface ResolvedRoots {
  readonly semanticType: string;
  /** Logical identities in creation order, which is deterministic and stable
   * as nodes are revised. A caller ordering by content sorts these and keeps
   * creation order for the values that tie. */
  readonly nodeIds: readonly string[];
}

/**
 * Identities to account for. At least one must be named, because a summary
 * over nothing has nothing to report.
 *
 * Nodes and relations are named separately because they are written
 * differently: a node accumulates revisions, while a relation is written once
 * and thereafter changes only through its validity.
 */
export interface ChangeSummaryRequest {
  readonly nodeIds?: readonly string[];
  readonly relationIds?: readonly string[];
}

/**
 * How many times a named set of identities has been written, and when the most
 * recent write happened.
 *
 * A data revision is one transaction, so a write that touched several of the
 * named identities counts once however many records it left behind.
 *
 * This is a count and a time, not a way into history: it carries no revision
 * identity a caller could read content back through.
 */
export interface ChangeSummary {
  readonly changeCount: number;
  /** Null only when nothing named here has ever been written. */
  readonly lastWrittenAt: string | null;
}

export interface GraphNodeView {
  readonly nodeId: string;
  readonly revisionId: string;
  readonly semanticType: string;
  readonly content: JSONValue;
  readonly provenance: JSONValue;
  readonly schemaVersion: number;
  readonly dataRevision: string;
}

export type RelationEndpoint =
  | { readonly kind: "node"; readonly nodeId: string }
  | { readonly kind: "relation"; readonly relationId: string };

export interface RelationValidityView {
  readonly status: "active" | "closed";
  readonly establishedDataRevision: string;
  readonly closedDataRevision: string | null;
}

export interface GraphRelationView {
  readonly relationId: string;
  readonly relationType: string;
  readonly fromNodeId: string;
  readonly target: RelationEndpoint;
  readonly provenance: JSONValue;
  readonly schemaVersion: number;
  readonly dataRevision: string;
  readonly validity: RelationValidityView;
}

/** The one shape every successful read returns. */
export interface AssembledGraph {
  readonly roots: readonly string[];
  readonly nodes: readonly GraphNodeView[];
  readonly relations: readonly GraphRelationView[];
  /**
   * The nodes answered from the overlaid proposal rather than from truth.
   * Absent from a read that named no group, so a reader cannot mistake staged
   * content for something the graph holds.
   */
  readonly fromProposal?: readonly string[];
}

/** A node named by identity, or by a reference minted earlier in this mutation. */
export type NodeRef =
  | { readonly kind: "id"; readonly nodeId: string }
  | { readonly kind: "ref"; readonly ref: string };

export type RelationRef =
  | { readonly kind: "id"; readonly relationId: string }
  | { readonly kind: "ref"; readonly ref: string };

export type MutationEndpoint =
  | { readonly kind: "node"; readonly node: NodeRef }
  | { readonly kind: "relation"; readonly relation: RelationRef };

/**
 * `reviseNode` requires `baseRevisionId`, so a write onto existing content
 * always states what it was written against and a stale write is detectable
 * rather than silent.
 */
export type GraphOperation =
  | {
      readonly op: "createNode";
      readonly ref: string;
      readonly semanticType: string;
      readonly content: JSONValue;
    }
  | {
      readonly op: "reviseNode";
      readonly nodeId: string;
      readonly baseRevisionId: string;
      readonly semanticType: string;
      readonly content: JSONValue;
    }
  | {
      readonly op: "createRelation";
      readonly ref?: string;
      readonly relationType: string;
      readonly from: NodeRef;
      readonly to: MutationEndpoint;
    }
  | { readonly op: "closeRelation"; readonly relationId: string }
  /**
   * Archives a node's established revision, which leaves the node with no
   * established truth and so unreadable in current state. It names the
   * revision it acts on for the same reason `reviseNode` does: acting on a
   * revision that is no longer established is a conflict, not a silent write.
   *
   * Content is untouched. This is how a consumer removes something from the
   * product without rewriting history.
   */
  | {
      readonly op: "archiveNode";
      readonly nodeId: string;
      readonly baseRevisionId: string;
    };

export interface GraphMutationRequest {
  readonly operations: NonEmpty<GraphOperation>;
}

/**
 * The content an item stages. Staging writes a candidate revision and changes
 * no established truth; only acceptance establishes it.
 *
 * A revision of a node that exists names the revision it was staged against,
 * for the reason `reviseNode` does: acceptance against truth that has since
 * moved is a conflict, not a silent overwrite.
 */
export type ProposalContent =
  | {
      readonly of: "newNode";
      readonly semanticType: string;
      readonly content: JSONValue;
    }
  | {
      readonly of: "node";
      readonly nodeId: string;
      readonly baseRevisionId: string;
      readonly semanticType: string;
      readonly content: JSONValue;
    };

/**
 * The relation work an acceptance performs beyond establishing the content the
 * item staged. A relation has no candidate state, so a relation an item
 * proposes is written when the item is accepted and not before.
 *
 * `stagedNode` names the node this item staged, which is how an item that
 * introduces a node also carries the relation placing it.
 */
export type ProposalRelationOperation =
  | {
      readonly op: "createRelation";
      readonly relationType: string;
      readonly from: ProposalNodeRef;
      readonly to: ProposalNodeRef;
    }
  | { readonly op: "closeRelation"; readonly relationId: string };

export type ProposalNodeRef =
  | { readonly kind: "id"; readonly nodeId: string }
  | { readonly kind: "stagedNode" };

/**
 * One item of a proposal: what it proposes and everything answering it needs.
 * `kind` is the domain's word for it, carried rather than interpreted.
 */
export interface ProposalItemRequest {
  readonly kind: string;
  /** The node the item concerns, when it names one that already exists. */
  readonly targetNodeId?: string;
  readonly content?: ProposalContent;
  readonly onAccept?: readonly ProposalRelationOperation[];
}

/**
 * A group is one coherent change staged against one root. It pins the data
 * revision it was staged against, and carries the request that produced it.
 */
export interface ProposalStageRequest {
  readonly rootNodeId: string;
  readonly items: NonEmpty<ProposalItemRequest>;
  readonly request?: JSONValue;
}

export interface StagedItem {
  readonly itemId: string;
  readonly kind: string;
  readonly targetNodeId: string | null;
  /** The node this item staged content for, whether new or already existing. */
  readonly stagedNodeId: string | null;
  readonly stagedRevisionId: string | null;
}

export interface StagedProposal {
  readonly groupId: string;
  readonly rootNodeId: string;
  readonly baseDataRevision: string;
  readonly dataRevision: string;
  readonly items: readonly StagedItem[];
}

export type ProposalAnswer = "accepted" | "rejected";

/** An item as a reader of the group sees it. */
export interface ProposalItemView {
  readonly itemId: string;
  readonly kind: string;
  readonly targetNodeId: string | null;
  readonly stagedNodeId: string | null;
  readonly stagedRevisionId: string | null;
  readonly stagedSemanticType: string | null;
  readonly stagedContent: JSONValue | null;
  readonly answer: ProposalAnswer | null;
}

export interface ProposalGroupView {
  readonly groupId: string;
  readonly rootNodeId: string;
  readonly baseDataRevision: string;
  readonly stagedBy: JSONValue;
  readonly request: JSONValue | null;
  /** Open while an item is unanswered, closed when none is. */
  readonly state: "open" | "closed";
  readonly items: readonly ProposalItemView[];
}

export interface AnsweredItem {
  readonly itemId: string;
  readonly answer: ProposalAnswer;
  readonly dataRevision: string;
  /** The group after this answer, so a caller learns it closed without asking. */
  readonly groupState: "open" | "closed";
}

/** Who a write is attributed to. Carried into graph provenance. */
export type GraphActor =
  | { readonly kind: "application" }
  | {
      readonly kind: "apiClient";
      readonly clientId: string;
      /**
       * What this caller may do. A `proposer` reaches staging alone, refused
       * at this boundary rather than by its own good behavior.
       */
      readonly identityClass: "writer" | "proposer";
    };

export interface WrittenNode {
  /** The reference the request minted, or null for a revision of a known node. */
  readonly ref: string | null;
  readonly nodeId: string;
  readonly revisionId: string;
}

export interface WrittenRelation {
  readonly ref: string | null;
  readonly relationId: string;
}

export interface GraphMutationResult {
  readonly dataRevision: string;
  readonly nodes: readonly WrittenNode[];
  readonly relations: readonly WrittenRelation[];
  readonly closedRelations: readonly string[];
  readonly archivedNodes: readonly string[];
}

export interface ValidationFailure {
  /** Index of the offending operation, or null when the request itself is wrong. */
  readonly operation: number | null;
  readonly rule: string;
  readonly detail: string;
}

export interface RevisionConflict {
  readonly nodeId: string;
  readonly expectedRevisionId: string;
  readonly currentRevisionId: string | null;
}

/** Every gateway call answers with exactly one of these. */
export type GraphOutcome<T> =
  | { readonly outcome: "success"; readonly result: T }
  | { readonly outcome: "noResult"; readonly detail: string }
  | { readonly outcome: "conflict"; readonly conflicts: NonEmpty<RevisionConflict> }
  | {
      readonly outcome: "validationFailure";
      readonly failures: NonEmpty<ValidationFailure>;
    }
  | { readonly outcome: "authenticationFailure" }
  /**
   * The caller proved who it is and its identity class does not reach this
   * operation. Separate from an authentication failure, which would send a
   * caller holding a working credential to rotate it.
   */
  | { readonly outcome: "refused"; readonly detail: string }
  | { readonly outcome: "storageError"; readonly detail: string };

export type GraphReadOutcome = GraphOutcome<AssembledGraph>;
export type ChangeSummaryOutcome = GraphOutcome<ChangeSummary>;
export type RootResolutionOutcome = GraphOutcome<ResolvedRoots>;
export type GraphMutationOutcome = GraphOutcome<GraphMutationResult>;
export type ProposalStageOutcome = GraphOutcome<StagedProposal>;
export type ProposalGroupOutcome = GraphOutcome<ProposalGroupView>;
export type ProposalAnswerOutcome = GraphOutcome<AnsweredItem>;

/**
 * A committed node type. `validate` returns a message when the content is
 * wrong for this type, or null when it is acceptable.
 */
export interface NodeTypeDefinition {
  readonly semanticType: string;
  readonly schemaVersion: number;
  readonly validate: (content: JSONValue) => string | null;
}

/** A committed relation type and the endpoint shapes it permits. */
export interface RelationTypeDefinition {
  readonly relationType: string;
  readonly schemaVersion: number;
  readonly fromNodes: NonEmpty<string>;
  readonly toNodes?: readonly string[];
  readonly toRelations?: readonly string[];
}

export interface GraphSchema {
  readonly nodes: Readonly<Record<string, NodeTypeDefinition>>;
  readonly relations: Readonly<Record<string, RelationTypeDefinition>>;
}
