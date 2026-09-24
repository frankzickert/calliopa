import type { Acceptance, Consequences } from "~/extensions/documents/lib/phase";
import type { BranchRead, Standing as BranchStanding } from "~/extensions/documents/lib/branch";
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
  type ViewBar,
  type ViewInspector,
  type ViewCommand,
  type ViewGesture,
  type SentCommand as ViewSent,
  type ViewComposeBlock,
  type ViewAgents,
  type ViewProposed,
  type ViewFocus,
  type ViewReveal,
  type ViewDrop,
  type ViewActivity,
  type ViewAnswerAll,
  type ViewToggleRun,
  type RunChip,
} from "~/components/shell/view-bridge";
import type { DocumentActivity } from "~/server/agent/run-events";
import { ViewBarPanel } from "~/components/shell/view-bar";
import type { Tab } from "~/lib/tabs";
import type { Pointing, RevealTarget } from "~/lib/command-target";
import type { Standing } from "../../lib/disposition";
import type { BlockHistory, BlockProvenance, DocumentRelations } from "../../server/work";
import type { FocusedWork } from "~/server/focused-work";
import type { DocumentJudgements } from "../../server/judgements";
import type { BlockView, DocumentView } from "../../server/assemble";
import type { DocumentProposals } from "../../server/documents";
import { orderBetween } from "~/lib/order";
import { splitRuns, type Run } from "~/lib/runs";
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
/** One of the reader's runs as the harness hands it to the view. */
export interface HarnessActivity {
  readonly runId: string;
  readonly agent?: string;
  readonly running: boolean;
  readonly events: readonly DocumentActivity[];
}

