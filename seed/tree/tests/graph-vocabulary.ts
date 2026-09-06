import type { GraphSchema } from "../src/server/graph/contract";

const requiresText = (content: unknown): string | null =>
  typeof (content as { text?: unknown })?.text === "string"
    ? null
    : "A note carries text.";

const requiresName = (content: unknown): string | null =>
  typeof (content as { name?: unknown })?.name === "string"
    ? null
    : "A tag carries a name.";

/**
 * A committed vocabulary the gateway's own coverage writes against.
 *
 * The application's vocabulary belongs to domain changes, so the gateway is
 * proved against definitions of its own rather than against whichever domain
 * has landed. These are real definitions running the real validator; nothing
 * here substitutes for gateway behavior.
 */
export const testGraphSchema: GraphSchema = {
  nodes: {
    note: { semanticType: "note", schemaVersion: 1, validate: requiresText },
    tag: { semanticType: "tag", schemaVersion: 2, validate: requiresName },
  },
  relations: {
    references: {
      relationType: "references",
      schemaVersion: 1,
      fromNodes: ["note"],
      toNodes: ["note"],
    },
    labels: {
      relationType: "labels",
      schemaVersion: 1,
      fromNodes: ["tag"],
      toNodes: ["note"],
    },
    qualifies: {
      relationType: "qualifies",
      schemaVersion: 1,
      fromNodes: ["note"],
      toRelations: ["references"],
    },
  },
};
