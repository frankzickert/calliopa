import { $, component$, useStore } from "@builder.io/qwik";

import { closeAllTabs, neighbourTab, type TabsState } from "~/lib/tabs";
import type { Person } from "~/server/session";
import { LicenceWarning, PersonMenu } from "../header-disclosure";
import { CloseAllTabs, HeaderMenu, HeaderModeToggle, TabEdge } from "../header-menu";
import { SaveStatus } from "../save-status";
import { ThemeToggle } from "../theme-toggle";
import type { SaveState, ViewSave } from "../view-bridge";

/**
 * The phone header's *Minimum* parts wired in real JSX the way the shell
 * wires them: the menu around the controls, its statuses from a store a view
 * writes and from props a press here changes, the mode control, and the one
 * tab's two edges over a tabs state. Test support, imported by
 * `header-menu.test.ts` and nothing that ships. CA_0054
 */
export const HeaderMenuHost = component$<{
  person: Person;
  licence: string | null;
  tabs: TabsState;
}>((props) => {
  const save = useStore<ViewSave>({ state: null });
  const status = useStore({ processes: 0, update: null as string | null });
  const tabs = useStore<TabsState>({
    tabs: [...props.tabs.tabs],
    activeTabId: props.tabs.activeTabId,
  });
  const closeAll$ = $(() => {
    const next = closeAllTabs(tabs);
    tabs.tabs = next.tabs;
    tabs.activeTabId = next.activeTabId;
  });
  return (
    <header>
      <nav data-active-tab={tabs.activeTabId ?? ""}>
        <TabEdge
          side="before"
          tabs={tabs}
          onStep$={(step) => {
            tabs.activeTabId = neighbourTab(tabs, step).activeTabId;
          }}
        />
        <CloseAllTabs place="strip" tabs={tabs} onClose$={closeAll$} />
        <TabEdge
          side="after"
          tabs={tabs}
          onStep$={(step) => {
            tabs.activeTabId = neighbourTab(tabs, step).activeTabId;
          }}
        />
      </nav>
      <HeaderMenu
        save={save}
        processes={status.processes}
        update={status.update}
        licence={props.licence}
      >
        <SaveStatus save={save} />
        {props.licence !== null && <LicenceWarning text={props.licence} />}
        <HeaderModeToggle />
        <CloseAllTabs place="menu" tabs={tabs} onClose$={closeAll$} />
        <button type="button" class="settings-control" aria-label="Settings">
          Settings
        </button>
        <ThemeToggle />
        <PersonMenu person={props.person} />
      </HeaderMenu>
      {(["saving", "saved", "unsaved"] as const satisfies SaveState[]).map(
        (state) => (
          <button
            key={state}
            type="button"
            data-report={state}
            onClick$={() => (save.state = state)}
          >
            {state}
          </button>
        ),
      )}
      <button
        type="button"
        data-report="process"
        onClick$={() => (status.processes += 1)}
      >
        process
      </button>
      <button
        type="button"
        data-report="update"
        onClick$={() => (status.update = "0.3.12")}
      >
        update
      </button>
    </header>
  );
});
