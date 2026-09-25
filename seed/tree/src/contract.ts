import type { Component, QRL } from "@builder.io/qwik";
import type { RequestEvent } from "@builder.io/qwik-city";
import type { DragOperation } from "~/lib/drag";
import type { IconName } from "~/components/shell/icons";
import type { ViewProps } from "~/components/shell/view-host";
import type { PartyAuthorization, PartyTest } from "~/server/kernel/client";
import type { Run } from "~/lib/runs";
import type { GraphOutcome } from "~/server/outcome";

/**
 * What an extension present in the tree may contribute to the shell, as typed
 * values its entrypoint exports. The shell resolves the contributions at build
 * time — the registry plugin scans `src/extensions/<id>/manifest.json`, reads
 * each manifest's `entrypoint`, and emits `src/registry.gen.ts` and
 * `src/registry.server.gen.ts`, which import every present entrypoint and
 * export the merged registries. Nothing is loaded at runtime: no dynamic
 * import, no graph-source materialization, no enable/disable flow. BO_0202_001
 *
 * The entrypoint has two halves. `contributions.ts` exports what the browser
 * needs — library sections, tab kinds with their views — and
 * `contributions.server.ts` exports what only the server may hold — the API
 * handler table, the route-loader readers, the party descriptors with their
 * probes. Only server code imports the server half. BO_0202_002
 *
 * The module is the host's, at `src/contract.ts`: a file directly under
 * `src/extensions/` is attributed to an extension of that name by the kernel.
 *
 * Names inside a contribution are bare — `document`, `documents` — and the
 * registry qualifies them with the extension id: the tab kind `documents:document`,
 * the section key `documents:documents`. View ids and party ids are global,
 * because a view is chosen by id across kinds and a party is the kernel's
 * secret-store key; two extensions contributing the same one is a build failure.
 */

/** A tab's target: the kind (qualified by the registry), its identity and its title. */
export interface OpenTarget {
  readonly kind: string;
  readonly itemId: string;
  readonly title: string;
}

/**
 * One row of a library section the shell renders uniformly: identity, label,
 * an optional badge (a front's state, an extension's version), and what
 * activating it opens. A row with no target is named and not opened, the way
 * a standing asset is: no view presents it on its own yet. BO_0202_003
 */
export interface LibraryItem {
  readonly id: string;
  readonly label: string;
  readonly badge?: string;
  /** A glyph the row carries beside its label, with the words it means: a
   * document's derived state, for one. BO_0248_012 */
  readonly glyph?: LibraryGlyph;
  readonly open?: OpenTarget;
  /** Who proposed the item when nobody has taken it yet — a document a run
   * started from a command: `agent` is the runtime (`codex`, `claude-code`,
   * `hermes`, `provider`) or null for a person, `name` the words shown.
   * BO_0251_012 */
  readonly proposedBy?: { readonly agent: string | null; readonly name: string };
  /** The label is the name the item was minted with rather than one a person
   * wrote, so the frame draws it muted wherever it names the item — the row
   * and the tab. The contributing extension decides, because the words are
   * its own; the frame never recognises them. DO_0012_007 */
  readonly unnamed?: boolean;
}

/** What a section contributed as a component receives from the shell. */
export interface SectionProps {
  /** The reader's answer from the page load, re-read by the shell when a tab
   * of the section's kind changes and by the component on its own. */
  readonly data: unknown;
  /** The active tab's item identity, so the section can mark its row. */
  readonly activeItemId: string | null;
  readonly sectionKey: string;
  /**
   * The section's stored filter — a set of values the section reads in its
   * own vocabulary — from the workspace layout, or `null` when nothing was
   * stored; `setFilter$` stores a new set beside the section's collapsed
   * state, so it follows the workspace across reloads and devices. BO_0222_006
   */
  readonly filter: readonly string[] | null;
  readonly setFilter$: QRL<(values: readonly string[]) => Promise<void>>;
}

/**
 * A library section in the left drawer: its header — title, toggle state
 * keyed `<ext>:<name>` in the persisted layout, an optional create control —
 * and a body that is either the item shape (the reader answers
 * `readonly LibraryItem[]`) or a Qwik component the shell mounts. A section
 * declares one: a component present means the component is the body.
 */