export interface BridgeRecord {
  /** The targets a view asked the shell to open, in order. BO_0291_026 */
  opened?: { kind: string; itemId: string; title: string }[];
  pointing: Pointing | null;
  selection: string | null | undefined;
  /** What the next press on `[data-harness-reveal]` asks the view to show,
   * as a chip in the composer asks it. CA_0039_005 */
  reveal: RevealTarget | null;
  /** The words a view asked the composer to start with. CA_0046_006 */
  compose?: string;
  /** The block the shell asks the view to focus once it shows, as a return
   * along the route does. CA_0047_004 */
  focusOn?: string;
  /** The retargets a view asked for, in order. CA_0047_004 */
  retargets: { itemId: string; title: string; route: readonly { itemId: string; title: string; blockId?: string }[]; focus?: string }[];
  /** The shell's block controls a press reached, in press order. CA_0065_004 */
  blockControls: { control: string; blockId: string }[];
  /** The drags the view asked the shell to start, by item. BO_0233_012 */
  drags: string[];
  /** The branch the view last said the tab works in. BO_0250 */
  branch?: string | null;
  /** The headlines of the messages the view raised, in order. CA_0053_007 */
  messages?: string[];
  /** What the next press on `[data-harness-drop]` drops, and where, as the
   * shell's drag model hands a view a drop. BO_0263_002 */
  drop?: { readonly itemId: string; readonly overId: string };
  /** The run chips the view last reported. BO_0265_014 */
  chips?: readonly RunChip[];
  /** What the next press on `[data-harness-activity]` hands the view as the
   * reader's run, or runs side by side, as the shell's poll does; a run the
   * harness handed before and names again is replaced. BO_0265_012
   * BO_0269_018 */
  activity?: HarnessActivity | readonly HarnessActivity[];
  /** What the next press on `[data-harness-answer-all]` answers, as a run
   * chip's press does. BO_0265_014 */
  answerAll?: { readonly group: string; readonly answer: "accepted" | "rejected" };
  /** The chip the next press on `[data-harness-toggle-run]` presses, as the
   * shell hands a chip's own press over. CA_0055_006 */
  toggleRun?: string;
  /** Whether that press is a session chip's pencil. CA_0057_014 */
  toggleWork?: boolean;
  /** The commands the view sent from its blocks, and what the next send
   * answers — a run, or a refusal in words. BO_0267_018 */
  commands?: ViewCommand[];
  /** The gestures a view asked, in press order. BO_0258_006 */
  gestures?: ViewGesture[];
  sendAnswer?: ViewSent;
  /** What the next press on `[data-harness-compose]` asks the view to write
   * into a new block, as the shell hands over `composeCommand$` on a
   * document tab. BO_0267_018 */
  composeBlock?: string;
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
    /** What a read of the proposals answers once this says something: a
     * process that filled a proposed block after the view read it. CA_0063_005 */
    readonly proposalsRead?: () => DocumentProposals | undefined;
    /** The document follows the revises and splits it answers, as the graph
     * does: a stale base is a conflict, a revise lands its runs and a split
     * its tail, under the identity the command names. CA_0045_005 */
    readonly follow?: boolean;
    /** How long a revise or a split takes to answer, as a phone's round trip
     * does. CA_0045_003 */
    readonly writeDelayMs?: number;
    /** Refuses every split as a conflict. CA_0045_005 */
    readonly refuseSplits?: boolean;
    /** Refuses the first `times` of a command as the kernel's per-node floor
     * does, `write_too_frequent`, and lands the ones after. DO_0015_002 */
    readonly refuseByFloor?: { readonly command: string; readonly times: number };
    /** Every read of the document itself, recorded. CA_0045_003 */
    readonly reads?: string[];
    /** How long a read of the document takes to answer. CA_0045_003 */
    readonly readDelayMs?: number;
    /** The document's claims and relations, as the relations read answers
     * them; provenance per block; claim history per block. CA_0046 */
    readonly relations?: DocumentRelations;
    readonly provenance?: Readonly<Record<string, BlockProvenance>>;
    readonly history?: Readonly<Record<string, BlockHistory>>;
    /** Every read of the depth's routes, recorded. CA_0046 */
    readonly depthReads?: string[];
    /** The reader's mark on the document, as the read-mark route answers it;
     * every mark written is recorded in `marks`. BO_0246_007 */
    readonly readMark?: number | null;
    /** The runs the document's run list answers, newest first. BO_0267_018 */
    readonly runs?: readonly { readonly id: string; readonly goal: string; readonly status: string; readonly source: string | null; readonly references: readonly unknown[]; readonly touched: readonly string[]; readonly agent: string | null; readonly group: string | null; readonly startedAt: number }[];
    readonly marks?: number[];
    /** The focused work the document's blocks have, as the focused read
     * answers it; an open of a block not there is answered as created, with
     * the child's id `child-<blockId>`. CA_0047 */
    readonly focused?: FocusedWork;
    /** The judgements runs proposed and nobody has answered, as
     * `calliopa-refine` reads them. The fourth depth category draws them, so a
     * suite that wants it supplies them here. RF_0001_003 */
    readonly proposedJudgements?: readonly unknown[];
    /** The document's judgements, as the judgements read answers them; a
     * *Seen* resolves its judgement here, so the re-read shows it gone, and
     * a classification lands as the block's newest. BO_0248 */
    readonly judgements?: DocumentJudgements;
    /** The consequences read the transition card fetches when it opens. BO_0249 */
    readonly consequences?: Consequences;
    /** What the root's acceptance accepted, per claim, read with the
     * judgements: the line counts it and the card reports it. BO_0274_006 */
    readonly acceptance?: Acceptance;
    /** Refuse the phase write with this detail, so the card names it. */
    readonly refusePhase?: string;
    /** The person's branch on the document, as `GET documents/[id]/branch` answers. BO_0250 */
    readonly branch?: BranchRead;
    /** The document's retired blocks, as the retired read answers them. BO_0263_002 */
    readonly retired?: readonly BlockView[];
    /** Documents under separation of duties, as `GET d/[id]/policy` answers. BO_0212_011 */
    readonly required?: boolean;
    /** Refuse a save into truth — a command with no branch — as the core does
     * under separation of duties. BO_0212_011 */
    readonly refuseTruthSaves?: boolean;
    /** The branch's standing, as `GET documents/[id]/standing` answers — a
     * function when a later read should answer differently. BO_0250 */
    readonly standing?: BranchStanding | (() => BranchStanding);
    /** Every read's `?branch=` overlay, in order, `""` for truth. BO_0250 */
    readonly overlays?: string[];
    /** The document a named group holds, for a read with that overlay. BO_0250 */
    readonly overlayDocuments?: Readonly<Record<string, DocumentView>>;
    /** Refuses every gesture with these words, as a document already being
     * looked at does. BO_0258_006 */
    readonly refuseGesture?: string;
    /** The workspace's processes, for a view following a run it started: a
     * function so a later poll can answer a finished run. BO_0258_006c */
    readonly processes?: () => readonly Record<string, unknown>[];
  } = {},
): Fetch {
  let judgements: DocumentJudgements | null = options.judgements ?? null;
  let current = document;
  /** The document's retired blocks: what the retired read answers, which a
   * retire adds to. DO_0017_002 */
  let retired: readonly BlockView[] = options.retired ?? [];
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
  let gone = false;
  let floorRefusalsLeft = options.refuseByFloor?.times ?? 0;
  return async (input, init) => {
    const full =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    // A read's overlay travels as `?branch=`; the routes below match the path.
    const [url, queryString] = full.split("?", 2) as [string, string | undefined];
    const query = new URLSearchParams(queryString ?? "");
    const overlay = query.get("branch") ?? "";
    if (init?.method !== "POST" && init?.method !== "PUT") options.overlays?.push(overlay);
    const base = `/api/x/documents/d/${document.documentId}`;
    // The depth's reads are calliopa-refine's routes since BO_0256. BO_0264
    const refine = `/api/x/calliopa-refine/documents/${document.documentId}`;
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}")) as Record<
        string,
        unknown
      >;
      // Opening a block as focused work is the shell's own endpoint since
      // `CA_0065`, not a command of this extension's.
      if (url === `/api/focused-work/${document.documentId}`) {
        const blockId = String(body["blockId"] ?? "");
        const child = options.focused?.[blockId];
        return answer(
          child === undefined
            ? { blockId, itemId: `child-${blockId}`, title: `Focused ${blockId}`, created: true, dataRevision: "1" }
            : { blockId, itemId: child.itemId, title: child.title, created: false, dataRevision: "" },
        );
      }
      sent.push({ url, body });
      if (options.refuseByFloor !== undefined && body["command"] === options.refuseByFloor.command && floorRefusalsLeft > 0) {
        floorRefusalsLeft -= 1;
        return new Response(
          JSON.stringify({ outcome: "validationFailure", failures: [{ operation: null, rule: "write_too_frequent", detail: `node:${String(body["blockId"])} was written less than 250ms ago; coalesce edits in the editor — every save archives a revision into permanent history` }] }),
          { status: 429, headers: { "content-type": "application/json" } },
        );
      }
      // What a gesture's run is started with, and where a gesture is refused
      // in words: `calliopa-refine` reads it at the pin. BO_0258_006
      if (url === `${refine}/gesture`) {
        if (options.refuseGesture !== undefined) {
          return new Response(JSON.stringify({ error: options.refuseGesture }), { status: 409, headers: { "content-type": "application/json" } });
        }
        return answer({
          goal: `${String(body["gesture"])} about ${String(body["blockId"] ?? document.documentId)}`,
          context: "the document as it stands",
          intention: "calliopa-refine.intention",
        });
      }
      if (options.refuseTruthSaves === true && body["command"] === "revise" && (body["branch"] === undefined || body["branch"] === null)) {
        return new Response(
          JSON.stringify({ outcome: "validationFailure", failures: [{ operation: null, rule: "write_refused", detail: "separation_of_duties_requires_proposal: node:x is content of \"documents\" under separation of duties: it changes only through a proposal someone else accepts" }] }),
          { status: 409, headers: { "content-type": "application/json" } },
        );
      }
      const revisionId = `rev-next-${++revisions}`;
      if (body["command"] === "resolveJudgement" && judgements !== null) {
        const id = String(body["judgementId"]);
        const resolved = `harness at ${new Date().toISOString()}`;
        judgements = {
          ...judgements,
          judgements: judgements.judgements.map((judgement) => (judgement.judgementId === id ? { ...judgement, resolved } : judgement)),
          pressure: Object.fromEntries(
            Object.entries(judgements.pressure).map(([blockId, views]) => [blockId, views.filter((view) => view.judgementId !== id)]),
          ),
        };
        judgements = { ...judgements, state: Object.values(judgements.pressure).flat().some((view) => view.outcome === "invalidated") ? "needsReview" : Object.values(judgements.pressure).flat().some((view) => view.outcome === "material") ? "underPressure" : null };
        return answer({ judgementId: id, resolved, dataRevision: "1" });
      }
      if (body["command"] === "classify") {
        const judgementId = `judgement-${revisionId}`;
        const base = judgements ?? { documentId: document.documentId, judgements: [], pressure: {}, state: null };
        const newest = Math.max(0, ...base.judgements.map((judgement) => judgement.dataRevision)) + 1;
        judgements = {
          ...base,
          judgements: [
            {
              judgementId,
              about: "change",
              outcome: String(body["outcome"]),
              explanation: (body["explanation"] ?? []) as Run[],
              dataRevision: newest,
              recordedAt: Date.now(),
              run: null,
              by: "harness",
              subject: String(body["blockId"]),
              target: null,
              resolves: null,
              resolved: null,
            },
            ...base.judgements,
          ],
        };
        return answer({ judgementId, blockId: String(body["blockId"]), dataRevision: "1" });
      }
      // A retired block leaves the document and stands in the retired read,
      // as the graph leaves it: the containment is closed and nothing else is
      // written. DO_0017_002
      if (options.follow === true && body["command"] === "retire") {
        const going = current.blocks.find((block) => block.blockId === body["blockId"]);
        if (going === undefined) return new Response("{}", { status: 404 });
        current = { ...current, blocks: current.blocks.filter((block) => block !== going) };
        retired = [...retired, going];
        return answer({ blockId: going.blockId, revisionId: going.revisionId });
      }
      if (options.follow === true && body["command"] === "merge") {
        const into = current.blocks.find((block) => block.blockId === body["intoBlockId"]);
        const from = current.blocks.find((block) => block.blockId === body["blockId"]);
        if (into === undefined || from === undefined || into.kind !== "text" || from.kind !== "text")
          return new Response("{}", { status: 404 });
        current = {
          ...current,
          blocks: current.blocks
            .filter((block) => block !== from)
            .map((block) => (block === into ? { ...into, runs: [...into.runs, ...from.runs], revisionId } : block)),
        };
        return answer({ blockId: into.blockId, revisionId });
      }
      if (options.follow === true && (body["command"] === "revise" || body["command"] === "split")) {
        if (options.writeDelayMs !== undefined) {
          await new Promise((resolve) => setTimeout(resolve, options.writeDelayMs));
        }
        const index = current.blocks.findIndex((block) => block.blockId === body["blockId"]);
        const block = current.blocks[index];
        if (block === undefined || block.kind !== "text") return new Response("{}", { status: 404 });
        const conflict = () =>
          new Response(
            JSON.stringify({
              outcome: "conflict",
              conflicts: [{ nodeId: `node:${block.blockId}`, expectedRevisionId: String(body["baseRevisionId"]), currentRevisionId: block.revisionId }],
            }),
            { status: 409, headers: { "content-type": "application/json" } },
          );
        if (body["baseRevisionId"] !== block.revisionId) return conflict();
        if (body["command"] === "revise") {
          current = {
            ...current,
            blocks: current.blocks.map((candidate) =>
              candidate === block ? { ...block, runs: body["runs"] as Run[], revisionId } : candidate,
            ),
          };
          return answer({ blockId: block.blockId, revisionId });
        }
        if (options.refuseSplits === true) return conflict();
        // The head's words travel with the split, as the graph splits them.
        // DO_0015_001
        const source = Array.isArray(body["runs"]) ? (body["runs"] as Run[]) : block.runs;
        const [head, tail] = splitRuns(source, Number(body["at"]));
        const tailBlockId = typeof body["tailBlockId"] === "string" ? body["tailBlockId"] : `blk-tail-${revisions}`;
        const tailRevisionId = `rev-next-${++revisions}`;
        const order = orderBetween(block.order, current.blocks[index + 1]?.order ?? "");
        current = {
          ...current,
          blocks: [
            ...current.blocks.slice(0, index),
            { ...block, runs: head, revisionId },
            { ...block, blockId: tailBlockId, revisionId: tailRevisionId, containmentId: `c-${tailBlockId}`, order, runs: tail },
            ...current.blocks.slice(index + 1),
          ],
        };
        return answer({ blockId: block.blockId, revisionId, tailBlockId, tailRevisionId });
      }
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
          // An accepted candidate becomes the block's revision under its own
          // identity, as CCGW establishes it (BO_0263_004).
          const proposed = { ...item.block };
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
        // A started document goes with its first accepted item, and with its
        // last rejected one, as the server takes it. BO_0251_009
        if (current.proposed !== undefined && body["answer"] === "accepted") {
          const { proposed: _taken, ...taken } = current;
          current = taken;
        } else if (current.proposed !== undefined && proposals.groups.every((group) => group.groupId !== current.proposed?.group)) {
          gone = true;
        }
        return answer({ itemId: body["itemId"], answer: body["answer"], dataRevision: "1", groupState: "open" });
      }
      if (body["command"] === "rename") {
        // Retitling a started document takes it. BO_0251_009
        const { proposed: _taken, ...taken } = current;
        current = { ...taken, title: String(body["title"]), revisionId };
        return answer({ documentId: document.documentId, revisionId, dataRevision: "1" });
      }
      if (body["command"] === "setDocumentPhase") {
        if (options.refusePhase !== undefined) {
          return new Response(JSON.stringify({ outcome: "refused", detail: options.refusePhase }), { status: 403, headers: { "content-type": "application/json" } });
        }
        current = {
          ...current,
          revisionId,
          phase: String(body["phase"]),
          // The stamp the write leaves, as the server writes it. BO_0274_005
          ...(String(body["phase"]) === "accepted" ? { acceptedAt: 100 } : {}),
        } as DocumentView;
        return answer({ documentId: document.documentId, revisionId, dataRevision: "1" });
      }
      if (body["command"] === "placeProposal") {
        return answer({ itemId: body["itemId"], order: "placed" });
      }
      if (body["command"] === "promoteBlock") {
        return answer({ group: `node:promote-${String(body["blockId"])}-harness-1` });
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
    if (url === base) {
      options.reads?.push(url);
      if (options.readDelayMs !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, options.readDelayMs));
      }
      if (gone) {
        return new Response(JSON.stringify({ outcome: "noResult", detail: `No document ${document.documentId} in this graph.` }), { status: 404, headers: { "content-type": "application/json" } });
      }
      const held = overlay !== "" ? options.overlayDocuments?.[overlay] : undefined;
      return answer(held ?? current);
    }
    if (url === `${base}/policy`) {
      return answer({ required: options.required === true });
    }
    if (url === `${base}/branch`) {
      return answer(options.branch ?? { branch: `node:branch-${document.documentId}-harness`, sessions: [] });
    }
    if (url === `${base}/standing`) {
      options.depthReads?.push(url);
      const standing = typeof options.standing === "function" ? options.standing() : options.standing;
      return answer(standing ?? { proposal: overlay, status: "open", base: 1, head: 1, members: [] });
    }
    if (url === `${base}/changes`)
      return answer({ changeCount: 1, lastWrittenAt: null });
    if (url === `${base}/proposals`) {
      const asBegun = options.proposalsRead?.() ?? proposals;
      const delay = options.proposalsDelayMs?.() ?? 0;
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      return answer(asBegun);
    }
    if (url === `${base}/retired`) return answer(retired);
    if (url === "/api/workspaces/harness-workspace/processes") {
      // The workspace's processes, where a run's conclusion lands. BO_0258_006c
      return new Response(JSON.stringify(options.processes?.() ?? []), { headers: { "content-type": "application/json" } });
    }
    // Focused work is the shell's own endpoint since `CA_0065`, not an
    // extension's: the frame asks the kind's contribution for the child.
    if (url === `/api/focused-work/${document.documentId}` && init?.method !== "POST") {
      options.depthReads?.push(url);
      return answer(options.focused ?? {});
    }
    // The bare array the route answers, not the `outcome`/`result` envelope
    // the rest carry: `fetchProposedJudgements` reads the body as the list.
    // RF_0001_003
    if (url === `${refine}/proposed-judgements`) {
      return new Response(JSON.stringify(options.proposedJudgements ?? []), {
        headers: { "content-type": "application/json" },
      });
    }
    if (url === `${refine}/judgements`) {
      // Read with the document, as the read mark is, never on focus: the
      // marker at rest and the root's state need it before any focus.
      options.reads?.push(url);
      return answer(judgements ?? { documentId: document.documentId, judgements: [], pressure: {}, state: null });
    }
    if (url === `${refine}/consequences`) {
      options.depthReads?.push(url);
      return answer(options.consequences ?? { documentId: document.documentId, phase: "proposed", permitted: true, policy: "owner", conflicts: [], items: [] });
    }
    if (url === `${refine}/acceptance`) {
      options.reads?.push(url);
      return answer(
        options.acceptance ?? {
          documentId: document.documentId,
          phase: (current as { phase?: string }).phase ?? "proposed",
          items: [],
        },
      );
    }
    if (url === `${refine}/relations`) {
      options.depthReads?.push(url);
      return answer(options.relations ?? { documentId: document.documentId, claims: {}, relations: [] });
    }
    const provenance = /\/blocks\/([^/]+)\/provenance$/u.exec(url);
    if (provenance !== null) {
      options.depthReads?.push(url);
      return answer(options.provenance?.[provenance[1] ?? ""] ?? { blockId: provenance[1], provenance: "human-authored", derivedFrom: [] });
    }
    const history = /\/blocks\/([^/]+)\/history$/u.exec(url);
    if (history !== null) {
      options.depthReads?.push(url);
      return answer(options.history?.[history[1] ?? ""] ?? { blockId: history[1], claims: [], previous: null });
    }
    if (url === `${base}/read`) {
      options.reads?.push(url);
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body ?? "{}")) as { dataRevision?: number };
        options.marks?.push(body.dataRevision ?? -1);
        return answer({ documentId: document.documentId, dataRevision: body.dataRevision ?? null });
      }
      return answer({ documentId: document.documentId, dataRevision: options.readMark ?? null });
    }
    // The runs of the document the person may see, for *Show prompts* and a
    // prompt's marks. BO_0267_018
    if (url === "/api/runs" && query.get("artifact") === document.documentId) {
      // The shell's own route, which answers the list bare, not in the
      // documents API's envelope.
      return new Response(JSON.stringify({ runs: options.runs ?? [] }), { headers: { "content-type": "application/json" } });
    }
    return new Response("{}", { status: 404 });
  };
}

