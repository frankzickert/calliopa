import { $, component$, useContext, useStore, useTask$, useVisibleTask$, type QRL } from "@builder.io/qwik";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import { acceptanceReading, branchItemsOf, rejectedEntries, runRecordsOf, type DriftChoice, type ProposalSession, type Standing } from "../../lib/branch";
import { activateTab, enterBranch, leaveBranch } from "../../lib/branch-scope";
import type { BlockView } from "../../server/assemble";
import { Marked } from "../block-text";
import { describeOutcome, fetchBranch, fetchDocumentIn, fetchPolicy, fetchStanding, sendPromote } from "../documents-client";
import type { Tab } from "~/lib/tabs";
import type { DocumentView } from "../../server/assemble";
import type { DocumentProposals } from "../../server/documents";

/**
 * A person's proposal sessions on the document (`BO_0250_020`–`BO_0250_022`,
 * `CA_0057`): entering and leaving one, the acceptance card that reads a
 * session's standing, and what a rejected session held, promotable a block at
 * a time. Nothing stands under the title for it any more: the view bar's
 * *Work in a proposal* and the session chips ask through the editor's
 * `branchAsk`, and the component answers, writing back which session the tab
 * works in and which stand open. It is this extension's own, drawn on any
 * document the person can edit, and it asks for no run: the core's standing
 * is the whole of what acceptance reads (`BO_0250`, Decided 2026-09-16).
 */
/** What the line reads of the editor: its store, never a copy of it. */
export interface BranchEditor {
  readonly document: DocumentView | null;
  readonly proposals: DocumentProposals | null;
  readonly loaded: number;
  notice: string | null;
  /** Counts the saves the core refused because documents came under
   * separation of duties while the tab was open. BO_0212_011 */
  readonly policyRefusals?: number;
  /** The session the tab works in, or null for truth; written here, read by
   * the bar's toggle and the chips. CA_0057_005 */
  branchGroup: string | null;
  /** Documents are under separation of duties: someone else accepts. CA_0057_010 */
  branchRequired: boolean;
  /** The person's open sessions on the document, for their chips. CA_0057_008 */
  sessions: ProposalSession[];
  /** The last thing the bar's toggle or a session chip asked for. CA_0057_005
   * CA_0057_008 */
  readonly branchAsk: BranchAsk;
}

/** What the bar's toggle and the session chips ask the sessions for: the
 * toggle enters a new session or leaves; a chip's press works in its session
 * or leaves it; its answers accept or reject it. CA_0057_005 CA_0057_008 */
export interface BranchAsk {
  readonly kind: "toggle" | "work" | "accept" | "reject" | null;
  readonly group: string | null;
  readonly seq: number;
}

/**
 * The editor hands its own store and handlers over as props rather than
 * through `EditorSurfaceContext`: a context value is serialized with the
 * server render, so a tab restored from the workspace resumed with the
 * document it held before its read — none — and the line never drew. Found
 * on the served build in the BO_0250 walk, 2026-09-16.
 */
