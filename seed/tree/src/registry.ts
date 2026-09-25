import type { Component } from "@builder.io/qwik";
import { isIconName } from "~/components/shell/icons";
import type { DragOperation } from "~/lib/drag";
import type { ViewProps } from "~/components/shell/view-host";
import type {
  ApiRoute,
  ClientContributions,
  LibraryIcon,
  LibrarySection,
  Decorations,
  FocusedWorkContribution,
  PartyDescriptor,
  ProposedTarget,
  ServerContributions,
  SettingsSection,
  ViewContribution,
} from "~/contract";

/**
 * The merge behind the generated registries. `src/registry.gen.ts` hands
 * `buildRegistry` the host's own contributions and every present extension's
 * client half; `src/registry.server.gen.ts` hands `buildServerRegistry` every
 * server half. Both qualify bare names with the extension id and refuse a
 * collision with a named error, so the totality the typechecker gave
 * `DEFAULT_VIEWS` and `VIEW_COMPONENTS` is enforced here once the keys are
 * strings. The merge runs where the module is evaluated — the server at
 * startup, the unit project, the promotion gate's serve probe — and never
 * reads the tree. BO_0202_001 BO_0202_004
 */

export class RegistryError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RegistryError";
  }
}

/** The frame's own contributions are not an extension's: their names stay bare. */
export const HOST = "host";

export function qualify(extension: string, name: string): string {
  return extension === HOST ? name : `${extension}:${name}`;
}

/** The extension a qualified kind belongs to, or the host for a bare one. */
export function extensionOf(kind: string): string {
  const index = kind.indexOf(":");
  return index < 0 ? HOST : kind.slice(0, index);
}

export interface Entry<T> {
  readonly id: string;
  readonly contributions: T;
}

export interface ViewType {
  readonly id: string;
  readonly name: string;
  /** The qualified target kinds this view can present. */
  readonly targetKinds: readonly string[];
  readonly inspector: string;
  readonly drag: readonly DragOperation[];
  readonly component: Component<ViewProps>;
  readonly extension: string;
}

export interface RegisteredSection extends LibrarySection {
  /** `<ext>:<name>`, the layout's key for the section's state. */
  readonly key: string;
  readonly extension: string;
  /** The qualified kind the section's rows open, when it declared one. */
  readonly opens?: string;
  /** Whether `opens` names another extension's kind, which the build checks exists. BO_0298_014 */
  readonly opensOther?: boolean;
}

/**
 * One icon of the library's icon column: an extension's icon and the keys of
 * its sections under it, in contribution order. CA_0056_001 CA_0056_008
 */
export interface RegisteredLibraryIcon extends LibraryIcon {
  /** The extension id, which is the icon's id in the stored layout. */
  readonly id: string;
  readonly sections: readonly string[];
}

/** A settings section as registered, keyed `<ext>:<name>`. BO_0264_016 */
export interface RegisteredSettingsSection extends SettingsSection {
  readonly key: string;
  readonly extension: string;
}

/** One extension's decorations for a kind, in contribution order. BO_0256_007 */
export interface RegisteredDecorations {
  readonly extension: string;
  readonly decorations: Decorations;
}

export interface Registry {
  readonly extensions: readonly string[];
  readonly sections: readonly RegisteredSection[];
  /** The library's icon column, one icon per extension with sections, in
   * contribution order. CA_0056_001 */
  readonly libraryIcons: readonly RegisteredLibraryIcon[];
  /** Every qualified tab kind and the id of the view it opens with. */
  readonly kinds: Readonly<Record<string, string>>;
  readonly views: readonly ViewType[];
  /** Decorations by qualified kind, in extension order. BO_0256_007 */
  readonly decorations: Readonly<Record<string, readonly RegisteredDecorations[]>>;
  /** Settings sections, in extension order. BO_0264_016 */
  readonly settingsSections: readonly RegisteredSettingsSection[];
}