export const tabFor = (document: DocumentView): Tab => ({
  id: `tab-${document.documentId}`,
  kind: "documents:document",
  title: document.title,
  itemId: document.documentId,
  viewType: "block-editor",
  selection: null,
  drawerContext: null,
  unsaved: false,
});

/**
 * The editor for `tab` inside a bridge standing in for the shell's. The editor
 * is rendered here rather than handed in, because a component may not
 * capture a function (`BO_0138`).
 */
export const editorHarness = (tab: Tab, record: BridgeRecord) =>
  component$(() => {
    const drag = useStore({ overId: null, drop: null });
    const inspector = useStore<ViewInspector>({
      text: null,
      facts: [],
      actions: [],
    });
    const agents = useStore<ViewAgents>({
      runtimes: [
        { id: "claude-code", label: "Claude Code", selectable: true, reason: null },
        { id: "codex", label: "Codex", selectable: true, reason: null },
      ] as ViewAgents["runtimes"],
      options: {},
      cost: "",
      agent: "claude-code",
      speed: "fast",
      sending: false,
    });
    const composeBlock = useStore<ViewComposeBlock>({ itemId: null, text: "", seq: 0 });
    /** The focused work a read answered, as the shell keeps it. CA_0065_004 */
    const faces = useStore<{ byItem: Record<string, FocusedWork> }>({ byItem: {} });
    const bar = useStore<ViewBar>({ groups: [] });
    // What a decorating extension adds to it, drawn as the shell draws it.
    // BO_0274_004
    const decorationBar = useStore<ViewBar>({ groups: [] });
    const save = useStore<{ state: null }>({ state: null });
    const proposed = useStore<ViewProposed>({ itemId: null, seq: 0 });
    const reveal = useStore<ViewReveal>({ itemId: null, target: null, seq: 0 });
    const activity = useStore<ViewActivity>({ runs: [], seq: 0 });
    const answerAll = useStore<ViewAnswerAll>({ itemId: null, group: null, answer: null, seq: 0 });
    const toggleRun = useStore<ViewToggleRun>({ itemId: null, key: null, seq: 0 });
    const focus = useStore<ViewFocus>(
      record.focusOn === undefined
        ? { itemId: null, blockId: null, seq: 0 }
        : { itemId: tab.itemId, blockId: record.focusOn, seq: 1 },
    );
    const noop = $(() => undefined);
    const bridge: ViewBridge = {
      workspaceId: "harness-workspace",
      drag,
      inspector,
      bar,
      decorationBar,
      save,
      proposed,
      reveal,
      activity,
      answerAll,
      toggleRun,
      setRunChips$: $((_itemId: string, chips: readonly RunChip[]) => {
        record.chips = chips;
      }),
      startDrag$: $((payload: { itemId: string }) => {
        record.drags.push(payload.itemId);
      }),
      setSelection$: $((selection: string | null) => {
        record.selection = selection;
      }),
      setPointing$: $((_itemId: string, pointing: Pointing) => {
        record.pointing = pointing;
      }),
      setBranch$: $((_itemId: string, branch: string | null) => {
        record.branch = branch;
      }),
      setTitle$: noop,
      setSaveState$: noop,
      targetGone$: noop,
      raiseMessage$: $((message: { headline: string }) => {
        (record.messages ??= []).push(message.headline);
      }),
      openTarget$: $((target: { kind: string; itemId: string; title: string }) => {
        (record.opened ??= []).push({ kind: target.kind, itemId: target.itemId, title: target.title });
      }),
      targetChanged$: noop,
      agentsChanged$: noop,
      composeCommand$: $((text: string) => {
        record.compose = text;
      }),
      composeBlock,
      agents,
      chooseAgent$: $((agent: string) => {
        agents.agent = agent;
      }),
      chooseOption$: $((axis: string, value: string) => {
        agents.options = { ...agents.options, [axis]: value };
      }),
      quoteSend$: $(async () => undefined),
      chooseSpeed$: $((speed: "fast" | "thorough") => {
        agents.speed = speed;
      }),
      refreshAgents$: $(async () => agents.runtimes),
      sendCommand$: $(async (command: ViewCommand): Promise<ViewSent> => {
        (record.commands ??= []).push(command);
        return record.sendAnswer ?? { ok: true, runId: `arun-${record.commands.length}` };
      }),
      // A gesture the harness records like a command, so a view's gestures
      // can be pressed and read back. BO_0258_006
      sendGesture$: $(async (gesture: ViewGesture): Promise<ViewSent> => {
        (record.gestures ??= []).push(gesture);
        return record.sendAnswer ?? { ok: true, runId: `arun-g${record.gestures.length}` };
      }),
      retarget$: $((target: { itemId: string; title: string; route: readonly { itemId: string; title: string; blockId?: string }[]; focus?: string }) => {
        record.retargets.push(target);
      }),
      focus,
      // The shell's focused-work capability, over the same routes the frame
      // uses, so the editor is proven against what the shell really answers.
      // CA_0065_003 CA_0065_004 CA_0065_005
      faces$: $(async (itemId: string) => {
        const answered = await fetch(`/api/focused-work/${itemId}`);
        const outcome = (await answered.json()) as { outcome: string; result?: FocusedWork };
        const work = outcome.outcome === "success" && outcome.result !== undefined ? outcome.result : {};
        faces.byItem = { ...faces.byItem, [itemId]: work };
        return work;
      }),
      blockControls$: $(async (itemId: string, blockId: string) => [
        {
          id: "focused-work",
          label: faces.byItem[itemId]?.[blockId] === undefined ? "Open as focused work" : "Focused work",
          icon: "crosshair-simple" as const,
        },
      ]),
      pressBlockControl$: $(async (control: string, target: { itemId: string; blockId: string; title: string; route: readonly { itemId: string; title: string; blockId?: string }[] }) => {
        record.blockControls.push({ control, blockId: target.blockId });
        const answered = await fetch(`/api/focused-work/${target.itemId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "documents:document", blockId: target.blockId }),
        });
        const outcome = (await answered.json()) as
          | { outcome: "success"; result: { itemId: string; title: string } }
          | { outcome: string; failures?: readonly { detail?: string }[] };
        if (outcome.outcome !== "success") {
          return (outcome as { failures?: readonly { detail?: string }[] }).failures?.[0]?.detail ?? "refused";
        }
        const child = (outcome as { result: { itemId: string; title: string } }).result;
        const route = [...target.route];
        const parent = route[route.length - 1];
        if (parent !== undefined) route[route.length - 1] = { ...parent, blockId: target.blockId };
        route.push({ itemId: child.itemId, title: child.title });
        record.retargets.push({ itemId: child.itemId, title: child.title, route });
        return null;
      }),
    };
    useContextProvider(ViewBridgeContext, bridge);
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
        // A drop, as the shell hands one over when a drag is released over a
        // target it does not own. BO_0263_002
        jsx("button", {
          type: "button",
          "data-harness-drop": "",
          onClick$: $(() => {
            if (record.drop === undefined) return;
            (drag as { drop: ViewDrop | null }).drop = {
              payload: { itemId: record.drop.itemId, kind: "documents:document", source: "workspace", operations: ["move"], preview: null },
              operation: "move",
              overId: record.drop.overId,
              seq: ((drag.drop as ViewDrop | null)?.seq ?? 0) + 1,
            };
          }),
          children: "drop",
        }),
        // The reader's run, as the shell's poll hands it over. BO_0265_012
        jsx("button", {
          type: "button",
          "data-harness-activity": "",
          onClick$: $(() => {
            if (record.activity === undefined || tab.itemId === null) return;
            const itemId = tab.itemId;
            const handed: readonly HarnessActivity[] = Array.isArray(record.activity) ? record.activity : [record.activity as HarnessActivity];
            const names = new Set(handed.map((run) => run.runId));
            activity.runs = [
              ...activity.runs.filter((run) => !names.has(run.runId)),
              ...handed.map((run) => ({ itemId, runId: run.runId, agent: run.agent ?? null, running: run.running, events: run.events })),
            ];
            activity.seq += 1;
          }),
          children: "activity",
        }),
        // A process that ended for this document, as the shell's poll says
        // it: the view reads its proposals again. CA_0063_005
        jsx("button", {
          type: "button",
          "data-harness-proposed": "",
          onClick$: $(() => {
            proposed.itemId = tab.itemId;
            proposed.seq += 1;
          }),
          children: "proposed",
        }),
        // A run chip's Reject all or Accept all, as the shell writes it.
        // BO_0265_014
        jsx("button", {
          type: "button",
          "data-harness-answer-all": "",
          onClick$: $(() => {
            if (record.answerAll === undefined) return;
            answerAll.itemId = tab.itemId;
            answerAll.group = record.answerAll.group;
            answerAll.answer = record.answerAll.answer;
            answerAll.seq += 1;
          }),
          children: "answer all",
        }),
        // A press on a run chip itself, as the shell writes it. CA_0055_006
        jsx("button", {
          type: "button",
          "data-harness-toggle-run": "",
          onClick$: $(() => {
            if (record.toggleRun === undefined) return;
            toggleRun.itemId = tab.itemId;
            toggleRun.key = record.toggleRun;
            toggleRun.work = record.toggleWork === true;
            toggleRun.seq += 1;
          }),
          children: "toggle run",
        }),
        // Words for the document's next command, as the shell hands them
        // over on a document tab. BO_0267_018
        jsx("button", {
          type: "button",
          "data-harness-compose": "",
          onClick$: $(() => {
            if (record.composeBlock === undefined) return;
            composeBlock.itemId = tab.itemId;
            composeBlock.text = record.composeBlock;
            composeBlock.seq += 1;
          }),
          children: "compose",
        }),
        // The view's bar, drawn by the shell's own component. CA_0053_007
        jsx(ViewBarPanel, { bar, decorations: decorationBar }),
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
export async function mountEditor(
  document: DocumentView,
  options: {
    /** The tab's route, as a tab retargeted along one carries it. CA_0047 */
    readonly route?: Tab["route"];
    /** The block the shell asks the view to land on. CA_0047_004 */
    readonly focusOn?: string;
    /** Whether mounting waits for the reads the editor starts after its
     * first render; a test that holds a read open to prove the page does not
     * wait on it says no. DO_0001_003 */
    readonly awaitReads?: boolean;
  } = {},
) {
  // The editor's counts and proposals are read by a visible task, after the
  // render rather than before it (DO_0001_001), so a mounted editor is one
  // whose reads have answered and whose renders have settled: every read the
  // editor starts is counted until it answers. The count wraps whatever the
  // test stubbed, and a later stub replaces it.
  const stubbed = globalThis.fetch;
  let inFlight = 0;
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    inFlight += 1;
    try {
      return await stubbed(...args);
    } finally {
      inFlight -= 1;
    }
  }) as typeof fetch;
  const record: BridgeRecord = {
    pointing: null,
    selection: undefined,
    reveal: null,
    drags: [],
    retargets: [],
    blockControls: [],
    ...(options.focusOn === undefined ? {} : { focusOn: options.focusOn }),
  };
  const dom = await createDOM();
  const tab: Tab = { ...tabFor(document), ...(options.route === undefined ? {} : { route: options.route }) };
  await dom.render(jsx(editorHarness(tab, record), {}));
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
  /** Settles until no read the editor started is in flight: what a test
   * awaits before it ends, so a read a late render starts never reaches a
   * `fetch` the next test has unstubbed. DO_0001_003 */
  const idle = async () => {
    let quiet = 0;
    await settle(() => {
      quiet = inFlight === 0 ? quiet + 1 : 0;
      return quiet >= 3;
    });
  };
  if (options.awaitReads !== false) await idle();
  return { ...dom, root, record, settle, idle };
}

type MountedEditor = Awaited<ReturnType<typeof mountEditor>>;

/** Edits a block as a reader does from the keyboard: focus, then Enter. */
export async function activateBlock(view: MountedEditor, blockId: string): Promise<void> {
  await view.userEvent(`[data-block-id="${blockId}"] [data-block-reading]`, "focus");
  await view.userEvent(`[data-block-id="${blockId}"] [data-block-reading]`, "keydown", { key: "Enter" });
  await view.settle(() => view.root.querySelector(`[data-block-command="${blockId}"]`) != null);
}

/** Points from a block, as the reader does: edits it, then presses *Point
 * from this block* on its command control. BO_0267_018 */
export async function pointFrom(view: MountedEditor, blockId: string): Promise<void> {
  if (view.root.querySelector(`[data-block-command="${blockId}"]`) == null) await activateBlock(view, blockId);
  await view.userEvent(`[data-block-command="${blockId}"] [data-block-point]`, "click");
  await view.settle(() => view.root.querySelector("[data-view-body]")?.getAttribute("data-editor-mode") === "command");
}

/** Ends pointing from the prompt pointed from, by its control. */
export async function stopPointing(view: MountedEditor): Promise<void> {
  await view.userEvent("[data-pointing-from] [data-block-point]", "click");
  await view.settle(() => view.root.querySelector("[data-view-body]")?.getAttribute("data-editor-mode") === "reading");
}
