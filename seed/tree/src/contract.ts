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
  /** Give this section its own library icon; otherwise it uses the extension icon. */
  readonly icon?: LibraryIcon;
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
  /** Drawn for the owner alone, heading and all: what it keeps is the
   * owner's (`calliopa-bootstrap`'s `BO_0311_040`). */
  readonly owner?: boolean;
}

/**
 * An icon library sections stand under in the library's icon column: its
 * title, named on the button and shown as its tooltip, and a Phosphor name
 * from the shell's icon table. An extension provides a default icon and a
 * section may override it to get a standalone entry. CA_0056_008 CA_0070_004
 */
export interface LibraryIcon {
  readonly title: string;
  readonly name: IconName;
}

export interface ClientContributions {
  readonly sections?: readonly LibrarySection[];
  /** The default icon for sections without their own icon. CA_0056_008 */
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
 * Focused work is the frame's capability — it opens the child's tab, gives it
 * a route and lands on a block — but `document`, `text` and `contains` are the
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
 * a block and the space below it.
 */
/** A mark a row carries beside its label, with the words it means. */
export interface LibraryGlyph {
  readonly icon: string;
  readonly label: string;
}

/**
 * Where a contributed decoration is drawn on a block. `headline` and `below`
 * stand on a block as it is read; `command` stands in the command chip
 * of the block being edited, between *Attach files* and the chips of what the
 * command carries, so an extension may offer a control there without the chip
 * knowing what it is (BO_0273_007); `underCommand` stands in a chip of its own
 * in the command chip's row — at its right, or on the next row when the row
 * has no room for both — wherever the command chip is drawn — the
 * block being edited and the prompt pointed from — and the chip is drawn only
 * when some extension contributes it (RO_0002_001); `run` stands beneath a
 * code block's source, where the extension that runs code draws its send
 * (BO_0289_019).
 */
export type BlockPlace = "headline" | "below" | "command" | "underCommand" | "run";

/** What a decoration is handed: the block it decorates, and whether the
 * reader is editing it. Everything else it reads for itself — the document
 * through the owning extension's public API, its own content through its
 * own — so the presenting view carries no decision state. */
export interface BlockDecorationProps {
  readonly documentId: string;
  readonly blockId: string;
  readonly revisionId: string;
  readonly active: boolean;
  /**
   * In the `command` place alone: sets one option on the command the place
   * is drawn in, or clears it with `null`. The shell keeps the options with
   * the command and sends them with it when *Send* is pressed; an option no
   * one set is not sent, and remembering one across commands is the
   * contributing extension's. `profile` is the first the kernel reads
   * (`calliopa-bootstrap`'s `BO_0311_002`). BO_0311_030
   */
  readonly setOption$?: QRL<(name: string, value: string | null) => void>;
}

/** What a provider is handed: the document its decorations draw on. */
export interface DocumentDecorationProps {
  readonly documentId: string;
}

/**
 * Where a contributed decoration is drawn once on a document rather than on
 * each block (`BO_0291_031`): `end`, after the last block — where the
 * bibliography draws a document's reference list; and `title`, the document
 * header's lines under the title, drawn while reading and editing alike and
 * carrying nothing of a command's own — where the roles extension shows and
 * takes the document's roles and their values (`calliopa-bootstrap`'s
 * `BO_0309_030`) and the keywords extension where a keyword is mentioned.
 * Each contribution to `title` is a row of its own, in extension order, and
 * is drawn again in the one-line header that stays under the bar once the
 * header has scrolled away (`documents`' `DO_0030_001`). The presenting view
 * draws the place and knows nothing of what fills it.
 */
export type DocumentPlace = "end" | "title";

/** What a document place is handed: the document, and the data revision it
 * was read at, so a place that reads for itself reads again when the
 * document changes. */
export interface DocumentPlaceProps {
  readonly documentId: string;
  readonly dataRevision?: number | undefined;
  /** Where a `title` contribution is drawn: `full` in the document's header,
   * `compact` in the one line that stays under the bar once the header has
   * scrolled away, where it draws only what that line holds, or nothing.
   * Absent is `full`; `end` is always drawn full. DO_0030_001 */
  readonly form?: DocumentPlaceForm | undefined;
}

/** The two forms a `title` contribution is drawn in. DO_0030_001 */
export type DocumentPlaceForm = "full" | "compact";

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