export interface LibrarySection {
  readonly name: string;
  readonly title: string;
  /** What the body says while the list is empty. */
  readonly empty: string;
  /** The bare kind the section's rows open, so the shell re-reads the section when a tab of that kind changes. */
  readonly kind?: string;
  /** The qualified kind of another extension the section's rows open — `documents:document`
   * for a section listing documents of its own — so the shell re-reads it when a tab of that
   * kind changes, as it re-reads that kind's own sections. Refused when nothing contributes the
   * kind. One of `kind` and `opens`, never both. BO_0298_014 */
  readonly opens?: string;
  /** The create control's accessible name; absent means no control. */
  readonly createLabel?: string;
  /** Creates one item and answers what to open, or `null` when nothing was made. */
  readonly create$?: QRL<() => Promise<OpenTarget | null>>;
  readonly component?: Component<SectionProps>;
}

/**
 * A view and the component presenting it. `targetKinds` names the bare kinds
 * of the contributing extension this view can present besides the kinds it is
 * the default of; a kind's default view presents that kind without naming it.
 */
export interface ViewContribution {
  readonly id: string;
  readonly name: string;
  readonly targetKinds?: readonly string[];
  /** What the inspector says while this view is active and reports nothing. */
  readonly inspector: string;
  /** The operations a drag of this view's target offers. */
  readonly drag: readonly DragOperation[];
  readonly component: Component<ViewProps>;
}

/**
 * A section of the settings tab an extension contributes: its own settings,
 * drawn below the tab's sections while the extension is active and gone with
 * it. The component reads and writes through the extension's own routes.
 * BO_0264_016
 */
export interface SettingsSection {
  readonly name: string;
  readonly title: string;
  readonly component: Component<Record<string, never>>;
}

/**
 * The one icon an extension's library sections stand under in the library's
 * icon column: its title, named on the button and shown as its tooltip, and
 * a Phosphor name from the shell's icon table. Required of an extension that
 * contributes sections; the registry refuses one without it. CA_0056_008
 */
export interface LibraryIcon {
  readonly title: string;
  readonly name: IconName;
}

export interface ClientContributions {
  readonly sections?: readonly LibrarySection[];
  /** The icon the sections stand under. CA_0056_008 */
  readonly icon?: LibraryIcon;
  /** Sections of the settings tab. BO_0264_016 */
  readonly settingsSections?: readonly SettingsSection[];
  /**
   * Tab kinds by bare name, each carrying the view it opens with and that
   * view's component in one value, so a kind cannot enter the registry without
   * a view and a view cannot enter without a component. BO_0202_004
   */
  readonly kinds?: Readonly<Record<string, ViewContribution>>;
  /**
   * Decorations for a kind another extension presents, by bare kind. The
   * presenting view mounts every contributed provider around its content and
   * draws every contributed place on each block, in extension order; an
   * extension that contributes none decorates nothing, and a view whose
   * decorations are all absent renders undecorated content. BO_0256_007
   */
  readonly decorations?: Readonly<Record<string, Decorations>>;
  /** Further views, for a kind that offers several. */
  readonly views?: readonly ViewContribution[];
}

/**
 * One sender in the agent menu: what it is called, the icon it wears, and
 * whether it can be chosen. `selectable: false` keeps it listed with the reason
 * it cannot run, as an unconfigured runtime is listed. BO_0273_035
 */
/**
 * One axis a sender offers before it is sent to (`BO_0279_007`).
 *
 * What a model makes is not only who makes it: a picture has a shape and a
 * quality, and which values it takes are the model's own. A sender that has
 * none draws as it always did.
 */
export interface SenderAxis {
  /** The service's own name for it, e.g. `aspect-ratio`; sent back unchanged. */
  readonly axis: string;
  /** What the reader sees on the control, e.g. *Ratio*. */
  readonly label: string;
  readonly values: readonly string[];
  /** Where the control starts, or null to start on nothing chosen. */
  readonly start: string | null;
}

export interface SenderDescriptor {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
  readonly selectable: boolean;
  readonly reason: string | null;
  /**
   * What this sender lets a person choose before the press. Absent or empty
   * draws no controls, which is every sender that is not a model.
   * BO_0279_007
   */
  readonly options?: readonly SenderAxis[];
}

/** A command sent to a contributed sender. BO_0273_035 */
export interface SendRequest {
  readonly workspaceId: string;
  readonly sender: string;
  readonly documentId: string;
  /** The block the command was written in, whose words are the command. */
  readonly blockId: string;
  /**
   * What the person chose on the sender's axes, by axis name. An axis absent
   * from here was not chosen, and what that means is the sender's business —
   * for a model it means the vendor's own default. BO_0279_007
   */
  readonly options?: Readonly<Record<string, string>>;
}

/**
 * What a send would cost, asked before the press (`BO_0279_009`).
 *
 * Free: a quote is the generator's own dry run and spends nothing. Answered as
 * words rather than a number, because what a press costs is the vendor's own
 * unit — credits here, something else elsewhere — and the shell only shows it.
 */
