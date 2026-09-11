import {
  $,
  component$,
  jsx,
  useContextProvider,
  useStore,
} from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";

import {
  ViewBridgeContext,
  type ViewBridge,
  type ViewDock,
  type ViewInspector,
  type ViewProposed,
  type ViewReveal,
  type UndoOffer,
} from "~/components/shell/view-bridge";
import type { Tab } from "~/lib/tabs";
import type { Pointing, RevealTarget } from "~/lib/command-target";
import type { Standing } from "~/lib/disposition";
import type { DocumentView } from "~/server/documents/assemble";
import type { DocumentProposals } from "~/server/documents/documents";
import { BlockEditorView } from "../block-editor";

/**
 * The block editor mounted in Qwik's render harness, so its controls can be
 * pressed rather than described (`BO_0224_009`). Test support, imported by the
 * editor's `*.test.ts` files and by nothing that ships. BO_0227_006
 *
 * The bridge is built from real stores the way the shell builds it, and
 * `fetch` answers the documents API's routes from the document the test
 * names, recording every command the editor sends.
 */

export interface SentCommand {
  readonly url: string;
  readonly body: Record<string, unknown>;
}

/** What the harness records of the bridge, for a test to read. */
export interface BridgeRecord {
  pointing: Pointing | null;
  selection: string | null | undefined;
  /** The undo the view last offered, for a test to take back. */
  undo: UndoOffer | null;
  /** What the next press on `[data-harness-reveal]` asks the view to show,
   * as a chip in the composer asks it. CA_0039_005 */
  reveal: RevealTarget | null;
  /** The drags the view asked the shell to start, by item. BO_0233_012 */
  drags: string[];
}

type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const answer = (result: unknown): Response =>
  new Response(JSON.stringify({ outcome: "success", result }), {
    headers: { "content-type": "application/json" },
  });

/**
 * A `fetch` answering the documents API for one document. A standing written
 * lands in the document it answers next, with a new revision, so a re-read
 * shows it; every other command is recorded and answered with a revision.
 * The real write is proven over the one graph (`tests/behavior`).
 */
export function documentsApi(
  document: DocumentView,
  sent: SentCommand[],
  options: {
    /** The proposals the document answers with, answered and placed as the
     * server would. BO_0233_009 */
    readonly proposals?: DocumentProposals;
    /** Refuses every acceptance, as a conflict would. */
    readonly refuseAnswers?: boolean;
    /** How long an answer takes, as the kernel's member decisions do. */
    readonly answerDelayMs?: number;
    /** How long each read of the proposals takes, asked as the read begins.
     * It answers with the list as it stood then, as a slow read does.
     * BO_0233_013 */
    readonly proposalsDelayMs?: () => number;
  } = {},
): Fetch {
  let current = document;
  let revisions = 0;
  let proposals: DocumentProposals = options.proposals ?? {
    documentId: document.documentId,
    unanswered: 0,
    groups: [],
  };
  const withoutItem = (itemId: string) => {
    const groups = proposals.groups
      .map((group) => ({ ...group, items: group.items.filter((item) => item.itemId !== itemId) }))
      .filter((group) => group.items.length > 0);
    proposals = {
      ...proposals,
      groups,
      unanswered: groups.reduce((sum, group) => sum + group.items.length, 0),
    };
  };
  return async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const base = `/api/x/ui.shell/documents/${document.documentId}`;
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}")) as Record<
        string,
        unknown
      >;
      sent.push({ url, body });
      const revisionId = `rev-next-${++revisions}`;
      if (body["command"] === "answerProposal") {
        if (options.answerDelayMs !== undefined) {
          await new Promise((resolve) => setTimeout(resolve, options.answerDelayMs));
        }
        if (options.refuseAnswers === true) {
          return new Response(
            JSON.stringify({ outcome: "refused", detail: "the kernel keeps this decision behind its confirmation" }),
            { status: 403, headers: { "content-type": "application/json" } },
          );
        }
        const item = proposals.groups
          .flatMap((group) => group.items)
          .find((candidate) => candidate.itemId === body["itemId"]);
        if (item !== undefined && body["answer"] === "accepted" && item.block !== null) {
          const proposed = { ...item.block, revisionId };
          current = {
            ...current,
            blocks:
              item.kind === "insert"
                ? [...current.blocks, proposed]
                : item.kind === "remove"
                  ? current.blocks.filter((block) => block.blockId !== item.blockId)
                  : current.blocks.map((block) => (block.blockId === item.blockId ? proposed : block)),
          };
        }
        withoutItem(String(body["itemId"]));
        return answer({ itemId: body["itemId"], answer: body["answer"], dataRevision: "1", groupState: "open" });
      }
      if (body["command"] === "placeProposal") {
        return answer({ itemId: body["itemId"], order: "placed" });
      }
      if (body["command"] === "setDisposition") {
        current = {
          ...current,
          blocks: current.blocks.map((block) =>
            block.kind === "text" && block.blockId === body["blockId"]
              ? { ...block, revisionId, standing: body["standing"] as Standing }
              : block,
          ),
        };
      }
      return answer({ blockId: String(body["blockId"] ?? ""), revisionId });
    }
    if (url === base) return answer(current);
    if (url === `${base}/changes`)
      return answer({ changeCount: 1, lastWrittenAt: null });
    if (url === `${base}/proposals`) {
      const asBegun = proposals;
      const delay = options.proposalsDelayMs?.() ?? 0;
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      return answer(asBegun);
    }
    if (url === `${base}/retired`) return answer([]);
    return new Response("{}", { status: 404 });
  };
}

