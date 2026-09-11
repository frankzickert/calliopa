import {
  $,
  component$,
  useContext,
  useSignal,
  useStore,
  useTask$,
  type QRL,
} from "@builder.io/qwik";
import { ViewBridgeContext } from "~/components/shell/view-bridge";
import { Icon, STATUS_ICONS } from "~/components/shell/icons";
import type { SectionProps } from "~/contract";
import {
  changeFilterOf,
  filterChanges,
  isDefaultChangeFilter,
  toggleChangeStatus,
} from "~/lib/changes";
import { EXTENSION_ID_WORDS, isExtensionId } from "~/lib/extension-id";
import { importTitle, type ImportRecord } from "~/lib/extension-import";
import { CHANGE_STATUSES, type ChangeDocumentSummary, type ChangeStatus } from "~/lib/library";
import type { ExtensionListing } from "~/server/extensions";

/**
 * The Extensions section's body, contributed by `ui.shell` as a component
 * because its shape is not the uniform row: two groups — *Core* (`bundled`)
 * and *Yours* (`individual`) — each row the extension id and version, with a
 * dot when newer truth than the served pin waits for promotion, and the
 * reason when the graph could not be read. The reader's answer arrives as
 * the section's data; the re-read control asks the host's library route for
 * it again. BO_0201_005 BO_0202_003
 *
 * Since BO_0222 each row is a small tree: the extension, then its change
 * documents — a document carrying the extension's id — each opened in the
 * editor by its identity, and a `+` on the row that starts one. Which
 * statuses list is the filter's: a funnel on the section reveals one toggle
 * per status, the chosen set stored in the workspace layout, `completed` and
 * `rejected` hidden until asked for. A change naming an extension the graph
 * no longer holds lists under *Other*. BO_0222_005 BO_0222_006
 *
 * Since BO_0224 the section starts an extension and imports one, both from
 * its own controls beside the re-read and the funnel: a `+` opens a form —
 * a name and a purpose — whose submit asks the kernel to create the
 * extension as truth and opens its tab; and, for the owner alone, an import
 * control takes a `.zip` and opens the staged import's tab. The create is
 * the section's and not the category header's `createLabel`, which creates
 * at once and can carry no form. BO_0224_009 BO_0224_011
 */


const EMPTY: ExtensionListing = {
  reachable: false,
  detail: "not read",
  extensions: [],
  other: [],
};

const ChangeRow = component$<{
  change: ChangeDocumentSummary;
  current: boolean;
  open$: QRL<(change: ChangeDocumentSummary) => void>;
}>(({ change, current, open$ }) => (
  <li>
    <button
      type="button"
      class="library-entry library-entry--change"
      data-change-id={change.documentId}
      data-change-status={change.status}
      data-current={current ? "true" : undefined}
      aria-current={current ? "true" : undefined}
      onClick$={() => open$(change)}
    >
      <span class="library-entry__status" title={change.status} aria-label={change.status}>
        <Icon name={STATUS_ICONS[change.status]} />
      </span>
      <span class="library-entry__label">{change.title}</span>
      {current && <span class="library-entry__marker" aria-hidden="true" />}
    </button>
  </li>
));

