import type { Layout } from "./layout";
import type { TabsState } from "./tabs";

export interface WorkspaceState extends TabsState {
  layout: Layout;
  /** The view last chosen for a target, keyed by item identity. */
  preferredViews: Record<string, string>;
}

export interface WorkspaceRecord extends WorkspaceState {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const DEFAULT_WORKSPACE_STATE: WorkspaceState = {
  tabs: [
    {
      id: "workspace",
      kind: "script",
      title: "Workspace",
      itemId: null,
      viewType: "context",
      selection: null,
      drawerContext: "workspace",
      unsaved: false,
    },
    {
      id: "scene-board",
      kind: "storyboard",
      title: "Scene board",
      itemId: "placeholder-scene",
      viewType: "context",
      selection: "opening",
      drawerContext: "scene",
      unsaved: false,
    },
  ],
  activeTabId: "workspace",
  layout: {
    left: "expanded",
    right: "expanded",
    dock: "composer",
    library: "expanded",
    episodes: "expanded",
    standing: "expanded",
    destinations: "expanded",
  },
  preferredViews: {},
};