export interface SendQuote {
  readonly ok: boolean;
  /** What it would cost, in the vendor's own words, e.g. `11 credits`. */
  readonly cost?: string;
  readonly error?: string;
}

/** What a sender answers: a process to watch, or why it did nothing. */
export interface SendOutcome {
  readonly ok: boolean;
  readonly processId?: string;
  readonly error?: string;
}

export type ApiMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/**
 * One entry of an extension's handler table, served at
 * `/api/x/<ext>/<path>`: `path` is segments with `[name]` for one parameter and
 * `[...rest]` for the remainder, and the handler answers through the event,
 * refusing with `HttpError` the way every route does. BO_0202_006
 */
export interface ApiRoute {
  readonly method: ApiMethod;
  readonly path: string;
  /**
   * A route the kernel calls — a trigger, a context, a tool — answers only a
   * request carrying the kernel's callback secret, and no browser's.
   * BO_0264_002
   */
  readonly kernelCallback?: boolean;
  readonly handle: (
    event: RequestEvent,
    params: Readonly<Record<string, string>>,
  ) => Promise<unknown>;
}

/** One value a party needs beside its secret, in the reader's words. */
export interface ConfigurationField {
  readonly key: string;
  readonly label: string;
  readonly hint: string;
  /** A shape the value is refused against where it is parsed. */
  readonly check?: "address" | "numeric";
}

/**
 * A settings party as a full descriptor: its id (the kernel secret store's
 * key), its kind — a service Calliopa needs to run, or a channel the author's
 * work goes to — how its credential works, its label and purpose, the fields
 * it holds beside its key, and the probe the kernel runs to prove it.
 * BO_0202_008
 */
export interface PartyDescriptor {
  readonly id: string;
  readonly kind: "service" | "channel";
  /**
   * An `apiKey` party takes a secret; a `status` party holds only what
   * something else reports; an `oauth` party signs in by its provider's
   * device flow and the kernel keeps and renews its token (BO_0252).
   */
  readonly credential: "apiKey" | "status" | "oauth";
  readonly label: string;
  readonly purpose: string;
  readonly fields: readonly ConfigurationField[];
  readonly probe?: {
    readonly authorization: PartyAuthorization;
    readonly test: PartyTest;
  };
  /** An oauth party's authorization server: where the device flow starts, where tokens are minted, the scopes asked. BO_0252_006 */
  readonly provider?: {
    readonly deviceAuthorizationUrl: string;
    readonly tokenUrl: string;
    readonly scopes: readonly string[];
  };
  /** The path prefixes on the address's host a brokered request may use; absent means the address's own path. BO_0252_006 */
  readonly paths?: readonly string[];
  /**
   * Configuration the kind fixes rather than the reader types — a platform's
   * API address — written with the record and never a field of the row; the
   * row's check ignores these keys. BO_0252_006
   */
  readonly fixed?: Readonly<Record<string, string>>;
}

/**
 * What a citation resolver is asked (`BO_0291_030`): a document's citations
 * in reading order, the cited works in the order the document's read numbers
 * them — so a numeric style numbers as the read does — and the document's own
 * style when it names one.
 */
export interface CitationRequest {
  readonly documentId: string;
  readonly style?: string;
  readonly order: readonly string[];
  readonly cited: readonly { readonly work: string; readonly locator?: string }[];
}

/** What it answers: each citation's in-text label, keyed by `citationKey` of `~/lib/runs`. */
export interface CitationAnswer {
  readonly labels: Readonly<Record<string, string>>;
  /** The style the labels are in, the instance's default, and the styles a
   * document may choose by id and name, so the document's control lists them
   * without knowing them itself. BO_0291_037 */
  readonly styles?: CitationStyles;
}

export interface CitationStyles {
  readonly applied: string;
  readonly instanceDefault: string;
  readonly offered: readonly { readonly id: string; readonly name: string }[];
}

