import { $ } from "@builder.io/qwik";
import { contributions as declare, type ViewContribution } from "~/contract";
import { BlockEditorView } from "~/components/views/block-editor";
import { ExtensionView } from "~/components/views/extension";
import { ExtensionImportView } from "~/components/views/extension-import";
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

const extensionImport: ViewContribution = {
  id: "extension-import",
  name: "Import",
  inspector: "Reading the import",
  drag: [],
  component: ExtensionImportView,
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
      // The rows under an extension are its change documents, so a rename, a
      // status change or a delete in the editor re-reads this section the
      // way it re-reads Documents. BO_0222_005
      kind: "document",
      // No `createLabel`: the header's control creates at once and answers
      // what to open, and a new extension needs a name and a sentence first.
      // The section carries its own `+` beside its other controls, where the
      // form it opens is its own state. BO_0224_009
      component: ExtensionsSection,
    },
  ],
  kinds: {
    document: blockEditor,
    // An extension of the knowledge graph, or one node of its owner network:
    // the item identity is `ext:<id>` or `ext:<id>/<path>`. BO_0201_007
    extension,
    // A staged import of an extension, keyed by its proposal group, so a
    // second press reveals the open tab. BO_0224_011
    "extension-import": extensionImport,
  },
});
