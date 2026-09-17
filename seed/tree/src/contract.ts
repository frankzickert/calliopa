import type { Component, QRL } from "@builder.io/qwik";
import type { RequestEvent } from "@builder.io/qwik-city";
import type { DragOperation } from "~/lib/drag";
import type { ViewProps } from "~/components/shell/view-host";
import type { PartyAuthorization, PartyTest } from "~/server/kernel/client";

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

export interface ClientContributions {
  readonly sections?: readonly LibrarySection[];
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

export interface ServerContributions {
  /**
   * The route-loader readers by section name. An item section's reader answers
   * `readonly LibraryItem[]` with bare kinds in its targets; a component
   * section's reader answers whatever its component takes. A reader that
   * throws renders its section empty. BO_0202_005
   */
  readonly readers?: Readonly<Record<string, () => Promise<unknown>>>;
  readonly routes?: readonly ApiRoute[];
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

export type BlockPlace = "headline" | "depth" | "below";

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
 * One extension's decorations for one bare kind. The provider is mounted once
 * around the presented content, so a decoration set reads a document once and
 * shares it through its own context rather than fetching per block; the places
 * are drawn on every block. Both are ordinary components the build resolves,
 * like a section's.
 */
export interface Decorations {
  readonly provider?: Component<DocumentDecorationProps>;
  readonly places: Readonly<Partial<Record<BlockPlace, Component<BlockDecorationProps>>>>;
}

/** Typing helpers, so an entrypoint's export is checked against the contract. */
export const contributions = (value: ClientContributions): ClientContributions => value;
export const serverContributions = (value: ServerContributions): ServerContributions => value;
