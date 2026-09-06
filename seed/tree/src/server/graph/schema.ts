import { blockDocumentSchema } from "../documents/vocabulary";
import { productionSchema } from "../production/vocabulary";
import type { GraphSchema } from "./contract";

/**
 * Merges committed vocabularies into one schema. A type defined twice is a
 * mistake in the source rather than a last-one-wins accident, so it throws
 * where the definitions are assembled instead of at the write that hits it.
 */
export function composeGraphSchema(
  ...parts: readonly GraphSchema[]
): GraphSchema {
  const nodes: Record<string, GraphSchema["nodes"][string]> = {};
  const relations: Record<string, GraphSchema["relations"][string]> = {};

  for (const part of parts) {
    for (const [name, definition] of Object.entries(part.nodes)) {
      if (name in nodes) {
        throw new Error(`The node type ${name} is defined twice.`);
      }
      nodes[name] = definition;
    }
    for (const [name, definition] of Object.entries(part.relations)) {
      if (name in relations) {
        throw new Error(`The relation type ${name} is defined twice.`);
      }
      relations[name] = definition;
    }
  }

  return { nodes, relations };
}

/**
 * Calliopa's committed graph vocabulary. Node and relation types are source in
 * this repository, never loaded at runtime, so adding one is an ordinary
 * change with review and deployment behind it.
 *
 * The block document model is the first domain to contribute definitions and
 * the production model the second. A write naming a type no part covers is
 * still refused with a validation outcome.
 */
export const calliopaGraphSchema: GraphSchema = composeGraphSchema(
  blockDocumentSchema,
  productionSchema,
);
