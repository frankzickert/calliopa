import { $ } from "@builder.io/qwik";
import { contributions as declare, type ViewContribution } from "~/contract";
import { BlockEditorView } from "./views/block-editor";

/**
 * What `documents` contributes to the frame: the Documents section and the
 * `document` kind with the block editor presenting it. What a block *means* is
 * drawn into the editor's places by whichever extension has something to say
 * about it, and is `calliopa-refine`'s since `BO_0256`. The block document
 * model left `ui.shell` under `BO_0255`, so the shell keeps the frame and
 * extension administration and declares no dependency on this — a tree
 * without `documents` builds and serves, with no Documents section and a
 * remembered document tab opening in the `context` placeholder.
 * BO_0255_006
 */

const blockEditor: ViewContribution = {
  id: "block-editor",
  name: "Editor",
  inspector: "No block active",
  drag: ["move", "open-in-tab"],
  component: BlockEditorView,
};

export const contributions = declare({
  sections: [
    {
      name: "documents",
      title: "Documents",
      empty: "No documents yet",
      kind: "document",
      createLabel: "New document",
      // A new document, opened in its own tab. The graph owns the document;
      // the tab only names it, so this is a create followed by an ordinary
      // open.
      create$: $(async () => {
        const response = await fetch("/api/x/documents/d", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "Untitled document" }),
        });
        const outcome = (await response.json()) as
          | { outcome: "success"; result: { documentId: string } }
          | { outcome: string };
        if (outcome.outcome !== "success") return null;
        return {
          kind: "document",
          itemId: (outcome as { result: { documentId: string } }).result.documentId,
          title: "Untitled document",
        };
      }),
    },
  ],
  kinds: { document: blockEditor },
});