export function buildRegistry(
  host: ClientContributions,
  entries: readonly Entry<ClientContributions>[],
): Registry {
  const sections: RegisteredSection[] = [];
  const libraryIcons: RegisteredLibraryIcon[] = [];
  const kinds: Record<string, string> = {};
  const decorations: Record<string, RegisteredDecorations[]> = {};
  const settingsSections: RegisteredSettingsSection[] = [];
  const views = new Map<string, { view: ViewType; source: ViewContribution }>();

  const addView = (extension: string, source: ViewContribution, presents: readonly string[]) => {
    const existing = views.get(source.id);
    if (existing !== undefined && existing.source !== source) {
      throw new RegistryError(
        "view_collision",
        `view ${source.id} is contributed by ${existing.view.extension} and ${extension}`,
      );
    }
    const declared = (source.targetKinds ?? []).map((kind) => qualify(extension, kind));
    const targetKinds = existing === undefined ? [...declared] : [...existing.view.targetKinds];
    for (const kind of presents) if (!targetKinds.includes(kind)) targetKinds.push(kind);
    views.set(source.id, {
      source,
      view: {
        id: source.id,
        name: source.name,
        targetKinds,
        inspector: source.inspector,
        drag: source.drag,
        component: source.component,
        extension,
      },
    });
  };

  for (const { id, contributions } of [{ id: HOST, contributions: host }, ...entries]) {
    // An extension's sections stand under its one icon, so the column never
    // shows a blank button: sections without an icon, or an icon the table
    // does not hold, are refused by name. CA_0056_008
    const contributed = contributions.sections ?? [];
    if (contributed.length > 0) {
      const icon = contributions.icon;
      if (icon === undefined) {
        throw new RegistryError(
          "section_icon_missing",
          `${id} contributes sections without the icon they stand under in the library`,
        );
      }
      if (!isIconName(icon.name)) {
        throw new RegistryError(
          "icon_unknown",
          `${id}'s library icon ${icon.name} is not in the shell's icon table`,
        );
      }
      libraryIcons.push({
        id,
        title: icon.title,
        name: icon.name,
        sections: contributed.map((section) => qualify(id, section.name)),
      });
    }
    for (const section of contributed) {
      const key = qualify(id, section.name);
      const taken = sections.find((candidate) => candidate.key === key);
      if (taken !== undefined) {
        throw new RegistryError("section_collision", `section ${key} is contributed twice`);
      }
      if (section.kind !== undefined && section.opens !== undefined) {
        throw new RegistryError("section_opens", `section ${key} names both a kind of its own and one it opens`);
      }
      sections.push({
        ...section,
        key,
        extension: id,
        ...(section.opens !== undefined ? { opens: section.opens, opensOther: true } : section.kind === undefined ? {} : { opens: qualify(id, section.kind) }),
      });
    }
    for (const [name, view] of Object.entries(contributions.kinds ?? {})) {
      const kind = qualify(id, name);
      if (kinds[kind] !== undefined) {
        throw new RegistryError("kind_collision", `tab kind ${kind} is contributed twice`);
      }
      kinds[kind] = view.id;
      addView(id, view, [kind]);
    }
    for (const view of contributions.views ?? []) addView(id, view, []);
    for (const section of contributions.settingsSections ?? []) {
      const key = qualify(id, section.name);
      if (settingsSections.some((candidate) => candidate.key === key)) {
        throw new RegistryError("settings_section_collision", `settings section ${key} is contributed twice`);
      }
      settingsSections.push({ ...section, key, extension: id });
    }
  }

  // Decorations are keyed by the *qualified* kind they draw on, so an
  // extension decorates another's kind by naming it bare, the way it
  // contributes a section for one. A kind nothing contributes is refused,
  // because a decoration nothing would ever draw is a stale contribution.
  // BO_0256_007
  for (const { id, contributions } of entries) {
    for (const [kind, set] of Object.entries(contributions.decorations ?? {})) {
      const qualified = kinds[qualify(id, kind)] !== undefined ? qualify(id, kind) : kind;
      const known = Object.keys(kinds).find(
        (candidate) => candidate === qualified || candidate.endsWith(`:${kind}`),
      );
      if (known === undefined) {
        throw new RegistryError(
          "decoration_kind_unknown",
          `${id} decorates ${kind}, which no extension contributes`,
        );
      }
      // A second provider for a kind is nested inside the first by the
      // presenting view, in extension order (BO_0289_019); the refusal that
      // stood here was the change that made it a nest.
      (decorations[known] ??= []).push({ extension: id, decorations: set });
    }
  }
  const registry: Registry = {
    extensions: entries.map((entry) => entry.id),
    sections,
    libraryIcons,
    kinds,
    views: [...views.values()].map((entry) => entry.view),
    decorations,
    settingsSections,
  };
  // A view contributed for a kind nothing declares would never be reached;
  // saying so is what keeps a stale contribution from surviving unnoticed.
  for (const view of registry.views) {
    const unknown = view.targetKinds.find((kind) => kinds[kind] === undefined);
    if (unknown !== undefined) {
      throw new RegistryError(
        "target_kind_unknown",
        `view ${view.id} presents ${unknown}, which no extension contributes`,
      );
    }
  }
  // A section opening another extension's kind names one that exists, for
  // the same reason; a bare `kind` of the section's own is left as it always
  // was, since a section's kind never fenced anything. BO_0298_014
  for (const section of sections) {
    if (section.opensOther && kinds[section.opens ?? ""] === undefined) {
      throw new RegistryError("target_kind_unknown", `section ${section.key} opens ${section.opens}, which no extension contributes`);
    }
  }
  return registry;
}