export interface ServerContributions {
  /**
   * The route-loader readers by section name. An item section's reader answers
   * `readonly LibraryItem[]` with bare kinds in its targets; a component
   * section's reader answers whatever its component takes. A reader that
   * throws renders its section empty. BO_0202_005
   */
  readonly readers?: Readonly<Record<string, () => Promise<unknown>>>;
  readonly routes?: readonly ApiRoute[];
  /**
   * How a document's citations read in its style (`BO_0291_030`): asked by
   * `documents`' read, so the labels arrive with the document and nothing
   * re-flows. At most one extension answers; with none, a citation is drawn
   * as its number.
   */
  readonly citations?: (request: CitationRequest) => Promise<CitationAnswer>;
  readonly parties?: readonly PartyDescriptor[];
  /**
   * A party roster read at runtime, for parties that are data rather than
   * source — a channel the publishing extension holds as a node. Answered on
   * every listing beside the static descriptors; its ids are namespaced by
   * the contributing extension (`<ext>-…`) and one outside its namespace, or
   * one a static descriptor already holds, is dropped from the merge rather
   * than shadowing anything. A roster that throws contributes nothing for
   * that read. CA_0049_001
   */
  readonly partyRoster?: () => Promise<readonly PartyDescriptor[]>;
  /**
   * Senders this extension offers beside the agents (`BO_0273_035`).
   *
   * A sender stands in the agent menu and a command is sent to it the way a
   * command is sent to an agent: the press on *Send* is the whole gesture, and
   * what the sender does with the block is its own business. The media
   * extension offers one per model it can make a picture with.
   *
   * A roster read at runtime, like `partyRoster`, because which senders exist
   * depends on what is signed in and what the owner offers. Ids are namespaced
   * by the contributing extension; one outside its namespace is dropped rather
   * than shadowing an agent. A roster that throws contributes none.
   */
  readonly senders?: () => Promise<readonly SenderDescriptor[]>;
  /**
   * What a command sent to one of this extension's senders would cost, asked
   * as the reader changes what they chose and never as part of a press. It
   * spends nothing; an extension that cannot say answers `ok: false` and the
   * shell shows nothing rather than a guess. BO_0279_009
   */
  readonly quote?: (request: SendRequest) => Promise<SendQuote>;
  /**
   * What happens when a command is sent to one of this extension's senders.
   * The frame hands over the sender, the block and the workspace, and the
   * extension answers a process to watch — as an agent run answers one — or a
   * refusal in words. It is reached only for a sender this extension
   * contributed. `BO_0273_035`
   */
  readonly send?: (request: SendRequest) => Promise<SendOutcome>;
  /**
   * What a run staged into this extension's content, for the run detail the
   * frame shows. The frame knows a run has a proposal group; what a group
   * touched means is the extension's, so the process surface asks each
   * extension rather than reading another's model. Answered for one group,
   * in extension order, with bare kinds the registry qualifies; an extension
   * that throws or contributes none adds nothing to the list. BO_0255_007
   */
  readonly proposedTargets?: (group: string) => Promise<readonly ProposedTarget[]>;
  /**
   * The glyph each item of a kind carries in the library, for an extension
   * that has something to say about another's items — a document under
   * pressure, one needing review. The extension listing the kind asks rather
   * than reading another's model, and an extension answering none leaves the
   * rows unmarked. BO_0256_008
   */
  readonly itemGlyphs?: (kind: string) => Promise<Readonly<Record<string, LibraryGlyph>>>;
  /**
   * How a child of each of this extension's target kinds is made and read,
   * keyed by the bare kind the registry qualifies. Focused work is the
   * shell's capability and the vocabulary is the extension's, so the shell
   * asks rather than writing `document`, `text` and `contains` itself; a kind
   * contributing none opens no focused work. CA_0065_001
   */
  readonly focusedWork?: Readonly<Record<string, FocusedWorkContribution>>;
}

/** One thing a run proposed into, as the run detail lists it: what to open,
 * what to call it, and how many items are still unanswered — the only number
 * a reader can act on. BO_0255_007 */
export interface ProposedTarget {
  readonly itemId: string;
  /** The bare kind, which the registry qualifies with the extension. */
  readonly kind: string;
  readonly title: string;
  readonly unanswered: number;
}

/**
 * The child a block would open as, as the extension owning the target kind
 * plans it: the statements the shell commits inside its own script, so the
 * child and the `focuses` edge that makes it focused work are one write.
 * Nothing here is committed by the extension. CA_0065_001
 */
export interface ChildPlan {
  /** The child's identity, which the shell relates the block to. */
  readonly itemId: string;
  readonly title: string;
  /** The statements creating the child, folded into the shell's script. */
  readonly statements: readonly string[];
  /** The parameters those statements read, merged into the shell's own. */
  readonly parameters: Readonly<Record<string, unknown>>;
}

/**
 * The face a child wears on the block it focuses: what to call it, and the
 * words it currently says for itself when it says any. What that line looks
 * like is the view's; what it says is the extension's. CA_0065_005
 */
export interface ChildFace {
  readonly itemId: string;
  readonly title: string;
  readonly face: readonly Run[] | null;
}

