import { randomUUID } from "node:crypto";

import {
  DOCK_POSITIONS,
  DRAWER_STATES,
  LEGACY_SECTION_KEYS,
  RENAMED_SECTION_KEYS,
  SECTION_STATES,
  type Layout,
  type SectionState,
} from "~/lib/layout";
import { migrateTabKind, type Tab } from "~/lib/tabs";
import { defaultViewFor } from "~/lib/views";
import { REGISTRY } from "~/registry.gen";
import { isRegisteredKind } from "./registry";
import {
  DEFAULT_WORKSPACE_STATE,
  type WorkspaceRecord,
  type WorkspaceState,
} from "~/lib/workspace";
import { HttpError } from "./http-error";
import { kernelState } from "./kernel/client";
import { assertRecordId } from "./uuid";

/**
 * Workspaces live in the kernel's per-instance state record, one JSON record
 * per workspace (`ui-kernel.md`, `BO_0207_002`): open tabs and layout are
 * working state, not content, so a tab switch is never a data revision. The
 * parsers here are unchanged; what changed is where a record is kept.
 * `BO_0207_014`
 */

/**
 * The default workspace has a fixed identity, so the first visit to `/` and
 * every later one find the same record without a marker to look up. It is a
 * well-formed record id like any other, which is what lets the transfer land
 * the old database's default workspace under it. BO_0207_014
 */
export const DEFAULT_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";

const object = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "expected an object");
  }
  return value as Record<string, unknown>;
};

/**
 * A tab's kind is any kind the build knows. A kind stored before kinds were
 * qualified, or under the extension that held it for one pin, is rewritten on
 * the way in (`LEGACY_TAB_KINDS`); a tab whose kind no extension contributes
 * any more is dropped by `parseWorkspaceState` rather than refused with the
 * whole workspace, and the workspace it leaves behind still works: nothing is
 * purged, so an extension restored finds its content where it was, and only
 * the tab is gone. BO_0202_004 BO_0203_006
 */
function parseTab(value: unknown): Tab {
  const tab = object(value);
  if (
    typeof tab.id !== "string" ||
    typeof tab.title !== "string" ||
    typeof tab.kind !== "string" ||
    tab.kind === "" ||
    !(typeof tab.itemId === "string" || tab.itemId === null) ||
    !(typeof tab.selection === "string" || tab.selection === null) ||
    !(typeof tab.drawerContext === "string" || tab.drawerContext === null) ||
    typeof tab.unsaved !== "boolean" ||
    !(typeof tab.viewType === "string" || tab.viewType === undefined)
  ) {
    throw new HttpError(400, "invalid tab context");
  }
  const kind = migrateTabKind(tab.kind);
  return {
    id: tab.id,
    kind,
    title: tab.title,
    itemId: tab.itemId as string | null,
    // A tab stored before view types carries no identifier and opens in its
    // kind's default. An unknown identifier is kept, so the tab can fail
    // visibly at mount instead of silently changing view.
    viewType: (tab.viewType as string | undefined) ?? defaultViewFor(REGISTRY, kind).id,
    selection: tab.selection as string | null,
    drawerContext: tab.drawerContext as string | null,
    unsaved: tab.unsaved,
  };
}

function parsePreferredViews(value: unknown): Record<string, string> {
  if (value === undefined) return {};
  const entries = Object.entries(object(value));
  if (entries.some(([, view]) => typeof view !== "string")) {
    throw new HttpError(400, "invalid preferred view");
  }
  return Object.fromEntries(entries) as Record<string, string>;
}

