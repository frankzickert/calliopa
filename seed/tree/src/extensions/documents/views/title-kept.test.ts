import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentView } from "../server/assemble";
import { activateBlock, documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * A title typed is kept when the person presses anything else before leaving
 * it (`DO_0032_001`, `DO_0032_002`): the header's structures chip keeps the
 * caret where it is, so the field never blurs, and the title was lost. A press
 * outside the field saves the title first, as leaving it does.
 */

const draft: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Video",
  blocks: [
    { kind: "text", blockId: "blk-a", revisionId: "rev-a", containmentId: "c-a", order: "a", role: "paragraph", standing: "keep", runs: [{ text: "Independent checks preserve boundaries." }] },
  ],
};

/* The structures' answers, as the routes stood in below serve them. Their
 * types are not imported: `documents` ships while an owner switches
 * `structures` off, so none of its files imports from it (`DO_0036_001`). */
const profile = {
  id: "7e8f9a0b-1c2d-4e3f-8a5b-6c7d8e9f0a1b",
  name: "Profile",
  description: "",
  retired: false,
  builtin: false,
  order: 1,
  fields: [],
  offers: [],
  offeredBy: [],
  blocks: true,
  text: "",
};

const listing = { reachable: true, structures: [profile] };

const structuresOf = (taken: boolean) => ({
  documentId: draft.documentId,
  dataRevision: 7,
  inherited: [],
  structures: taken
    ? [{ id: profile.id, name: profile.name, description: "", retired: false, builtin: false, offered: true, fields: [], values: {}, missing: [], blocks: true }]
    : [],
  takeable: [profile.id],
  blocks: [],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The document's routes, with the structures' routes beside them; `order`
 * records what was written, in the order it was sent. */
const mount = async () => {
  const sent: SentCommand[] = [];
  const order: string[] = [];
  const documents = documentsApi(draft, sent, { follow: true });
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url === "/api/library/structures/structures") return new Response(JSON.stringify(listing), { status: 200 });
    if (url.startsWith(`/api/x/structures/documents/${draft.documentId}`)) {
      if (init?.method === "POST") order.push("structure");
      return new Response(JSON.stringify({ outcome: "success", result: structuresOf(init?.method === "POST") }), { status: 200 });
    }
    if (init?.method === "POST" && typeof init.body === "string" && (JSON.parse(init.body) as { command?: string }).command === "rename") order.push("rename");
    return documents(url, init);
  });
  const view = await mountEditor(draft);
  // `Element`, which the page's press listeners test their targets against
  // and the harness does not install globally.
  vi.stubGlobal("Element", {
    [Symbol.hasInstance]: (value: unknown) => (value as { nodeType?: number } | null)?.nodeType === 1,
  });
  const title = view.root.querySelector("[data-document-title]") as HTMLElement;
  const renames = () => sent.filter((command) => command.body["command"] === "rename");
  /** A press as the browser makes it: the pointer goes down on the page, then
   * the click the control answers. */
  const press = async (selector: string) => {
    const target = view.root.querySelector(selector) as HTMLElement;
    const down = target.ownerDocument.createEvent("Event");
    down.initEvent("pointerdown", true, true);
    target.dispatchEvent(down);
    await view.userEvent(selector, "click");
  };
  return { ...view, sent, order, title, renames, press };
};

describe("a title typed and not yet left", () => {
  it("Given a title typed, When a structure is taken from the header's chip, Then the title is saved first and stays shown", async () => {
    const view = await mount();
    await view.settle(() => view.root.querySelector('[data-structure-control="document"] [data-structures-add]') !== null);
    view.title.textContent = "VideoProfile";
    await view.press('[data-structure-control="document"] [data-structures-add]');
    await view.settle(() => view.root.querySelector(`[data-take-structure="${profile.id}"]`) !== null);
    await view.press(`[data-take-structure="${profile.id}"]`);
    await view.settle(() => view.order.length === 2);
    expect(view.order).toEqual(["rename", "structure"]);
    expect(view.renames()).toHaveLength(1);
    expect(view.renames()[0]?.body["title"]).toBe("VideoProfile");
    expect(view.title.textContent).toBe("VideoProfile");
    // The field never left; when it does, nothing more is sent.
    await view.userEvent("[data-document-title]", "blur");
    await view.idle();
    expect(view.renames()).toHaveLength(1);
    expect(view.title.textContent).toBe("VideoProfile");
  });

  it("Given a title typed, When a block's command is pressed, Then the title is saved", async () => {
    const view = await mount();
    await activateBlock(view, "blk-a");
    view.title.textContent = "Video plan";
    await view.press('[data-block-command="blk-a"] [data-block-point]');
    await view.settle(() => view.renames().length === 1);
    expect(view.renames()[0]?.body["title"]).toBe("Video plan");
    await view.idle();
    expect(view.title.textContent).toBe("Video plan");
  });

  it("Given the title untouched, When something else is pressed, Then nothing is sent", async () => {
    const view = await mount();
    await view.press('[data-structure-control="document"] [data-structures-add]');
    await view.idle();
    expect(view.renames()).toHaveLength(0);
    expect(view.title.textContent).toBe("Video");
  });

  it("Given a press on the title itself, Then the title is not saved yet", async () => {
    const view = await mount();
    view.title.textContent = "Video pl";
    await view.press("[data-document-title]");
    await view.idle();
    expect(view.renames()).toHaveLength(0);
    expect(view.title.textContent).toBe("Video pl");
  });
});
