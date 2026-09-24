import { describe, expect, it } from "vitest";

import type { ReadResult } from "~/server/ccgw/client";
import { nodeRef } from "~/server/ccgw/nodes";
import { parseDocumentCommand } from "./api";
import { assembleDocument } from "./assemble";
import { validateDocument, validateText } from "./vocabulary";

/**
 * A manuscript's head in the record (`BO_0293_012`, `BO_0293_013`): the front
 * matter on the document node, set whole by one command and answered by the
 * read, and the abstract as a text block of its own role.
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

describe("the front matter on a document", () => {
  it("is answered by the read as the node carries it", () => {
    const read = assembleDocument(
      graphWith({ authors: [{ name: "Ada Lovelace", affiliations: [0] }], affiliations: ["Analytical Engines Ltd"], keywords: ["provenance"], venue: "ieee" }),
      DOCUMENT,
    );
    expect(read?.frontMatter).toEqual({
      authors: [{ name: "Ada Lovelace", affiliations: [0] }],
      affiliations: ["Analytical Engines Ltd"],
      keywords: ["provenance"],
      venue: "ieee",
    });
  });

  it("is absent from the read of a document carrying none", () => {
    expect(assembleDocument(graphWith({}), DOCUMENT)).not.toHaveProperty("frontMatter");
  });

  it("is checked by the document's validator, which refuses a malformed author", () => {
    expect(validateDocument({ title: "x", authors: [{ name: "A" }] })).toBeNull();
    expect(validateDocument({ title: "x", authors: [{ email: "a@b" }] })).toBe("Author 1 carries no name.");
  });

  it("is set whole by setFrontMatter on the document's base, and refused in words when malformed", () => {
    expect(
      parseDocumentCommand({ command: "setFrontMatter", baseRevisionId: "rev:doc", frontMatter: { keywords: ["a"], venue: "generic" } }),
    ).toEqual({ command: { command: "setFrontMatter", baseRevisionId: "rev:doc", frontMatter: { keywords: ["a"], venue: "generic" } } });
    expect(parseDocumentCommand({ command: "setFrontMatter", frontMatter: {} })).toEqual({
      failure: "Setting the front matter names the revision of the document it is based on.",
    });
    expect(parseDocumentCommand({ command: "setFrontMatter", baseRevisionId: "r", frontMatter: { venue: "Two words" } })).toEqual({
      failure: "A document's venue is a venue's name, a word.",
    });
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
