import type { DragOperation } from "./drag";
import type { TabKind } from "./tabs";

/**
 * A view type is built-in application source. Adding one is a repository
 * change, never a manifest, a scan, a dynamic import, or a graph-hosted
 * contribution.
 */
export interface ViewType {
  readonly id: string;
  readonly name: string;
  /** The target kinds this view can present. */
  readonly targetKinds: readonly TabKind[];
  /** What the inspector says while this view is active. */
  readonly inspector: string;
  /** The operations a drag of this view's target offers. */
  readonly drag: readonly DragOperation[];
}

/**
 * `block-editor` is the real view: it presents a graph document, and it is the
 * only view that presents one. `context` and `outline` stay registered for the
 * story-development target kinds that have no real view yet, which is what
 * keeps a target kind able to offer one view or several.
 */
export type ViewId =
  "block-editor" | "episode" | "front" | "context" | "outline" | "settings";

export const VIEW_TYPES: readonly ViewType[] = [
  {
    id: "block-editor",
    name: "Editor",
    targetKinds: ["document"],
    inspector: "No block active",
    drag: ["move", "open-in-tab"],
  },
  {
    id: "episode",
    name: "Episode",
    targetKinds: ["episode"],
    // An episode has no active block and no selection of its own, so the
    // inspector says what the target is rather than what is selected in it.
    inspector: "No asset active",
    drag: ["move", "open-in-tab"],
  },
  {
    id: "front",
    name: "Front",
    targetKinds: ["front"],
    // A front has no selection of its own. What the inspector says about it is
    // what the log says has happened to it, which the view contributes.
    inspector: "Nothing published yet",
    drag: [],
  },
  {
    id: "settings",
    name: "Settings",
    targetKinds: ["settings"],
    // Nothing to say about a target that is not content, and nothing to drag.
    inspector: "Instance settings",
    drag: [],
  },
  {
    id: "context",
    name: "Context",
    // Neither `document` nor `settings`. Each has one view, so the tab's view
    // affordance renders nothing for it and `Open in Context` never appears.
    // Leaving the view compatible and hiding only the button would contradict
    // the rule that a tab exposes its compatible views.
    targetKinds: [
      "script",
      "scene",
      "storyboard",
      "media",
      "timeline",
      "process-result",
    ],
    inspector: "Context summary",
    drag: ["move", "open-in-tab"],
  },
  {
    id: "outline",
    name: "Outline",
    targetKinds: ["script", "scene", "storyboard", "timeline"],
    inspector: "Outline structure",
    drag: ["move", "copy", "open-in-tab"],
  },
] satisfies readonly (ViewType & { id: ViewId })[];

/** Every target kind declares the view it opens with when nothing is remembered. */
export const DEFAULT_VIEWS: Readonly<Record<TabKind, ViewId>> = {
  document: "block-editor",
  episode: "episode",
  front: "front",
  settings: "settings",
  script: "context",
  scene: "context",
  storyboard: "context",
  media: "context",
  timeline: "context",
  "process-result": "context",
};

/**
 * A tab's stored view either resolves to a registered compatible view, or the
 * tab keeps its target and falls back visibly. Resolution never fails, so a
 * removed view identifier cannot strand a tab.
 */
export interface ViewResolution {
  readonly view: ViewType;
  readonly requested: string;
  readonly unsupported: boolean;
}

export function viewsFor(kind: TabKind): readonly ViewType[] {
  return VIEW_TYPES.filter((view) => view.targetKinds.includes(kind));
}

export function findView(id: string): ViewType | undefined {
  return VIEW_TYPES.find((view) => view.id === id);
}

function supports(view: ViewType | undefined, kind: TabKind): view is ViewType {
  return view !== undefined && view.targetKinds.includes(kind);
}

export function defaultViewFor(kind: TabKind): ViewType {
  const declared = findView(DEFAULT_VIEWS[kind]);
  const view = supports(declared, kind) ? declared : viewsFor(kind)[0];
  if (!view) throw new Error(`no view supports the ${kind} target kind`);
  return view;
}

export function resolveView(kind: TabKind, requested: string): ViewResolution {
  const view = findView(requested);
  return supports(view, kind)
    ? { view, requested, unsupported: false }
    : { view: defaultViewFor(kind), requested, unsupported: true };
}

/**
 * A remembered preference is honoured only while it names a view that still
 * supports the target; otherwise the target kind's default answers.
 */
export function preferredView(
  preferences: Readonly<Record<string, string>>,
  itemId: string | null,
  kind: TabKind,
): ViewType {
  const remembered = itemId === null ? undefined : preferences[itemId];
  const view = remembered === undefined ? undefined : findView(remembered);
  return supports(view, kind) ? view : defaultViewFor(kind);
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