export interface RegisteredParty extends PartyDescriptor {
  readonly extension: string;
}

/** A runtime party roster and the extension that answers it. CA_0049_001 */
export interface RegisteredRoster {
  readonly extension: string;
  readonly roster: () => Promise<readonly PartyDescriptor[]>;
}

/** What one extension says a run proposed into it. BO_0255_007 */
export interface RegisteredProposedTargets {
  readonly extension: string;
  readonly read: (group: string) => Promise<readonly ProposedTarget[]>;
}

/** One extension's senders and what a command sent to one of them does. */
export interface RegisteredSenders {
  readonly extension: string;
  readonly roster: NonNullable<ServerContributions["senders"]>;
  readonly send: NonNullable<ServerContributions["send"]>;
  /** What a send would cost, when this extension can say. BO_0279_009 */
  readonly quote?: NonNullable<ServerContributions["quote"]>;
}

export interface ServerRegistry {
  readonly extensions: readonly string[];
  /** Readers by section key, `<ext>:<name>`. */
  readonly readers: Readonly<Record<string, () => Promise<unknown>>>;
  /** Handler tables by extension id. */
  readonly routes: Readonly<Record<string, readonly ApiRoute[]>>;
  readonly parties: readonly RegisteredParty[];
  /** The rosters read at runtime, in extension order. */
  readonly rosters: readonly RegisteredRoster[];
  /** Senders beside the agents, by extension, in contribution order. BO_0273_035 */
  readonly senders: readonly RegisteredSenders[];
  /** What each extension says a run proposed into it, in extension order. */
  readonly proposedTargets: readonly RegisteredProposedTargets[];
  /** What each extension says the items of a kind are marked with. BO_0256_008 */
  readonly itemGlyphs: readonly NonNullable<ServerContributions["itemGlyphs"]>[];
  /** How a child of a target kind is made and read, by qualified kind. The
   * shell opens any block as focused work through these and writes no
   * extension's vocabulary itself. CA_0065_001 */
  readonly focusedWork: Readonly<Record<string, FocusedWorkContribution>>;
  /** The one citation resolver, with the extension that answers. BO_0291_030 */
  readonly citations?: { readonly extension: string; readonly resolve: NonNullable<ServerContributions["citations"]> };
}

/**
 * Lays one roster's answer over the parties already held: an id must start
 * with the roster's extension followed by a hyphen, and must not be held
 * already, or it is dropped — a roster can add rows, never shadow one.
 * Pure, so the rule is proven over fixture rosters. CA_0049_001
 */
export function mergeRoster(
  held: readonly RegisteredParty[],
  extension: string,
  answered: readonly PartyDescriptor[],
): RegisteredParty[] {
  const merged = [...held];
  for (const party of answered) {
    if (!party.id.startsWith(`${extension}-`)) continue;
    if (merged.some((candidate) => candidate.id === party.id)) continue;
    merged.push({ ...party, extension });
  }
  return merged;
}