function parseLayout(value: unknown): Layout {
  const layout = object(value);
  if (
    !DRAWER_STATES.includes(layout.left as Layout["left"]) ||
    !DRAWER_STATES.includes(layout.right as Layout["right"]) ||
    !DOCK_POSITIONS.includes(layout.dock as Layout["dock"])
  ) {
    throw new HttpError(400, "invalid workspace layout");
  }
  // The sections' states are a record keyed `<ext>:<section>`. A layout
  // stored before the record existed carries the five named fields instead,
  // rewritten here to their keys (the one migration `BO_0202_003` names,
  // applied on read and stored on the next save); a key whose extension is
  // absent is preserved untouched, so an extension removed and restored
  // remembers its state; a key absent reads expanded when the shell asks.
  const sections: Record<string, SectionState> = {};
  for (const [field, key] of Object.entries(LEGACY_SECTION_KEYS)) {
    if (layout[field] !== undefined) sections[key] = asSectionState(layout[field]);
  }
  if (layout.sections !== undefined) {
    for (const [key, stored] of Object.entries(object(layout.sections))) {
      // A key that changed hands reads as its new key, once. BO_0203_006
      sections[RENAMED_SECTION_KEYS[key] ?? key] = asSectionState(stored);
    }
  }
  return {
    left: layout.left as Layout["left"],
    right: layout.right as Layout["right"],
    dock: layout.dock as Layout["dock"],
    sections,
  };
}

function asSectionState(value: unknown): SectionState {
  if (!SECTION_STATES.includes(value as SectionState)) {
    throw new HttpError(400, "invalid workspace layout");
  }
  return value as SectionState;
}

export function parseWorkspaceState(value: unknown): WorkspaceState {
  const input = object(value);
  if (!Array.isArray(input.tabs)) throw new HttpError(400, "tabs must be an array");
  const parsed = input.tabs.map(parseTab);
  if (
    !(typeof input.activeTabId === "string" || input.activeTabId === null) ||
    (input.activeTabId !== null && !parsed.some(({ id }) => id === input.activeTabId))
  ) {
    throw new HttpError(400, "active tab must name an open tab");
  }
  // Absence tolerates what it finds: a tab whose kind nothing contributes is
  // dropped, and an active tab dropped hands the place to the first tab kept.
  const tabs = parsed.filter((tab) => isRegisteredKind(tab.kind));
  const activeTabId =
    input.activeTabId !== null && tabs.some(({ id }) => id === input.activeTabId)
      ? (input.activeTabId as string)
      : (tabs[0]?.id ?? null);
  return {
    tabs,
    activeTabId,
    layout: parseLayout(input.layout),
    preferredViews: parsePreferredViews(input.preferredViews),
  };
}

/** The stored shape: the record as the shell reads it, id included. */
interface StoredWorkspace extends WorkspaceState {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function record(stored: StoredWorkspace): WorkspaceRecord {
  return {
    id: stored.id,
    ...parseWorkspaceState(stored),
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

async function write(id: string, state: WorkspaceState, createdAt: string): Promise<WorkspaceRecord> {
  const now = new Date().toISOString();
  const stored: StoredWorkspace = { id, ...state, createdAt, updatedAt: now };
  await kernelState.write("workspaces", stored);
  return record(stored);
}

export async function createWorkspace(): Promise<WorkspaceRecord> {
  return write(randomUUID(), DEFAULT_WORKSPACE_STATE, new Date().toISOString());
}

/**
 * The default workspace, created on first visit. Two first visits racing
 * both write the default state under the same id, which is the same record
 * either way.
 */
export async function readDefaultWorkspace(): Promise<WorkspaceRecord> {
  const stored = await kernelState.read<StoredWorkspace>("workspaces", DEFAULT_WORKSPACE_ID);
  if (stored !== null) return record(stored);
  return write(DEFAULT_WORKSPACE_ID, DEFAULT_WORKSPACE_STATE, new Date().toISOString());
}

export async function readWorkspace(id: string): Promise<WorkspaceRecord> {
  assertRecordId(id, "workspace");
  const stored = await kernelState.read<StoredWorkspace>("workspaces", id);
  if (stored === null) throw new HttpError(404, `no workspace ${id}`);
  return record(stored);
}

export async function saveWorkspace(id: string, input: unknown): Promise<WorkspaceRecord> {
  assertRecordId(id, "workspace");
  const state = parseWorkspaceState(input);
  const stored = await kernelState.read<StoredWorkspace>("workspaces", id);
  if (stored === null) throw new HttpError(404, `no workspace ${id}`);
  return write(id, state, stored.createdAt);
}

/** A workspace deleted in the shell is removed from the record. BO_0207_014 */
export async function deleteWorkspace(id: string): Promise<void> {
  assertRecordId(id, "workspace");
  await kernelState.remove("workspaces", id);
}
