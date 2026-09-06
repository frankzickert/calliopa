import type { JSONValue } from "postgres";
import {
  DOCK_POSITIONS,
  DRAWER_STATES,
  SECTION_STATES,
  type Layout,
} from "~/lib/layout";
import { TAB_KINDS, type Tab } from "~/lib/tabs";
import { defaultViewFor } from "~/lib/views";
import {
  DEFAULT_WORKSPACE_STATE,
  type WorkspaceRecord,
  type WorkspaceState,
} from "~/lib/workspace";
import { db } from "./db";
import { HttpError } from "./http-error";
import { assertRecordId } from "./uuid";

const object = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "expected an object");
  }
  return value as Record<string, unknown>;
};

function parseTab(value: unknown): Tab {
  const tab = object(value);
  if (
    typeof tab.id !== "string" ||
    typeof tab.title !== "string" ||
    !TAB_KINDS.includes(tab.kind as Tab["kind"]) ||
    !(typeof tab.itemId === "string" || tab.itemId === null) ||
    !(typeof tab.selection === "string" || tab.selection === null) ||
    !(typeof tab.drawerContext === "string" || tab.drawerContext === null) ||
    typeof tab.unsaved !== "boolean" ||
    !(typeof tab.viewType === "string" || tab.viewType === undefined)
  ) {
    throw new HttpError(400, "invalid tab context");
  }
  const kind = tab.kind as Tab["kind"];
  return {
    id: tab.id,
    kind,
    title: tab.title,
    itemId: tab.itemId as string | null,
    // A tab stored before view types carries no identifier and opens in its
    // kind's default. An unknown identifier is kept, so the tab can fail
    // visibly at mount instead of silently changing view.
    viewType: (tab.viewType as string | undefined) ?? defaultViewFor(kind).id,
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
  // A record stored before the library had a category carries no section
  // state for it. Each reads back expanded rather than being refused, so a
  // category arrives open in a workspace that predates it. Every category
  // added later takes the same default through this one rule.
  const sections = {
    library: layout.library,
    episodes: layout.episodes,
    standing: layout.standing,
    destinations: layout.destinations,
  };
  const defaulted: Record<string, unknown> = {};
  for (const [name, stored] of Object.entries(sections)) {
    const state = stored ?? "expanded";
    if (!SECTION_STATES.includes(state as Layout["library"])) {
      throw new HttpError(400, "invalid workspace layout");
    }
    defaulted[name] = state;
  }
  return { ...layout, ...defaulted } as unknown as Layout;
}

export function parseWorkspaceState(value: unknown): WorkspaceState {
  const input = object(value);
  if (!Array.isArray(input.tabs)) throw new HttpError(400, "tabs must be an array");
  const tabs = input.tabs.map(parseTab);
  if (
    !(typeof input.activeTabId === "string" || input.activeTabId === null) ||
    (input.activeTabId !== null && !tabs.some(({ id }) => id === input.activeTabId))
  ) {
    throw new HttpError(400, "active tab must name an open tab");
  }
  return {
    tabs,
    activeTabId: input.activeTabId,
    layout: parseLayout(input.layout),
    preferredViews: parsePreferredViews(input.preferredViews),
  };
}

const json = (value: unknown) => db().json(value as JSONValue);
type WorkspaceRow = {
  id: string;
  tabs: unknown;
  activeTabId: string | null;
  layout: unknown;
  preferredViews: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function record(row: WorkspaceRow): WorkspaceRecord {
  return {
    id: row.id,
    ...parseWorkspaceState({
      tabs: row.tabs,
      activeTabId: row.activeTabId,
      layout: row.layout,
      preferredViews: row.preferredViews,
    }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const columns = () => db()`
  id, tabs, active_tab as "activeTabId", layout,
  preferred_views as "preferredViews",
  created_at as "createdAt", updated_at as "updatedAt"
`;

export async function createWorkspace(isDefault = false): Promise<WorkspaceRecord> {
  const state = DEFAULT_WORKSPACE_STATE;
  const [row] = await db()<WorkspaceRow[]>`
    insert into workspace (is_default, tabs, active_tab, layout, preferred_views)
    values (${isDefault || null}, ${json(state.tabs)}, ${state.activeTabId},
      ${json(state.layout)}, ${json(state.preferredViews)})
    returning ${columns()}
  `;
  if (!row) throw new Error("workspace insert returned no row");
  return record(row);
}

export async function readDefaultWorkspace(): Promise<WorkspaceRecord> {
  await db().begin(async (sql) => {
    await sql`select pg_advisory_xact_lock(314159)`;
    await sql`
      insert into workspace (is_default, tabs, active_tab, layout)
      select true, ${sql.json(DEFAULT_WORKSPACE_STATE.tabs as unknown as JSONValue)}, ${DEFAULT_WORKSPACE_STATE.activeTabId}, ${sql.json(DEFAULT_WORKSPACE_STATE.layout as unknown as JSONValue)}
      where not exists (select 1 from workspace where is_default)
    `;
  });
  const [row] = await db()<WorkspaceRow[]>`
    select ${columns()} from workspace where is_default
  `;
  if (!row) throw new Error("default workspace was not created");
  return record(row);
}

export async function readWorkspace(id: string): Promise<WorkspaceRecord> {
  assertRecordId(id, "workspace");
  const [row] = await db()<WorkspaceRow[]>`
    select ${columns()} from workspace where id = ${id}
  `;
  if (!row) throw new HttpError(404, `no workspace ${id}`);
  return record(row);
}

export async function saveWorkspace(id: string, input: unknown): Promise<WorkspaceRecord> {
  assertRecordId(id, "workspace");
  const state = parseWorkspaceState(input);
  const [row] = await db()<WorkspaceRow[]>`
    update workspace set tabs = ${json(state.tabs)}, active_tab = ${state.activeTabId},
      layout = ${json(state.layout)}, preferred_views = ${json(state.preferredViews)},
      updated_at = now()
    where id = ${id} returning ${columns()}
  `;
  if (!row) throw new HttpError(404, `no workspace ${id}`);
  return record(row);
}