export const BranchLine = component$<{
  editor: BranchEditor;
  documentId: string | null;
  tab: Tab;
  deactivate$: QRL<() => Promise<void>>;
  reload$: QRL<() => Promise<void>>;
  reloadProposals$: QRL<() => Promise<void>>;
  answerProposal$: QRL<(itemId: string, answer: "accepted" | "rejected", overDrift?: boolean) => Promise<void>>;
  /** Saves the active block again, once it stages into the branch. BO_0212_011 */
  retrySave$?: QRL<() => Promise<boolean>>;
}>(({ editor, documentId, tab, deactivate$, reload$, reloadProposals$, answerProposal$, retrySave$ }) => {
  const bridge = useContext(ViewBridgeContext);

  /** The tab's branch, or none for truth; the card's standing, the person's
   * choices for drifted members, a failure or a refused answer; and what a
   * rejected branch held. The branch itself is the group's; nothing here is
   * a fact. */
  const branch = useStore({
    group: null as string | null,
    card: false,
    standing: null as Standing | null,
    standingLoaded: -1,
    choices: {} as Record<string, DriftChoice>,
    failure: null as string | null,
    refusal: null as string | null,
    rejected: null as { group: string; blocks: BlockView[] } | null,
    /** Documents are under separation of duties: the session's own person
     * does not accept it, and leaving it stays possible. BO_0212_011
     * CA_0057_010 */
    required: false,
    policyChecked: false,
    refusalsSeen: 0,
    askSeen: editor.branchAsk.seq,
  });

  /** Reads the standing again: on opening the card, and whenever the
   * document was read again while it is open, since a rewrite in the branch
   * makes a drifted member clean. */
  const readStanding$ = $(async () => {
    if (documentId === null || branch.group === null) return;
    branch.failure = null;
    const read = await fetchStanding(documentId, branch.group);
    branch.standingLoaded = editor.loaded;
    if (read.outcome !== "success") {
      branch.failure = describeOutcome(read);
      return;
    }
    branch.standing = read.result;
    // A member that is no longer drifted has nothing left to choose.
    const drifted = new Set(read.result.members.filter((member) => member.standing === "drifted").map((member) => member.ref));
    branch.choices = Object.fromEntries(Object.entries(branch.choices).filter(([ref]) => drifted.has(ref)));
  });

  const reset$ = $(() => {
    branch.card = false;
    branch.standing = null;
    branch.standingLoaded = -1;
    branch.choices = {};
    branch.failure = null;
    branch.refusal = null;
  });

  /** The person's open sessions, read again for their chips: on opening,
   * after entering, leaving and answering, and once the first staging into
   * the tab's session has minted its group. CA_0057_009 */
  const readSessions$ = $(async (quiet = false): Promise<string | null> => {
    if (documentId === null) return null;
    const read = await fetchBranch(documentId);
    if (read.outcome !== "success") {
      // The chips follow quietly: a read that fails leaves them as they were.
      if (!quiet) editor.notice = describeOutcome(read);
      return null;
    }
    editor.sessions = [...read.result.sessions];
    return read.result.branch;
  });

  /** Enters a session: the one named — a session chip's — or a new one, under
   * the next free name, while earlier ones stand open. The tab reads the
   * document through it. BO_0250_020 CA_0057_007 */
  const enter$ = $(async (keepActive = false, named: string | null = null) => {
    if (documentId === null) return;
    // The active block is saved into the scope it was typed in and let go
    // before the scope changes: a block kept active across the change keeps
    // the revision of the other scope as its base, and its next save is
    // refused as a conflict. Found live in the BO_0250 walk-through. A block
    // whose save the core just refused under separation of duties is kept:
    // truth has not moved, so its base holds in the branch. BO_0212_011
    if (!keepActive) await deactivate$();
    const group = named ?? (await readSessions$());
    if (group === null) return;
    enterBranch(documentId, group, tab.id);
    branch.group = group;
    editor.branchGroup = group;
    branch.rejected = null;
    await reset$();
    await bridge.setBranch$(documentId, group);
    await reload$();
    await reloadProposals$();
  });

  /** Leaving a session only stops editing in it: back to truth, the group
   * left open, under separation of duties too. BO_0250_020 CA_0057_010 */
  const leave$ = $(async () => {
    if (documentId === null) return;
    await deactivate$();
    leaveBranch(documentId, tab.id);
    branch.group = null;
    editor.branchGroup = null;
    await reset$();
    await bridge.setBranch$(documentId, null);
    await reload$();
    await reloadProposals$();
    await readSessions$();
  });

  const choose$ = $((ref: string, choice: DriftChoice) => {
    branch.choices = { ...branch.choices, [ref]: choice };
  });

  /** *Accept*, the deliberate confirmation: every member of the branch
   * answered in the proposals read's order — a drifted member kept accepted
   * over its drift (the override `CA_0042_002` gives a typed-into proposal),
   * a dropped one rejected, the rest accepted — then the tab leaves the
   * branch and reads truth. BO_0250_021 */
  const accept$ = $(async () => {
    if (documentId === null || branch.group === null) return;
    branch.refusal = null;
    const drifted = new Set((branch.standing?.members ?? []).filter((member) => member.standing === "drifted").map((member) => member.ref));
    for (const item of branchItemsOf(editor.proposals, branch.group)) {
      const ref = `node:${item.blockId}`;
      const choice = drifted.has(ref) ? branch.choices[ref] : undefined;
      if (choice === "drop") await answerProposal$(item.itemId, "rejected");
      else await answerProposal$(item.itemId, "accepted", choice === "keep");
      if (editor.notice !== null) {
        branch.refusal = editor.notice;
        return;
      }
    }
    // A run that proposed here left its record as a member; it is accepted
    // with the branch, or the group never closes.
    for (const record of runRecordsOf(branch.standing)) {
      await answerProposal$(`${branch.group}|run|${record}`, "accepted");
      if (editor.notice !== null) {
        branch.refusal = editor.notice;
        return;
      }
    }
    await leave$();
  });

  /** A session chip's *Accept all*: the standing is read, and with nothing
   * drifted the session is accepted at once; otherwise the card stands for
   * the person to keep or drop each drifted member. BO_0250_021 CA_0057_008 */
  const openCard$ = $(async () => {
    await reset$();
    branch.card = true;
    await readStanding$();
    const drifted = (branch.standing?.members ?? []).some((member) => member.standing === "drifted");
    if (branch.standing !== null && branch.failure === null && !drifted) await accept$();
  });

  /** A session chip's *Reject all*: every member rejected, the session left,
   * and what it held differently from truth listed under the title.
   * BO_0250_022 CA_0057_008 */
  const reject$ = $(async () => {
    if (documentId === null || branch.group === null) return;
    const group = branch.group;
    const held = await fetchDocumentIn(documentId, group);
    const standing = await fetchStanding(documentId, group);
    const records = standing.outcome === "success" ? runRecordsOf(standing.result) : [];
    const answers = [...branchItemsOf(editor.proposals, group).map((item) => item.itemId), ...records.map((record) => `${group}|run|${record}`)];
    for (const itemId of answers) {
      await answerProposal$(itemId, "rejected");
      if (editor.notice !== null) {
        branch.refusal = editor.notice;
        return;
      }
    }
    await leave$();
    if (held.outcome === "success" && editor.document !== null) {
      const blocks = [...rejectedEntries(editor.document, held.result)];
      branch.rejected = blocks.length === 0 ? null : { group, blocks };
    }
  });

  /** *Promote this block on its own*: the rejected branch's block restaged
   * into a new group of the person's; its row leaves the list. BO_0250_022 */
  const promote$ = $(async (group: string, blockId: string) => {
    if (documentId === null) return;
    const outcome = await sendPromote(documentId, group, blockId);
    if (outcome.outcome !== "success") {
      editor.notice = describeOutcome(outcome);
      return;
    }
    editor.notice = `Promoted into a new proposal, ${outcome.result.group}.`;
    if (branch.rejected !== null) {
      const blocks = branch.rejected.blocks.filter((block) => block.blockId !== blockId);
      branch.rejected = blocks.length === 0 ? null : { group: branch.rejected.group, blocks };
    }
    await reloadProposals$();
  });

  const dismiss$ = $(() => {
    branch.rejected = null;
  });

  /** The standing follows every read of the document while the card is
   * open, so a rewrite in the branch reads as clean without a press. */
  useTask$(async ({ track }) => {
    const loaded = track(() => editor.loaded);
    const open = track(() => branch.card);
    if (!open || branch.standing === null || branch.standingLoaded === loaded) return;
    await readStanding$();
  });

  /** Whether documents are under separation of duties, and the person's open
   * sessions, asked once per mount once the document is read, for the chips: the tab no longer enters a
   * session by itself on opening — an edit made outside one does, below.
   * BO_0212_011 CA_0057_013 */
  useVisibleTask$(async ({ track }) => {
    const loaded = track(() => editor.loaded);
    if (documentId === null || loaded === 0 || branch.policyChecked) return;
    if (editor.document === null || (editor.document as { change?: string }).change !== undefined) return;
    branch.policyChecked = true;
    const policy = await fetchPolicy(documentId);
    // The person's open sessions, once per mount, for their chips.
    // CA_0057_009
    await readSessions$(true);
    if (policy.outcome !== "success" || !policy.result.required) return;
    branch.required = true;
    editor.branchRequired = true;
  });

  /** An edit made outside a session under separation of duties: the core
   * refuses the save, the tab enters a new session and the save is made
   * again, once, into it. BO_0212_011 CA_0057_013 */
  useVisibleTask$(async ({ track }) => {
    const refusals = track(() => editor.policyRefusals ?? 0);
    if (refusals === 0 || refusals === branch.refusalsSeen) return;
    branch.refusalsSeen = refusals;
    branch.required = true;
    editor.branchRequired = true;
    branch.policyChecked = true;
    if (branch.group === null) {
      await enter$(true);
      if (branch.group === null) return;
      editor.notice = "Documents are reviewed by someone else: your edits go into a proposal.";
      if (retrySave$ !== undefined) await retrySave$();
    }
  });

  /** What the bar's toggle and the session chips ask for, answered as a
   * press would be: the toggle enters a new session or leaves; a chip's press
   * works in its session or leaves it; its answers enter it when the tab is
   * elsewhere, then accept or reject it. CA_0057_005 CA_0057_008 */
  const answerAsk$ = $(async (kind: BranchAsk["kind"], group: string | null) => {
    if (kind === "toggle") {
      if (branch.group === null) await enter$();
      else await leave$();
      return;
    }
    if (group === null) return;
    if (kind === "work") {
      if (branch.group === group) await leave$();
      else await enter$(false, group);
      return;
    }
    if (branch.group !== group) await enter$(false, group);
    if (branch.group !== group) return;
    if (kind === "accept") await openCard$();
    else if (kind === "reject") await reject$();
  });

  /** The ask is answered outside the draw that ran this task, as a press's
   * handler runs: the draw would otherwise wait on every read and write of
   * entering or leaving, and a task that draw started writes in its middle.
   * Qwik's test platform refuses that outright. */
  useVisibleTask$(({ track }) => {
    const seq = track(() => editor.branchAsk.seq);
    if (seq === branch.askSeen) return;
    branch.askSeen = seq;
    const { kind, group } = editor.branchAsk;
    setTimeout(() => void answerAsk$(kind, group), 0);
  });

  /** The sessions follow the reads of the proposals without a read of their
   * own: a session answered elsewhere leaves the proposals and so its chip,
   * and the first staging into the session the tab works in mints its group,
   * which only the branch read dates. CA_0057_009 */
  useVisibleTask$(async ({ track }) => {
    const proposals = track(() => editor.proposals);
    if (proposals === null || documentId === null) return;
    const open = new Set(proposals.groups.map((group) => group.groupId));
    const kept = editor.sessions.filter((session) => open.has(session.branch));
    if (kept.length !== editor.sessions.length) editor.sessions = kept;
    const working = branch.group;
    if (working !== null && open.has(working) && !kept.some((session) => session.branch === working)) await readSessions$(true);
  });

  /** The client helpers read the branch from the module registry on every
   * read and command; the store is what survives a re-render. Kept in step
   * on mount, so a fresh mount works in truth. BO_0250_020 */
  useVisibleTask$(({ track }) => {
    track(() => tab.id);
    track(() => branch.group);
    activateTab(tab.id);
    editor.branchGroup = branch.group;
    if (documentId === null) return;
    if (branch.group === null) leaveBranch(documentId, tab.id);
    else enterBranch(documentId, branch.group, tab.id);
  });

  // A change document's members are read-only: nothing to work on there.
  if (editor.document === null || (editor.document as { change?: string }).change !== undefined) return null;

  const reading = acceptanceReading({ standing: branch.standing, choices: branch.choices, failure: branch.failure });

  return (
    <>
      {branch.group !== null && branch.card && (
        <section class="branch-card" data-branch-card={reading.waiting ? "waiting" : reading.accept ? "ready" : "open"} aria-label={reading.question}>
          <p class="branch-card__question">{reading.question}</p>
          <p class="branch-card__lead" data-branch-lead>
            {reading.lead}
          </p>
          {reading.members.length > 0 && (
            <ul class="branch-card__members">
              {reading.members.map((member) => (
                <li key={member.ref} data-branch-member={member.ref} data-member-standing={member.standing} data-member-choice={member.choice ?? ""}>
                  <span>{member.words}</span>
                  {member.standing === "drifted" && (
                    <span class="branch-card__choices">
                      <button type="button" data-branch-keep={member.ref} aria-pressed={member.choice === "keep"} onClick$={() => choose$(member.ref, "keep")}>
                        Keep mine
                      </button>
                      <button type="button" data-branch-drop={member.ref} aria-pressed={member.choice === "drop"} onClick$={() => choose$(member.ref, "drop")}>
                        Drop
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {reading.note !== null && (
            <p class="branch-card__note" data-branch-note>
              {reading.note}
            </p>
          )}
          {branch.refusal !== null && (
            <p class="branch-card__refusal" role="alert" data-branch-refusal>
              {branch.refusal}
            </p>
          )}
          <p class="branch-card__controls">
            {reading.accept && (
              <button type="button" class="branch-card__accept" data-branch-establish onClick$={accept$}>
                Accept
              </button>
            )}
            <button type="button" data-branch-not-yet onClick$={reset$}>
              Not yet
            </button>
          </p>
        </section>
      )}
      {branch.group === null && branch.rejected !== null && (
        <section class="branch-rejected" data-branch-rejected={branch.rejected.group} aria-label="Rejected proposal">
          <ul class="branch-rejected__rows">
            {branch.rejected.blocks.map((block) => (
              <li key={block.blockId} data-rejected-block={block.blockId}>
                <span class="branch-rejected__label">Rejected proposal · yours</span>{" "}
                {block.kind === "text" && block.runs.map((run, index) => <Marked key={index} text={run.text} marks={run.marks ?? []} link={run.link} />)}{" "}
                <button type="button" data-branch-promote={block.blockId} onClick$={() => promote$(branch.rejected?.group ?? "", block.blockId)}>
                  Promote this block on its own
                </button>
              </li>
            ))}
          </ul>
          <button type="button" class="branch-rejected__dismiss" data-branch-rejected-dismiss onClick$={dismiss$}>
            Dismiss
          </button>
        </section>
      )}
    </>
  );
});
