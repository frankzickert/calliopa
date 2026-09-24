import {
  $,
  component$,
  Slot,
  useId,
  useSignal,
  useVisibleTask$,
  type QRL,
} from "@builder.io/qwik";

import {
  HEADER_MODE_STORAGE_KEY,
  MENU_FLASH_MS,
  menuStatusChange,
  otherHeaderMode,
  parseHeaderMode,
  QUIET_STATUS,
  type HeaderMode,
  type MenuStatus,
  type MenuStatusChange,
} from "~/lib/header-mode";
import { tabsBeside, type TabsState } from "~/lib/tabs";
import { Icon, type IconName } from "./icons";
import { SAVE_WORD } from "./inspector";
import { SAVE_ICONS } from "./save-status";
import type { ViewSave } from "./view-bridge";

/** What the menu button shows while a change holds its place. */
function flashIcon(change: MenuStatusChange): IconName | null {
  if (change.kind === "save") return SAVE_ICONS[change.state];
  if (change.kind === "update") return "arrow-circle-up";
  if (change.kind === "licence") return "warning";
  return null;
}

function flashWord(change: MenuStatusChange): string {
  if (change.kind === "save") return SAVE_WORD[change.state];
  if (change.kind === "processes") return `${change.count} active processes`;
  if (change.kind === "update") return `Update available: ${change.version}`;
  return change.text;
}

/**
 * The header's controls, and on a phone in *Minimum* the one menu that holds
 * them. There is one set of controls, never two: on a desktop and in *Full*
 * the wrapper and its panel lay out as `display: contents`, so the controls
 * sit on the line as before, and the button and its announcement are not
 * drawn. In *Minimum* the button draws `list` and the panel opens under it.
 * CA_0054_003
 *
 * A change the menu holds takes the button's place for `MENU_FLASH_MS`, and
 * then `list` comes back with a dot until the menu is opened; a change
 * arriving meanwhile restarts the time. The button stays named *Menu*: the
 * change is said once, by the announcement beside it, which is only drawn
 * where the button is, so *Full* keeps the save state's own. CA_0054_004
 *
 * A disclosure, as `HeaderDisclosure` is, closing the same three ways; a
 * press on a control in it closes it too, except the theme, which a reader
 * presses until the choice is the one they want.
 */
export const HeaderMenu = component$<{
  save: ViewSave;
  processes: number;
  update: string | null;
  licence: string | null;
}>((props) => {
  const panelId = useId();
  const root = useSignal<HTMLElement>();
  const button = useSignal<HTMLButtonElement>();
  const open = useSignal(false);
  const dot = useSignal(false);
  const flash = useSignal<{ change: MenuStatusChange; seq: number } | null>(
    null,
  );
  const seen = useSignal<MenuStatus>(QUIET_STATUS);

  // Document-ready rather than visible: on a desktop the wrapper has no box
  // of its own, and an observer would never see it. The flash is a browser's
  // alone, so nothing of it is rendered on the server.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    ({ track }) => {
      const now: MenuStatus = {
        save: track(() => props.save.state),
        processes: track(() => props.processes),
        update: track(() => props.update),
        licence: track(() => props.licence),
      };
      const change = menuStatusChange(seen.value, now);
      seen.value = now;
      if (change === null) return;
      const seq = (flash.value?.seq ?? 0) + 1;
      flash.value = { change, seq };
      if (!open.value) dot.value = true;
      setTimeout(() => {
        if (flash.value?.seq === seq) flash.value = null;
      }, MENU_FLASH_MS);
    },
    { strategy: "document-ready" },
  );

  const toggle$ = $(() => {
    open.value = !open.value;
    if (open.value) dot.value = false;
  });

  const icon = flash.value === null ? "list" : flashIcon(flash.value.change);

  return (
    <div
      class="header-menu"
      ref={root}
      data-open={open.value ? "true" : "false"}
      data-dot={dot.value ? "true" : "false"}
      data-flash={flash.value?.change.kind}
      document:onPointerDown$={(event) => {
        if (open.value && !root.value?.contains(event.target as Node))
          open.value = false;
      }}
      onKeyDown$={(event) => {
        if (event.key !== "Escape" || !open.value) return;
        open.value = false;
        button.value?.focus();
      }}
    >
      <button
        type="button"
        ref={button}
        class="header-menu__button"
        aria-expanded={open.value ? "true" : "false"}
        aria-controls={panelId}
        aria-label="Menu"
        onClick$={toggle$}
      >
        {icon === null ? (
          <span class="header-menu__count">
            {flash.value?.change.kind === "processes"
              ? flash.value.change.count
              : ""}
          </span>
        ) : (
          <Icon name={icon} />
        )}
        {dot.value && flash.value === null && (
          <span class="header-menu__dot" aria-hidden="true" />
        )}
      </button>
      <span class="header-menu__announce" role="status">
        {flash.value === null ? "" : flashWord(flash.value.change)}
      </span>
      <div
        class="header-menu__panel"
        id={panelId}
        hidden={!open.value}
        onClick$={(event) => {
          const pressed = (event.target as Element).closest("button");
          if (
            pressed !== null &&
            !pressed.classList.contains("theme-toggle") &&
            !pressed.classList.contains("header-disclosure__button")
          )
            open.value = false;
        }}
      >
        <Slot />
      </div>
    </div>
  );
});