export const ExtensionsSection = component$<SectionProps>(
  ({ data, activeItemId, filter, setFilter$ }) => {
    const bridge = useContext(ViewBridgeContext);
    const state = useStore<{
      listing: ExtensionListing;
      reads: number;
      filterOpen: boolean;
      creating: string | null;
      formOpen: boolean;
      formId: string;
      formPurpose: string;
      formRefusal: string;
      formBusy: boolean;
      importing: boolean;
      importRefusal: string;
    }>({
      listing: (data as ExtensionListing | null) ?? EMPTY,
      reads: 0,
      // Whether the filter row shows is a gesture of the moment, not stored:
      // reopening the shell shows the header alone. BO_0222_006
      filterOpen: false,
      creating: null,
      // The create form: open by the header's control, nothing stored.
      formOpen: false,
      formId: "",
      formPurpose: "",
      formRefusal: "",
      formBusy: false,
      importing: false,
      importRefusal: "",
    });
    const fileInput = useSignal<HTMLInputElement>();
    const nameInput = useSignal<HTMLInputElement>();
    // The shell re-reads the section when a document tab changes — a rename,
    // a status, a delete — and hands the answer down as data. BO_0222_005
    useTask$(({ track }) => {
      const next = track(() => data) as ExtensionListing | null;
      if (next !== null && next !== undefined) {
        state.listing = next;
        state.reads += 1;
      }
    });
    const refresh$ = $(async () => {
      const response = await fetch("/api/library/ui.shell/extensions");
      if (!response.ok) return;
      state.listing = (await response.json()) as ExtensionListing;
      state.reads += 1;
    });
    // The item identity is the network's node id, so a topic or a change
    // opened from inside the document is found by the same rule and revealed
    // rather than duplicated. BO_0201_007
    const open$ = $((id: string) =>
      bridge.openTarget$({
        kind: "ui.shell:extension",
        itemId: `ext:${id}`,
        title: id,
      }),
    );
    // A change opens in the editor by its document identity, as the Documents
    // section opens a document, so one already open is revealed. BO_0222_005
    const openChange$ = $((change: ChangeDocumentSummary) =>
      bridge.openTarget$({
        kind: "ui.shell:document",
        itemId: change.documentId,
        title: change.title,
      }),
    );
    /**
     * A new change of the extension: created as *Untitled change* with
     * `change` naming the extension and `status` idea, opened in the editor,
     * and the section read again so the row shows it. An inactive extension
     * keeps the control: a change to something switched off is a normal thing
     * to write. BO_0222_005
     */
    const create$ = $(async (extension: string) => {
      if (state.creating !== null) return;
      state.creating = extension;
      try {
        const response = await fetch("/api/x/ui.shell/documents", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "Untitled change", change: extension, status: "idea" }),
        });
        const outcome = (await response.json()) as
          | { outcome: "success"; result: { documentId: string } }
          | { outcome: string };
        if (outcome.outcome !== "success") return;
        const documentId = (outcome as { result: { documentId: string } }).result.documentId;
        await bridge.openTarget$({
          kind: "ui.shell:document",
          itemId: documentId,
          title: "Untitled change",
        });
        await refresh$();
      } finally {
        state.creating = null;
      }
    });
    const toggleStatus$ = $(async (status: ChangeStatus) => {
      await setFilter$(toggleChangeStatus(changeFilterOf(filter), status));
    });
    /**
     * A new extension: the kernel writes its manifest and system.md as
     * truth under the signed-in person; the section re-reads and the tab
     * opens on the owner document with the purpose. The kernel's refusal is
     * shown in the form by its code. BO_0224_009
     */
    const createExtension$ = $(async () => {
      const id = state.formId.trim();
      const purpose = state.formPurpose.trim();
      if (!isExtensionId(id)) {
        state.formRefusal = `"${id}" is not an extension id: ${EXTENSION_ID_WORDS}`;
        return;
      }
      if (purpose === "") {
        state.formRefusal = "Say in one sentence what the extension is for.";
        return;
      }
      state.formBusy = true;
      state.formRefusal = "";
      try {
        const response = await fetch("/api/x/ui.shell/extensions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, purpose }),
        });
        const answer = (await response.json()) as { code?: string; message?: string; error?: string };
        if (!response.ok) {
          const detail = answer.message ?? answer.error ?? `the kernel answered ${response.status}`;
          state.formRefusal =
            answer.code === "extension_exists"
              ? `An extension "${id}" already exists.`
              : answer.code === "extension_id_invalid"
                ? `"${id}" is not an extension id: ${EXTENSION_ID_WORDS}`
                : detail;
          return;
        }
        state.formOpen = false;
        state.formId = "";
        state.formPurpose = "";
        await refresh$();
        await open$(id);
      } finally {
        state.formBusy = false;
      }
    });
    /**
     * An import: the chosen file's bytes go to the kernel as they are; the
     * kernel stages the proposal and answers the summary, which opens as the
     * import tab keyed by the group. BO_0224_011
     */
    const importFile$ = $(async (file: File) => {
      state.importing = true;
      state.importRefusal = "";
      try {
        const response = await fetch(
          `/api/x/ui.shell/extensions/import?name=${encodeURIComponent(file.name)}`,
          { method: "POST", headers: { "content-type": "application/zip" }, body: await file.arrayBuffer() },
        );
        const answer = (await response.json()) as ImportRecord & { code?: string; message?: string; error?: string };
        if (!response.ok) {
          state.importRefusal = answer.message ?? answer.error ?? `the kernel answered ${response.status}`;
          return;
        }
        await bridge.openTarget$({
          kind: "ui.shell:extension-import",
          itemId: answer.proposal,
          title: importTitle(answer.summary),
        });
      } finally {
        state.importing = false;
        if (fileInput.value !== undefined) fileInput.value.value = "";
      }
    });

    const listing = state.listing;
    const active = changeFilterOf(filter);
    const filtered = !isDefaultChangeFilter(active);
    return (
      <>
        <div class="library-section-actions">
          <button
            type="button"
            class="library-action library-action--body"
            aria-label="Re-read extensions"
            data-refresh-extensions
            onClick$={refresh$}
          >
            ↻
          </button>
          <button
            type="button"
            class="library-action library-action--body library-action--icon"
            aria-label="New extension"
            aria-expanded={state.formOpen}
            aria-controls="library-new-extension"
            data-new-extension
            onClick$={() => {
              state.formOpen = !state.formOpen;
              state.formRefusal = "";
              nameInput.value?.focus();
            }}
          >
            <Icon name="plus" />
          </button>
          <button
            type="button"
            class="library-action library-action--body library-action--icon"
            aria-label="Filter changes"
            aria-pressed={state.filterOpen}
            aria-controls="library-change-filter"
            data-filter-changes
            data-filtered={filtered ? "true" : undefined}
            onClick$={() => (state.filterOpen = !state.filterOpen)}
          >
            <Icon name="funnel" />
          </button>
          {listing.reachable && listing.owner === true && (
            <>
              <button
                type="button"
                class="library-action library-action--body library-action--icon"
                aria-label="Import extension"
                data-import-extension
                disabled={state.importing}
                onClick$={() => fileInput.value?.click()}
              >
                <Icon name="upload-simple" />
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".zip,application/zip"
                hidden
                aria-hidden="true"
                tabIndex={-1}
                data-import-file
                onChange$={(_, element) => {
                  const file = element.files?.[0];
                  if (file !== undefined) void importFile$(file);
                }}
              />
            </>
          )}
        </div>
        {state.importRefusal !== "" && (
          <p class="library-refusal" role="alert" data-import-refusal>
            {state.importRefusal}
          </p>
        )}
        <form
          id="library-new-extension"
          class="library-create"
          data-new-extension-form
          hidden={!state.formOpen}
          preventdefault:submit
          onSubmit$={() => createExtension$()}
        >
          <label class="library-create__field">
            <span>Name</span>
            <input
              ref={nameInput}
              type="text"
              name="id"
              autocomplete="off"
              spellcheck={false}
              placeholder="my-extension"
              value={state.formId}
              disabled={state.formBusy}
              onInput$={(_, element) => (state.formId = element.value)}
            />
          </label>
          <label class="library-create__field">
            <span>Purpose</span>
            <input
              type="text"
              name="purpose"
              autocomplete="off"
              placeholder="What it is for, in one sentence"
              value={state.formPurpose}
              disabled={state.formBusy}
              onInput$={(_, element) => (state.formPurpose = element.value)}
            />
          </label>
          {state.formRefusal !== "" && (
            <p class="library-refusal" role="alert" data-new-extension-refusal>
              {state.formRefusal}
            </p>
          )}
          <div class="library-create__controls">
            <button type="submit" class="library-action" disabled={state.formBusy} data-new-extension-create>
              Create
            </button>
            <button
              type="button"
              class="library-action"
              disabled={state.formBusy}
              data-new-extension-cancel
              onClick$={() => {
                state.formOpen = false;
                state.formRefusal = "";
              }}
            >
              Cancel
            </button>
          </div>
        </form>
        <div
          id="library-change-filter"
          class="library-change-filter"
          role="group"
          aria-label="Statuses to list"
          hidden={!state.filterOpen}
        >
          {CHANGE_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              class="library-action library-action--icon"
              aria-label={status}
              title={status}
              aria-pressed={active.includes(status)}
              data-change-filter={status}
              onClick$={() => toggleStatus$(status)}
            >
              <Icon name={STATUS_ICONS[status]} />
            </button>
          ))}
        </div>
        {!listing.reachable ? (
          <p class="library-empty" data-library-empty="extensions">
            Graph not reachable
          </p>
        ) : listing.extensions.length === 0 ? (
          <p class="library-empty" data-library-empty="extensions">
            The graph holds no extensions
          </p>
        ) : (
          (["bundled", "individual"] as const).map((category) => {
            const group = listing.extensions.filter(
              (extension) => extension.category === category,
            );
            if (group.length === 0) return null;
            return (
              <div key={category} data-library-group={category}>
                <h3 class="library-group">
                  {category === "bundled" ? "Core" : "Yours"}
                </h3>
                <ul class="library-list" key={state.reads}>
                  {group.map((extension) => {
                    const id = extension.id;
                    const current = activeItemId === `ext:${id}`;
                    const changes = filterChanges(extension.changes, active);
                    return (
                      <li key={id} class="library-tree" data-extension-row={id}>
                        <div class="library-tree__row">
                          <button
                            type="button"
                            class="library-entry"
                            data-extension-id={id}
                            data-ahead={extension.ahead ? "true" : undefined}
                            data-active={extension.active ? "true" : "false"}
                            data-pinned={extension.pinned ? "true" : undefined}
                            data-current={current ? "true" : undefined}
                            aria-current={current ? "true" : undefined}
                            onClick$={() => open$(id)}
                          >
                            <span class="library-entry__label">{id}</span>
                            <span class="library-entry__version">
                              {extension.version}
                            </span>
                            {!extension.active && (
                              <span
                                class="library-entry__state"
                                data-extension-state="inactive"
                              >
                                inactive
                              </span>
                            )}
                            {extension.pinned ? (
                              <span
                                class="library-entry__pinned"
                                title={`Pinned to revision ${extension.pinnedAt}; newer truth waits until it follows the release pin again`}
                                aria-label="pinned to a version of its own"
                              >
                                pinned
                              </span>
                            ) : (
                              extension.ahead && (
                                <span
                                  class="library-entry__ahead"
                                  title={`Newer truth at ${extension.newestRevision} waits for promotion`}
                                  aria-label="newer truth waits for promotion"
                                />
                              )
                            )}
                            {current && (
                              <span
                                class="library-entry__marker"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                          <button
                            type="button"
                            class="library-action library-action--icon"
                            aria-label={`New change for ${id}`}
                            data-new-change={id}
                            disabled={state.creating !== null}
                            onClick$={() => create$(id)}
                          >
                            <Icon name="plus" />
                          </button>
                        </div>
                        {changes.length > 0 && (
                          <ul class="library-list library-list--children" data-changes-of={id}>
                            {changes.map((change) => (
                              <ChangeRow
                                key={change.documentId}
                                change={change}
                                current={activeItemId === change.documentId}
                                open$={openChange$}
                              />
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
        {listing.reachable &&
          filterChanges(listing.other, active).length > 0 &&
          (() => {
            const other = filterChanges(listing.other, active);
            return (
              <div data-library-group="other">
                <h3 class="library-group">Other</h3>
                <ul class="library-list library-list--children" data-changes-of="">
                  {other.map((change) => (
                    <li key={change.documentId} class="library-tree">
                      <span class="library-tree__named" data-extension-missing={change.change}>
                        {change.change}
                      </span>
                      <ul class="library-list library-list--children">
                        <ChangeRow
                          change={change}
                          current={activeItemId === change.documentId}
                          open$={openChange$}
                        />
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
      </>
    );
  },
);