export function buildServerRegistry(
  entries: readonly Entry<ServerContributions>[],
): ServerRegistry {
  const readers: Record<string, () => Promise<unknown>> = {};
  const routes: Record<string, readonly ApiRoute[]> = {};
  const parties: RegisteredParty[] = [];
  const rosters: RegisteredRoster[] = [];
  const senders: RegisteredSenders[] = [];
  const proposedTargets: RegisteredProposedTargets[] = [];
  const itemGlyphs: NonNullable<ServerContributions["itemGlyphs"]>[] = [];
  const focusedWork: Record<string, FocusedWorkContribution> = {};
  let citations: ServerRegistry["citations"];
  for (const { id, contributions } of entries) {
    if (contributions.citations !== undefined) {
      // One answer to how a citation reads: a second would make the same
      // document read two ways. BO_0291_030
      if (citations !== undefined) {
        throw new RegistryError("citation_resolver_collision", `${id} resolves citations, which ${citations.extension} already does`);
      }
      citations = { extension: id, resolve: contributions.citations };
    }
    if (contributions.partyRoster !== undefined) {
      rosters.push({ extension: id, roster: contributions.partyRoster });
    }
    if (contributions.senders !== undefined) {
      // Both halves or neither: a sender nothing answers for would stand in
      // the menu and refuse every send.
      if (contributions.send === undefined) {
        throw new RegistryError("sender_unanswered", `${id} offers senders and answers no send`);
      }
      senders.push({
        extension: id,
        roster: contributions.senders,
        send: contributions.send,
        // Optional: a sender that cannot say what it would cost is still a
        // sender. BO_0279_009
        ...(contributions.quote === undefined ? {} : { quote: contributions.quote }),
      });
    }
    if (contributions.itemGlyphs !== undefined) {
      itemGlyphs.push(contributions.itemGlyphs);
    }
    if (contributions.proposedTargets !== undefined) {
      proposedTargets.push({ extension: id, read: contributions.proposedTargets });
    }
    // Keyed by the qualified kind, as a tab's kind is, so the shell reaches
    // the contribution from the target it already holds. CA_0065_001
    for (const [kind, contribution] of Object.entries(contributions.focusedWork ?? {})) {
      focusedWork[qualify(id, kind)] = contribution;
    }
    for (const [name, reader] of Object.entries(contributions.readers ?? {})) {
      readers[qualify(id, name)] = reader;
    }
    const table = contributions.routes ?? [];
    for (const [index, route] of table.entries()) {
      const twin = table.slice(0, index).find(
        (candidate) => candidate.method === route.method && candidate.path === route.path,
      );
      if (twin !== undefined) {
        throw new RegistryError(
          "route_collision",
          `${id} contributes ${route.method} ${route.path} twice`,
        );
      }
      for (const segment of route.path.split("/")) {
        if (/^\[\.\.\..+\]$/u.test(segment) && segment !== route.path.split("/").at(-1)) {
          throw new RegistryError(
            "route_shape",
            `${id} contributes ${route.path}, whose rest segment is not last`,
          );
        }
      }
    }
    routes[id] = table;
    for (const party of contributions.parties ?? []) {
      const taken = parties.find((candidate) => candidate.id === party.id);
      if (taken !== undefined) {
        throw new RegistryError(
          "party_collision",
          `party ${party.id} is contributed by ${taken.extension} and ${id}`,
        );
      }
      parties.push({ ...party, extension: id });
    }
  }
  return {
    extensions: entries.map((entry) => entry.id),
    readers,
    routes,
    parties,
    rosters,
    senders,
    proposedTargets,
    itemGlyphs,
    focusedWork,
    ...(citations === undefined ? {} : { citations }),
  };
}

/**
 * Matches a request path against a handler table. A `[name]` segment takes one
 * segment, a `[...rest]` segment takes the remainder; the first entry that
 * matches wins, in the order the extension listed them.
 */
export function matchRoute(
  table: readonly ApiRoute[],
  method: string,
  path: string,
): { readonly route: ApiRoute; readonly params: Readonly<Record<string, string>> } | null {
  const given = path.split("/").filter((segment) => segment !== "");
  for (const route of table) {
    if (route.method !== method) continue;
    const params = matchSegments(route.path.split("/").filter((s) => s !== ""), given);
    if (params !== null) return { route, params };
  }
  return null;
}

function matchSegments(
  pattern: readonly string[],
  given: readonly string[],
): Record<string, string> | null {
  const params: Record<string, string> = {};
  for (let index = 0; index < pattern.length; index += 1) {
    const segment = pattern[index] ?? "";
    const rest = /^\[\.\.\.(.+)\]$/u.exec(segment);
    if (rest !== null) {
      params[rest[1] ?? "rest"] = given.slice(index).join("/");
      return params;
    }
    const value = given[index];
    if (value === undefined) return null;
    const named = /^\[(.+)\]$/u.exec(segment);
    if (named !== null) {
      params[named[1] ?? ""] = decodeURIComponent(value);
    } else if (segment !== value) {
      return null;
    }
  }
  return pattern.length === given.length ? params : null;
}
