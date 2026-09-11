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

/**
 * A new workspace opens with no tabs (decided under `BO_0203`, 2026-09-07):
 * the two placeholder tabs it opened with went with the story-development
 * kinds, and the workspace's empty line names the library instead.
 */
export const DEFAULT_WORKSPACE_STATE: WorkspaceState = {
  tabs: [],
  activeTabId: null,
  layout: {
    left: "expanded",
    right: "expanded",
    dock: "composer",
    sections: {},
    filters: {},
  },
  preferredViews: {},
};