export const tabFor = (document: DocumentView): Tab => ({
  id: `tab-${document.documentId}`,
  kind: "ui.shell:document",
  title: document.title,
  itemId: document.documentId,
  viewType: "block-editor",
  selection: null,
  drawerContext: null,
  unsaved: false,
});

/**
 * The editor for `tab` inside a bridge, with the dock's action rendered as
 * the shell renders it: a button that runs it with the pressed state flipped.
 * The editor is rendered here rather than handed in, because a component may
 * not capture a function (`BO_0138`).
 */
export const editorHarness = (tab: Tab, record: BridgeRecord) =>
  component$(() => {
    const drag = useStore({ overId: null, drop: null });
    const inspector = useStore<ViewInspector>({
      text: null,
      facts: [],
      actions: [],
    });
    const dock = useStore<ViewDock>({ action: null });
    const save = useStore<{ state: null }>({ state: null });
    const proposed = useStore<ViewProposed>({ itemId: null, seq: 0 });
    const reveal = useStore<ViewReveal>({ itemId: null, target: null, seq: 0 });
    const noop = $(() => undefined);
    const bridge: ViewBridge = {
      drag,
      inspector,
      dock,
      save,
      proposed,
      reveal,
      startDrag$: $((payload: { itemId: string }) => {
        record.drags.push(payload.itemId);
      }),
      setSelection$: $((selection: string | null) => {
        record.selection = selection;
      }),
      setPointing$: $((_itemId: string, pointing: Pointing) => {
        record.pointing = pointing;
      }),
      setTitle$: noop,
      setSaveState$: noop,
      targetGone$: noop,
      raiseMessage$: noop,
      offerUndo$: $((offer: UndoOffer) => {
        record.undo = offer;
      }),
      openTarget$: noop,
      targetChanged$: noop,
    };
    useContextProvider(ViewBridgeContext, bridge);
    const action = dock.action;
    return jsx("div", {
      children: [
        jsx(BlockEditorView, { tab }),
        // A chip's press, as the shell writes it. CA_0039_005
        jsx("button", {
          type: "button",
          "data-harness-reveal": "",
          onClick$: $(() => {
            reveal.itemId = tab.itemId;
            reveal.target = record.reveal;
            reveal.seq += 1;
          }),
          children: "reveal",
        }),
        // The panel's toggles, rendered as the inspector renders them.
        ...inspector.actions.map((contributed) =>
          contributed.kind === "toggle"
            ? jsx("button", {
                type: "button",
                "data-inspector-action": contributed.id,
                "aria-pressed": contributed.on,
                onClick$: $(() => {
                  const live = inspector.actions.find(
                    (candidate) => candidate.id === contributed.id,
                  );
                  if (live !== undefined && live.kind === "toggle")
                    void live.run$(!live.on);
                }),
                children: contributed.label,
              })
            : null,
        ),
        action !== null && action.kind === "toggle"
          ? jsx("button", {
              type: "button",
              "data-dock-action": action.id,
              "aria-pressed": action.on,
              onClick$: $(() => {
                const current = dock.action;
                if (current !== null && current.kind === "toggle")
                  void current.run$(!current.on);
              }),
              children: action.label,
            })
          : null,
      ],
    });
  });

/**
 * Mounts the editor on `document`, with `fetch` answering for it, and waits
 * until its blocks are drawn. The caller installs the fetch
 * (`vi.stubGlobal`) before mounting.
 *
 * The test platform holds every render scheduled outside `render` and
 * `userEvent` until it is flushed, and the editor's reads resolve after both
 * — so `settle` dispatches an event nothing listens for, which flushes. A
 * render left pending also collides with the next test's container ("Must be
 * same function"), which is why a test settles before it ends.
 */
export async function mountEditor(document: DocumentView) {
  const record: BridgeRecord = {
    pointing: null,
    selection: undefined,
    undo: null,
    reveal: null,
    drags: [],
  };
  const dom = await createDOM();
  await dom.render(jsx(editorHarness(tabFor(document), record), {}));
  const root = dom.screen as unknown as HTMLElement;
  const settle = async (until: () => boolean = () => true) => {
    for (let tick = 0; tick < 50; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 2));
      await dom.userEvent(root, "harnessSettle");
      if (until()) return;
    }
    throw new Error("the editor did not settle");
  };
  await settle(() => root.querySelector("[data-block-id]") !== null);
  return { ...dom, root, record, settle };
}
