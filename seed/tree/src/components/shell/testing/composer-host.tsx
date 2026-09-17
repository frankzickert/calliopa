import { $, component$, useStore } from "@builder.io/qwik";

import {
  commandTarget,
  NO_CHOICE,
  NO_UNAIMED,
  type Pointing,
} from "~/lib/command-target";
import { activeTab, type Tab, type TabsState } from "~/lib/tabs";
import { attachFiles, readyDescriptors, uploadingNames, type UploadAnswer } from "~/lib/attachments";
import { Composer, type ComposerAim, type ComposerRun } from "../composer";
import type { ViewAction, ViewDock, ViewReveal } from "../view-bridge";

/**
 * The composer wired in real JSX the way the shell wires it, over stores the
 * host owns: the dock's contributed action, the tabs, the aim with its marks,
 * the run and `reveal`. The report is the plain `NO_POINTING` until the first
 * one arrives and the store's object after. Test support, imported by the
 * composer's `*.test.ts` files and nothing that ships. BO_0227_017 CA_0039_001
 *
 * Real JSX is the point. The optimizer compiles a prop written as
 * `object.field` through `_wrapProp`, which stays reactive only when the
 * object is a store; a test that builds its elements with `jsx()` never meets
 * that, which is how two lists froze in the served shell while every such
 * test passed.
 *
 * Beside the composer it shows what `sendGoal$` would post
 * (`commandTarget`, the very function the shell's press calls) and what the
 * last chip wrote into `reveal`, for a test to read.
 */
/**
 * The host's upload: it answers each file when the test releases it, with the
 * descriptor the kernel answers for text — the file's real SHA-256 — or the
 * refusal a released name asks for. The native picker cannot be filled in this
 * DOM, so the host hands `attachFiles`, the function the picker's change calls,
 * files it builds; what the chips and the post show is the component's own.
 * BO_0229_013
 */
const pending: { name: string; answer: (refusal: string | null) => void }[] = [];

const hostUpload = (file: File): Promise<UploadAnswer> =>
  new Promise((resolve) => {
    pending.push({
      name: file.name,
      answer: (refusal) => {
        if (refusal !== null) {
          resolve({ ok: false, error: refusal });
          return;
        }
        void file.arrayBuffer().then(async (bytes) => {
          const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
          const hash = `sha256:${Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("")}`;
          resolve({
            ok: true,
            descriptor: { hash, size: file.size, mediaType: file.type || "text/plain", filename: file.name, text: null, textStatus: "text" },
          });
        });
      },
    });
  });

/** Forgets uploads a test left held, so none answers into the next mount. */
export const resetUploads = (): void => {
  pending.length = 0;
};

/** Answers the oldest held upload: with its descriptor, or refused. */
export const releaseUpload = (refusal: string | null = null): void => {
  pending.shift()?.answer(refusal);
};

const documentTab = (id: string, title: string): Tab => ({
  id: `tab-${id}`,
  kind: "documents:document",
  title,
  itemId: id,
  viewType: "block-editor",
  selection: null,
  drawerContext: null,
  unsaved: false,
});

const settingsTab: Tab = {
  id: "tab-settings",
  kind: "settings:settings",
  title: "Settings",
  itemId: "instance",
  viewType: "settings",
  selection: null,
  drawerContext: null,
  unsaved: false,
};

export const ComposerHost = component$<{ report: Pointing }>(({ report }) => {
  const commandMode: ViewAction = {
    kind: "toggle",
    id: "command-mode",
    label: "Command mode",
    on: false,
    run$: $(() => undefined),
  };
  const dock = useStore<ViewDock>({ action: commandMode });
  const tabs = useStore<TabsState>({
    tabs: [
      documentTab("doc-1", "Draft of the storm chapter"),
      documentTab("doc-2", "Notes"),
      settingsTab,
    ],
    activeTabId: "tab-doc-1",
  });
  const aim = useStore<ComposerAim>({ pointing: {}, choice: NO_CHOICE, unaimed: NO_UNAIMED });
  const run = useStore<ComposerRun>({
    runtimes: [],
    agent: null,
    sending: false,
    notice: null,
    attachments: [],
    attachNotice: null,
  });
  const reveal = useStore<ViewReveal>({ itemId: null, target: null, seq: 0 });
  const target = commandTarget(activeTab(tabs), aim.choice, aim.pointing, aim.unaimed);
  return (
    <div>
      <Composer
        dock={dock}
        tabs={tabs}
        aim={aim}
        run={run}
        reveal={reveal}
        onRun$={$(() => undefined)}
        onChooseAgent$={$(() => undefined)}
      />
      <button
        type="button"
        data-report
        onClick$={() => {
          aim.pointing = { "doc-1": report };
        }}
      >
        report
      </button>
      <button
        type="button"
        data-sending
        onClick$={() => {
          run.sending = !run.sending;
        }}
      >
        sending
      </button>
      {tabs.tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          data-switch={tab.id}
          onClick$={() => {
            tabs.activeTabId = tab.id;
            // The shell's tab switch clears the old view's action, and a
            // document's editor contributes its toggle again.
            dock.action = tab.kind === "documents:document" ? commandMode : null;
          }}
        >
          {tab.title}
        </button>
      ))}
      <button
        type="button"
        data-nothing-open
        onClick$={() => {
          // Every tab closed: the workspace is empty and nothing contributes.
          tabs.activeTabId = null;
          dock.action = null;
        }}
      >
        nothing open
      </button>
      <button
        type="button"
        data-host-attach
        onClick$={() => {
          // Two small files, and one past the 10 MB bound. Not awaited: the
          // uploads wait on the test's release.
          void attachFiles(
            run,
            [
              new File(["# Plan\n"], "plan.md", { type: "text/markdown" }),
              new File(["notes"], "notes.txt", { type: "text/plain" }),
              new File([new Uint8Array(10 * 1024 * 1024 + 1)], "huge.bin"),
            ],
            hostUpload,
          );
        }}
      >
        attach
      </button>
      <button
        type="button"
        data-host-attach-many
        onClick$={() => {
          void attachFiles(
            run,
            Array.from({ length: 11 }, (_, index) => new File([`file ${index}`], `f${index}.txt`, { type: "text/plain" })),
            hostUpload,
          );
        }}
      >
        attach eleven
      </button>
      <output data-target>{JSON.stringify(target)}</output>
      <output data-attachments-sent>{JSON.stringify(readyDescriptors(run.attachments).map((d) => d.filename))}</output>
      <output data-attachments-uploading>{JSON.stringify(uploadingNames(run.attachments))}</output>
      <output data-reveal>
        {JSON.stringify({ itemId: reveal.itemId, target: reveal.target, seq: reveal.seq })}
      </output>
    </div>
  );
});
