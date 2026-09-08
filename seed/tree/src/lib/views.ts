import type { Registry, ViewType } from "~/registry";
import type { TabKind } from "./tabs";

export type { ViewType };

/**
 * View resolution over the registry the build emitted (`src/registry.gen.ts`):
 * every function takes the registry rather than importing it, so the rules
 * are pure and unit-tested over a fixture, and the shell passes the one the
 * build resolved. Resolution never fails, so a removed view identifier or a
 * kind nothing contributes any more cannot strand a tab: the host's `context`
 * placeholder presents anything. BO_0202_004
 */

export interface ViewResolution {
  readonly view: ViewType;
  readonly requested: string;
  readonly unsupported: boolean;
}

export function viewsFor(registry: Registry, kind: TabKind): readonly ViewType[] {
  return registry.views.filter((view) => view.targetKinds.includes(kind));
}

export function findView(registry: Registry, id: string): ViewType | undefined {
  return registry.views.find((view) => view.id === id);
}

function supports(view: ViewType | undefined, kind: TabKind): view is ViewType {
  return view !== undefined && view.targetKinds.includes(kind);
}

/** The view a kind opens with: its declared default, else any view presenting it, else the placeholder. */
export function defaultViewFor(registry: Registry, kind: TabKind): ViewType {
  const declared = registry.kinds[kind];
  const named = declared === undefined ? undefined : findView(registry, declared);
  const view = supports(named, kind) ? named : (viewsFor(registry, kind)[0] ?? findView(registry, "context"));
  if (!view) throw new Error(`no view supports the ${kind} target kind`);
  return view;
}

export function resolveView(registry: Registry, kind: TabKind, requested: string): ViewResolution {
  const view = findView(registry, requested);
  return supports(view, kind)
    ? { view, requested, unsupported: false }
    : { view: defaultViewFor(registry, kind), requested, unsupported: true };
}

/**
 * A remembered preference is honoured only while it names a view that still
 * supports the target; otherwise the target kind's default answers.
 */
export function preferredView(
  registry: Registry,
  preferences: Readonly<Record<string, string>>,
  itemId: string | null,
  kind: TabKind,
): ViewType {
  const remembered = itemId === null ? undefined : preferences[itemId];
  const view = remembered === undefined ? undefined : findView(registry, remembered);
  return supports(view, kind) ? view : defaultViewFor(registry, kind);
}

/**
 * Choosing a view records it as that target's preference, so the next tab on
 * the same target opens the view last chosen for it.
 */
export function rememberView(
  preferences: Readonly<Record<string, string>>,
  itemId: string | null,
  viewId: string,
): Record<string, string> {
  return itemId === null
    ? { ...preferences }
    : { ...preferences, [itemId]: viewId };
}