/**
 * The control that switches the phone's header between *Full* and
 * *Minimum*. On the line in *Full*, left of settings, it offers *Minimum*;
 * in *Minimum*'s menu it offers *Full*. The mode is the root's
 * `data-header-mode`, which the pre-paint script set from browser storage,
 * and a press writes both. A desktop never draws it. CA_0054_001 CA_0054_002
 */
export const HeaderModeToggle = component$(() => {
  const mode = useSignal<HeaderMode>("minimum");

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    () => {
      mode.value = parseHeaderMode(
        document.documentElement.getAttribute("data-header-mode"),
      );
    },
    { strategy: "document-ready" },
  );

  const offered = otherHeaderMode(mode.value);
  const name = offered === "minimum" ? "Minimum header" : "Full header";
  return (
    <button
      type="button"
      class="header-mode-toggle"
      data-header-mode={mode.value}
      aria-label={name}
      onClick$={() => {
        mode.value = offered;
        try {
          localStorage.setItem(HEADER_MODE_STORAGE_KEY, offered);
        } catch {
          // The page still switches when browser storage is unavailable.
        }
        document.documentElement.setAttribute("data-header-mode", offered);
      }}
    >
      <Icon
        name={
          offered === "minimum"
            ? "arrows-in-line-vertical"
            : "arrows-out-line-vertical"
        }
      />
      <span class="menu-label">{name}</span>
    </button>
  );
});

/**
 * The control that closes every open tab. It stands at the strip's end on a
 * desktop and in the phone's *Full*, and is a row of the menu in *Minimum*,
 * where the strip has no end; the stylesheet draws one of the two by the
 * root's mode, and `place` is what it keys on. Drawn only while the strip
 * holds a tab, since a control that closes nothing would say there is
 * something to close. It takes the tabs store and counts for itself, as the
 * edges do. CA_0067_002 CA_0067_003
 */
export const CloseAllTabs = component$<{
  place: "strip" | "menu";
  tabs: TabsState;
  onClose$: QRL<() => void>;
}>((props) => {
  return props.tabs.tabs.length === 0 ? null : (
    <button
      type="button"
      class="tab-action close-all-tabs"
      data-close-all-tabs={props.place}
      aria-label="Close all tabs"
      onClick$={() => props.onClose$()}
    >
      <Icon name="x-circle" />
      <span class="menu-label">Close all tabs</span>
    </button>
  );
});

/**
 * One faded edge of the phone's one tab in *Minimum*: how many tabs lie that
 * way, and a press that makes the neighbour active, beside the swipe. Only
 * drawn where tabs lie beyond it; a desktop and *Full* never show it. It
 * takes the tabs store and counts for itself, since a count computed by the
 * host and passed down would be read once, at mount. CA_0054_007
 */
export const TabEdge = component$<{
  side: "before" | "after";
  tabs: TabsState;
  onStep$: QRL<(step: -1 | 1) => void>;
}>((props) => {
  const count = tabsBeside(props.tabs)[props.side];
  const before = props.side === "before";
  return count === 0 ? null : (
    <button
      type="button"
      class={`tab-edge tab-edge--${props.side}`}
      data-tab-edge={props.side}
      aria-label={`${count} ${count === 1 ? "tab" : "tabs"} ${props.side}. ${before ? "Previous" : "Next"} tab`}
      onClick$={() => props.onStep$(before ? -1 : 1)}
    >
      <span class="tab-edge__count" aria-hidden="true">
        {count}
      </span>
    </button>
  );
});
