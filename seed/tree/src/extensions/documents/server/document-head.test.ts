import { describe, expect, it } from "vitest";

import type { ReadResult } from "~/server/ccgw/client";
import { nodeRef } from "~/server/ccgw/nodes";
import { parseDocumentCommand } from "./api";
import { assembleDocument } from "./assemble";
import { validateDocument, validateText } from "./vocabulary";

/**
 * What a document carries for a paper (`BO_0293_013`, `BO_0291_037`): the
 * abstract as a text block of its own role, and the document's citation
 * style. The front matter moved to the person's *Paper* role
 * (`calliopa-bootstrap`'s `BO_0312_Q3`); a node still carrying it before the
 * migration reads and validates without it.
 */
const DOCUMENT = "00000000-0000-4000-8000-000000000001";

const graphWith = (content: Record<string, unknown>): ReadResult => ({
  roots: [nodeRef(DOCUMENT)],
  nodes: [
    {
      id: nodeRef(DOCUMENT),
      revision: { id: "rev:doc", content: { _type: "document", id: DOCUMENT, title: "A Manuscript", ...content }, status: "established", dataRevision: 1, createdAt: 1, createdBy: "frank" },
    },
  ],
  relations: [],
  resolvedDataRevision: 1,
});

describe("front matter of before (calliopa-bootstrap's BO_0312_030)", () => {
  it("is read past and validated past until the migration has moved it to Paper: the read carries none of it", () => {
    const content = { authors: [{ name: "Ada Lovelace" }], affiliations: ["Engines Ltd"], keywords: ["provenance"], venue: "ieee" };
    const read = assembleDocument(graphWith(content), DOCUMENT) as unknown as Record<string, unknown>;
    expect(read["frontMatter"]).toBeUndefined();
    expect(read["authors"]).toBeUndefined();
    expect(validateDocument({ title: "A Manuscript", ...content })).toBeNull();
  });

  it("is no command any more", () => {
    expect("failure" in parseDocumentCommand({ command: "setFrontMatter", baseRevisionId: "rev:doc", frontMatter: {} })).toBe(true);
  });
});

describe("the abstract", () => {
  it("is a text block of the role abstract", () => {
    expect(validateText({ order: "a0", role: "abstract", runs: [{ text: "We show." }] })).toBeNull();
    expect(validateText({ order: "a0", role: "preface", runs: [] })).toContain("not one of paragraph, h1, h2, h3, quote, abstract");
  });
});

describe("a document's citation style (BO_0291_037)", () => {
  it("is answered by the read when the document chose one, and absent when it follows the instance", () => {
    expect(assembleDocument(graphWith({ citationStyle: "apa" }), DOCUMENT)?.citationStyle).toBe("apa");
    expect(assembleDocument(graphWith({}), DOCUMENT)).not.toHaveProperty("citationStyle");
  });

  it("is set by setCitationStyle on the document's base, null following the instance's default, and refused in words otherwise", () => {
    expect(parseDocumentCommand({ command: "setCitationStyle", baseRevisionId: "rev:doc", style: "apa" })).toEqual({
      command: { command: "setCitationStyle", baseRevisionId: "rev:doc", style: "apa" },
    });
    expect(parseDocumentCommand({ command: "setCitationStyle", baseRevisionId: "rev:doc", style: null })).toEqual({
      command: { command: "setCitationStyle", baseRevisionId: "rev:doc", style: null },
    });
    expect(parseDocumentCommand({ command: "setCitationStyle", style: "apa" })).toEqual({
      failure: "Setting the citation style names the revision of the document it is based on.",
    });
    expect(parseDocumentCommand({ command: "setCitationStyle", baseRevisionId: "r", style: "" })).toEqual({
      failure: "A citation style is a style's id, or null for the instance's default.",
    });
  });
});
