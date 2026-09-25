import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentView } from "../server/assemble";
import { UNNAMED_DOCUMENT, UNNAMED_PROFILE } from "../lib/naming";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * A document nobody has named yet (`DO_0012_002`): the headline holds no title
 * text, the minted name stands over the empty field as its placeholder, and
 * naming it is typing — never deleting first.
 */
const unnamed: DocumentView = {
  documentId: "doc-new",
  revisionId: "rev-1",
  title: UNNAMED_DOCUMENT,
  blocks: [
    { kind: "text", blockId: "blk-a", revisionId: "rev-a", containmentId: "c-a", order: "i", role: "paragraph", standing: "keep", runs: [{ text: "" }] },
  ],
};

const named: DocumentView = { ...unnamed, documentId: "doc-named", title: "Release plan" };

afterEach(() => {
  vi.unstubAllGlobals();
});

const mount = async (document: DocumentView) => {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(document, sent));
  const view = await mountEditor(document);
  const title = view.root.querySelector("[data-document-title]") as HTMLElement;
  const renames = () => sent.filter((command) => command.body["command"] === "rename");
  /** Types into the title as a reader does, then leaves it. */
  const type = async (words: string) => {
    title.textContent = words;
    await view.userEvent("[data-document-title]", "blur");
    await view.idle();
  };
  return { ...view, sent, title, renames, type };
};

describe("the title of a profile nobody has named", () => {
  it("Given an unnamed profile, Then the field is empty under the profile's minted name as its placeholder", async () => {
    const view = await mount({ ...unnamed, documentId: "prof-unnamed", title: UNNAMED_PROFILE, record: "profile" });
    expect(view.title.textContent).toBe("");
    expect(view.title.getAttribute("data-unnamed")).toBe("true");
    expect(view.title.getAttribute("data-placeholder")).toBe(UNNAMED_PROFILE);
    expect(view.root.querySelector("h2.document-title")?.textContent).toContain(UNNAMED_PROFILE);
    await view.idle();
  });
});

describe("the title of a document nobody has named", () => {
  it("Given an unnamed document, Then the field is empty under the minted name as its placeholder, and the heading is still named", async () => {
    const view = await mount(unnamed);
    expect(view.title.textContent).toBe("");
    expect(view.title.getAttribute("data-unnamed")).toBe("true");
    expect(view.title.getAttribute("data-placeholder")).toBe(UNNAMED_DOCUMENT);
    expect(view.title.getAttribute("aria-placeholder")).toBe(UNNAMED_DOCUMENT);
    // The words the reader sees name the heading, standing beside the empty
    // field rather than in it.
    expect(view.root.querySelector("h2.document-title")?.textContent).toContain(UNNAMED_DOCUMENT);
    await view.idle();
  });

  it("Given a name typed into the empty field, Then it is the name: the rename is sent and the field holds it as ordinary content", async () => {
    const view = await mount(unnamed);
    await view.type("Release plan");
    expect(view.renames()).toHaveLength(1);
    expect(view.renames()[0]?.body["title"]).toBe("Release plan");
    expect(view.title.textContent).toBe("Release plan");
    expect(view.title.getAttribute("data-unnamed")).toBe("false");
  });

  it("Given the reader leaves the title untouched, Then nothing is sent and the placeholder stands", async () => {
    const view = await mount(unnamed);
    await view.userEvent("[data-document-title]", "blur");
    await view.idle();
    expect(view.renames()).toHaveLength(0);
    expect(view.title.textContent).toBe("");
    expect(view.title.getAttribute("data-unnamed")).toBe("true");
  });

  it("Given a name typed and then cleared, Then leaving sends nothing and the field is empty under its placeholder again", async () => {
    const view = await mount(unnamed);
    await view.type("");
    expect(view.renames()).toHaveLength(0);
    expect(view.title.textContent).toBe("");
    expect(view.title.getAttribute("data-unnamed")).toBe("true");
  });

  it("Given Escape after typing, Then the field is empty again and nothing is sent", async () => {
    const view = await mount(unnamed);
    view.title.textContent = "Half a nam";
    await view.userEvent("[data-document-title]", "keydown", { key: "Escape" });
    await view.idle();
    expect(view.title.textContent).toBe("");
    expect(view.renames()).toHaveLength(0);
  });

  it("Given a named document, Then its title is ordinary content with no placeholder", async () => {
    const view = await mount(named);
    expect(view.title.textContent).toBe("Release plan");
    expect(view.title.getAttribute("data-unnamed")).toBe("false");
    expect(view.root.querySelector("h2.document-title")?.textContent).toBe("Release plan");
    await view.idle();
  });

  it("Given a named document renamed back to the minted name, Then it reads as unnamed again", async () => {
    const view = await mount(named);
    await view.type(UNNAMED_DOCUMENT);
    expect(view.renames()).toHaveLength(1);
    expect(view.title.getAttribute("data-unnamed")).toBe("true");
    expect(view.title.textContent).toBe("");
  });
});
