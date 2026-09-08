import { $ } from "@builder.io/qwik";
import { contributions as declare, type ViewContribution } from "~/contract";
import { BlockEditorView } from "~/components/views/block-editor";
import { ExtensionView } from "~/components/views/extension";
import { ExtensionsSection } from "~/components/library/extensions-section";

/**
 * What `ui.shell` contributes to the frame it hosts, through the same contract
 * every extension uses: the Documents section, the Extensions section as a
 * component, and the `document` and `extension` tab kinds with their views.
 * The frame itself — workspace, tabs, dock, drawers, the process registry, the
 * CCGW and kernel clients — is `src/` root source and not a contribution.
 * Episodes, standing assets and destinations are `calliopa-video`'s since
 * `BO_0203`. BO_0202_002
 */

const created = async <T extends string>(
  path: string,
  title: string,
  idField: T,
): Promise<{ readonly itemId: string; readonly title: string } | null> => {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const outcome = (await response.json()) as
    | { outcome: "success"; result: Record<T, string> }
    | { outcome: string };
  if (outcome.outcome !== "success") return null;
  return { itemId: (outcome as { result: Record<T, string> }).result[idField], title };
};

const blockEditor: ViewContribution = {
  id: "block-editor",
  name: "Editor",
  inspector: "No block active",
  drag: ["move", "open-in-tab"],
  component: BlockEditorView,
};

const extension: ViewContribution = {
  id: "extension",
  name: "Extension",
  // The view contributes the extension's facts; until they arrive, the
  // inspector says what it is looking at.
  inspector: "Reading the graph",
  drag: ["open-in-tab"],
  component: ExtensionView,
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
      // the tab only names it, so this is a create followed by an ordinary open.
      create$: $(async () => {
        const made = await created("/api/x/ui.shell/documents", "Untitled document", "documentId");
        return made === null ? null : { kind: "document", ...made };
      }),
    },
    {
      name: "extensions",
      title: "Extensions",
      empty: "The graph holds no extensions",
      component: ExtensionsSection,
    },
  ],
  kinds: {
    document: blockEditor,
    // An extension of the knowledge graph, or one node of its owner network:
    // the item identity is `ext:<id>` or `ext:<id>/<path>`. BO_0201_007
    extension,
  },
});
