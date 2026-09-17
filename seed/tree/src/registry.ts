import type { Component } from "@builder.io/qwik";
import type { DragOperation } from "~/lib/drag";
import type { ViewProps } from "~/components/shell/view-host";
import type {
  ApiRoute,
  ClientContributions,
  LibrarySection,
  Decorations,
  PartyDescriptor,
  ProposedTarget,
  ServerContributions,
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
}

/** One extension's decorations for a kind, in contribution order. BO_0256_007 */
export interface RegisteredDecorations {
  readonly extension: string;
  readonly decorations: Decorations;
}

export interface Registry {
  readonly extensions: readonly string[];
  readonly sections: readonly RegisteredSection[];
  /** Every qualified tab kind and the id of the view it opens with. */
  readonly kinds: Readonly<Record<string, string>>;
  readonly views: readonly ViewType[];
  /** Decorations by qualified kind, in extension order. BO_0256_007 */
  readonly decorations: Readonly<Record<string, readonly RegisteredDecorations[]>>;
}

export function buildRegistry(
  host: ClientContributions,
  entries: readonly Entry<ClientContributions>[],
): Registry {
  const sections: RegisteredSection[] = [];
  const kinds: Record<string, string> = {};
  const decorations: Record<string, RegisteredDecorations[]> = {};
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
    for (const section of contributions.sections ?? []) {
      const key = qualify(id, section.name);
      const taken = sections.find((candidate) => candidate.key === key);
      if (taken !== undefined) {
        throw new RegistryError("section_collision", `section ${key} is contributed twice`);
      }
      sections.push({
        ...section,
        key,
        extension: id,
        ...(section.kind === undefined ? {} : { opens: qualify(id, section.kind) }),
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
      if (set.provider !== undefined) {
        const provided = (decorations[known] ?? []).find(
          (candidate) => candidate.decorations.provider !== undefined,
        );
        if (provided !== undefined) {
          throw new RegistryError(
            "decoration_provider_collision",
            `${provided.extension} and ${id} both provide for ${known}; a kind takes one provider, and the presenting view wraps it once`,
          );
        }
      }
      (decorations[known] ??= []).push({ extension: id, decorations: set });
    }
  }
  const registry: Registry = {
    extensions: entries.map((entry) => entry.id),
    sections,
    kinds,
    views: [...views.values()].map((entry) => entry.view),
    decorations,
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

export interface ServerRegistry {
  readonly extensions: readonly string[];
  /** Readers by section key, `<ext>:<name>`. */
  readonly readers: Readonly<Record<string, () => Promise<unknown>>>;
  /** Handler tables by extension id. */
  readonly routes: Readonly<Record<string, readonly ApiRoute[]>>;
  readonly parties: readonly RegisteredParty[];
  /** The rosters read at runtime, in extension order. */
  readonly rosters: readonly RegisteredRoster[];
  /** What each extension says a run proposed into it, in extension order. */
  readonly proposedTargets: readonly RegisteredProposedTargets[];
  /** What each extension says the items of a kind are marked with. BO_0256_008 */
  readonly itemGlyphs: readonly NonNullable<ServerContributions["itemGlyphs"]>[];
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
  const proposedTargets: RegisteredProposedTargets[] = [];
  const itemGlyphs: NonNullable<ServerContributions["itemGlyphs"]>[] = [];
  for (const { id, contributions } of entries) {
    if (contributions.partyRoster !== undefined) {
      rosters.push({ extension: id, roster: contributions.partyRoster });
    }
    if (contributions.itemGlyphs !== undefined) {
      itemGlyphs.push(contributions.itemGlyphs);
    }
    if (contributions.proposedTargets !== undefined) {
      proposedTargets.push({ extension: id, read: contributions.proposedTargets });
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
    proposedTargets,
    itemGlyphs,
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