/**
 * How a child of one target kind is made and read, so the shell can open any
 * block as focused work without writing a vocabulary it does not own.
 *
 * Focused work is the frame's capability — it retargets a tab, pushes a route
 * and lands on a block — but `document`, `text` and `contains` are the
 * `documents` extension's and only `focuses` is the shell's declaration. So
 * the extension that contributes a target kind says what a child of it is,
 * which of its blocks may be opened, what the child is called and what it
 * says for itself; the shell asks. A kind that contributes none opens no
 * focused work and the shell's control is not drawn for it. User decision,
 * 2026-09-23 (`CA_0065_001`).
 */
export interface FocusedWorkContribution {
  /** The node type a child is, which the shell reads the `focuses` edge to. */
  readonly childType: string;
  /** The child a block would open as, or the refusal in words. */
  readonly plan: (input: {
    readonly targetId: string;
    readonly blockId: string;
  }) => Promise<GraphOutcome<ChildPlan>>;
  /** What each of these children says for itself, for the parents' faces. */
  readonly faces: (itemIds: readonly string[]) => Promise<GraphOutcome<readonly ChildFace[]>>;
  /** The blocks a target holds, in reading order. Which blocks a target has
   * is the extension's knowledge, so the shell asks for them rather than
   * reading a containment vocabulary it does not own. CA_0065_003 */
  readonly blocksOf: (targetId: string) => Promise<GraphOutcome<readonly string[]>>;
}

/**
 * Where on a block a contributed decoration draws (`BO_0256_007`).
 *
 * A view that presents content someone else may have something to say about
 * renders these places and knows nothing of what fills them: the headline of
 * a block, the depth that unfolds beneath it, and the space below it. The
 * decision surfaces — a block's kind, its claims and relations, the pressure
 * on it, a root's phase and the cards that move it — reach a document this
 * way, so the extension that owns the document model ships none of them.
 */
/** A mark a row carries beside its label, with the words it means. */
export interface LibraryGlyph {
  readonly icon: string;
  readonly label: string;
}

/**
 * Where a contributed decoration is drawn on a block. `headline`, `depth` and
 * `below` stand on a block as it is read; `command` stands in the command chip
 * of the block being edited, between *Attach files* and the chips of what the
 * command carries, so an extension may offer a control there without the chip
 * knowing what it is (BO_0273_007); `run` stands beneath a code block's
 * source, where the extension that runs code draws its send (BO_0289_019).
 */
export type BlockPlace = "headline" | "depth" | "below" | "command" | "run";

/** What a decoration is handed: the block it decorates, and whether the
 * reader is editing it. Everything else it reads for itself — the document
 * through the owning extension's public API, its own content through its
 * own — so the presenting view carries no decision state. */
export interface BlockDecorationProps {
  readonly documentId: string;
  readonly blockId: string;
  readonly revisionId: string;
  readonly active: boolean;
}

/** What a provider is handed: the document its decorations draw on. */
export interface DocumentDecorationProps {
  readonly documentId: string;
}

/**
 * Where a contributed decoration is drawn once on a document rather than on
 * each block (`BO_0291_031`): `end`, after the last block — where the
 * bibliography draws a document's reference list. The presenting view draws
 * the place and knows nothing of what fills it.
 */
export type DocumentPlace = "end";

/** What a document place is handed: the document, and the data revision it
 * was read at, so a place that reads for itself reads again when the
 * document changes. */
export interface DocumentPlaceProps {
  readonly documentId: string;
  readonly dataRevision?: number | undefined;
}

/**
 * One extension's decorations for one bare kind. The provider is mounted once
 * around the presented content, so a decoration set reads a document once and
 * shares it through its own context rather than fetching per block; the places
 * are drawn on every block. Both are ordinary components the build resolves,
 * like a section's. Several extensions may provide for one kind: the
 * presenting view nests their providers in extension order (BO_0289_019).
 */
export interface Decorations {
  readonly provider?: Component<DocumentDecorationProps>;
  readonly places: Readonly<Partial<Record<BlockPlace, Component<BlockDecorationProps>>>>;
  /** Places drawn once on the document, merged in extension order as the
   * block places are. BO_0291_031 */
  readonly documentPlaces?: Readonly<Partial<Record<DocumentPlace, Component<DocumentPlaceProps>>>>;
}

/** Typing helpers, so an entrypoint's export is checked against the contract. */
export const contributions = (value: ClientContributions): ClientContributions => value;
export const serverContributions = (value: ServerContributions): ServerContributions => value;
