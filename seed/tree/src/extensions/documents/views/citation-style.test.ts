import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * A document chooses its citation style in the bar's Document group
 * (`BO_0291_037`): offered while it cites anything and the bibliography
 * answers its styles, the instance's default first and named, and a choice
 * written with `setCitationStyle` on the document's base — `default` writing
 * null, so the document follows the instance again.
 */
const cited: BlockView = {
  kind: "text",
  blockId: "blk-a",
  revisionId: "rev-a",
  containmentId: "c-a",
  order: "a",
  role: "paragraph",
  standing: "keep",
  runs: [{ text: "Measured " }, { text: "", cite: { work: "wrk-1" } }, { text: "." }],
};

const styles = {
  applied: "ieee",
  instanceDefault: "ieee",
  offered: [
    { id: "ieee", name: "IEEE" },
    { id: "apa", name: "APA" },
    { id: "chicago-author-date", name: "Chicago author-date" },
  ],
};

async function mount(extra: Partial<DocumentView>) {
  const document: DocumentView = { documentId: "doc-1", revisionId: "rev-doc", title: "Cited", blocks: [cited], ...extra };
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(document, sent));
  const view = await mountEditor(document);
  const select = () => (view.root.querySelector('[data-bar-action="citation-style"]') as HTMLSelectElement | null) ?? null;
  const chosen = () => view.root.querySelector('[data-bar-action="citation-style"] option[selected]')?.getAttribute("value") ?? null;
  return { view, sent, select, chosen };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a document's citation style (BO_0291_037)", () => {
  it("Given a document citing nothing the bibliography styles, Then the bar offers no style", async () => {
    const { view, select } = await mount({});
    expect(select()).toBeNull();
    await view.idle();
  });

  it("Given a cited document, Then the Document group offers the instance's default first, named, then each style, and holds the default", async () => {
    const { view, select, chosen } = await mount({ citationNumbers: { "wrk-1": 1 }, citationStyles: styles });
    await view.settle(() => select() !== null);
    const options = [...view.root.querySelectorAll('[data-bar-action="citation-style"] option')].map((option) => [option.getAttribute("value"), option.textContent]);
    expect(options).toEqual([
      ["default", "Instance default (IEEE)"],
      ["ieee", "IEEE"],
      ["apa", "APA"],
      ["chicago-author-date", "Chicago author-date"],
    ]);
    expect(chosen()).toBe("default");
    await view.idle();
  });

  it("When APA is chosen, Then it is written on the document's base; When the default is chosen again, Then null is written", async () => {
    const { view, sent, select } = await mount({ citationNumbers: { "wrk-1": 1 }, citationStyles: styles });
    await view.settle(() => select() !== null);
    select()!.value = "apa";
    await view.userEvent(select()!, "change");
    await view.settle(() => sent.some((entry) => entry.body["command"] === "setCitationStyle"));
    expect(sent.find((entry) => entry.body["command"] === "setCitationStyle")?.body).toEqual({ command: "setCitationStyle", baseRevisionId: "rev-doc", style: "apa" });
    await view.idle();
  });

  it("Given a document that chose APA, Then the choice holds APA, and choosing the default writes null", async () => {
    const { view, sent, select, chosen } = await mount({ citationNumbers: { "wrk-1": 1 }, citationStyle: "apa", citationStyles: { ...styles, applied: "apa" } });
    await view.settle(() => select() !== null);
    expect(chosen()).toBe("apa");
    select()!.value = "default";
    await view.userEvent(select()!, "change");
    await view.settle(() => sent.some((entry) => entry.body["command"] === "setCitationStyle"));
    expect(sent.find((entry) => entry.body["command"] === "setCitationStyle")?.body).toEqual({ command: "setCitationStyle", baseRevisionId: "rev-doc", style: null });
    await view.idle();
  });
});
