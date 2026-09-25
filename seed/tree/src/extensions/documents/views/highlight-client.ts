/**
 * Colouring in the browser, for the code block being written (`BO_0296_018`).
 *
 * Reading a document needs none of this: the server colours every code block
 * as it reads it, and the markup arrives with the block. Writing is the one
 * place that cannot wait for a round trip — the source changes under the
 * caret — so the field's overlay is repainted here, from the same module the
 * server colours with, reached through a lazy import that only someone
 * writing code pays for. Reading fetches no grammar
 * (`lib/highlight-boundary.test.ts`).
 */
let engine: typeof import("../lib/highlight") | null = null;
let loading: Promise<void> | null = null;

/** The source in its language's colours, or null when there is no language
 * to colour by — the overlay then paints the plain characters. */
export async function paintCode(source: string, language: string): Promise<string | null> {
  if (language.trim() === "") return null;
  if (engine === null) {
    loading ??= import("../lib/highlight").then((module) => {
      engine = module;
    });
    await loading;
  }
  return engine === null ? null : engine.highlightSource(source, language);
}
