import { $, component$, useStore, useVisibleTask$, type QRL } from "@builder.io/qwik";

import {
  clampPanelWidth,
  defaultPanelWidth,
  draggedPanelWidth,
  panelBounds,
  panelDraw,
  resizeKey,
  sectionState,
  shownIcon,
  stepPanelWidth,
  type Layout,
  type PanelBounds,
  type PanelSide,
  type PanelWidths,
} from "~/lib/layout";
import { PANEL_ICON_KIND, PANEL_ICON_TARGET, type DragPayload } from "~/lib/drag";
import { applyPanelWidth, readPanelWidth, remPx, writePanelWidth } from "~/lib/panel-width";
import { Icon, type IconName } from "./icons";

/** One icon of a panel's column: its id in the stored layout, its title and
 * its Phosphor name. */
export interface PanelIconEntry {
  readonly id: string;
  readonly title: string;
  readonly name: IconName;
}

/** The shell's drag as the icon column reads it: what is dragged and the
 * target under the pointer, a column target naming the icon the drop lands
 * before, or `end`. CA_0068_002 */
export interface PanelIconDrag {
  readonly payload: DragPayload | null;
  readonly overId: string | null;
}

/**
 * Where the drop line is drawn on an icon while one is dragged: above the icon
 * the drop lands before, and below the last when it lands at the end. A
 * value on every icon, never an attribute left behind on a reused element.
 * CA_0068_002
 */
function dropPlace(
  drag: PanelIconDrag | undefined,
  ids: readonly string[],
  id: string,
): "before" | "after" | "none" {
  if (drag?.payload?.kind !== PANEL_ICON_KIND || drag.overId === null) return "none";
  if (drag.overId === `${PANEL_ICON_TARGET}${id}`) return "before";
  if (drag.overId === `${PANEL_ICON_TARGET}end` && ids[ids.length - 1] === id) return "after";
  return "none";
}

/**
 * A panel's icon column, as VS Code's activity bar: one transparent icon
 * button per entry, named by its title and showing it as its tooltip, the
 * shown one marked by `aria-pressed` and by the bar the stylesheet draws on
 * the column's outer edge. It takes the layout store and reads its side
 * itself, so the mark follows every press rather than freezing at mount.
 * CA_0056_001
 *
 * Given `startDrag$`, its icons are reordered by dragging them through the
 * shell's drag model: each is a draggable of kind `panel-icon` offering
 * `move`, and the icons and the column below them are the targets it accepts,
 * the column standing for the end. A press without travel stays a press.
 * `drag` is the shell's drag store, read here so the line follows the pointer.
 * CA_0068_002 CA_0068_008
 */
export const PanelIcons = component$<{
  side: "left" | "right";
  label: string;
  layout: Layout;
  icons: readonly PanelIconEntry[];
  onPress$: QRL<(id: string) => void>;
  startDrag$?: QRL<(payload: DragPayload, event: PointerEvent) => void> | undefined;
  drag?: PanelIconDrag | undefined;
}>(({ side, label, layout, icons, onPress$, startDrag$, drag }) => {
  const ids = icons.map((icon) => icon.id);
  const shown = shownIcon(layout[side], ids);
  const reorders = startDrag$ !== undefined;
  return (
    <nav
      class="panel-icons"
      aria-label={label}
      data-side={side}
      data-drop-target={reorders ? `${PANEL_ICON_TARGET}end` : undefined}
      data-accepts={reorders ? "move" : undefined}
    >
      {icons.map((icon) => (
        <button
          key={icon.id}
          type="button"
          class="panel-icon"
          data-panel-icon={icon.id}
          data-drop-target={reorders ? `${PANEL_ICON_TARGET}${icon.id}` : undefined}
          data-accepts={reorders ? "move" : undefined}
          data-drop-place={reorders ? dropPlace(drag, ids, icon.id) : undefined}
          aria-label={icon.title}
          title={icon.title}
          aria-pressed={shown === icon.id}
          onPointerDown$={(event) =>
            startDrag$?.(
              {
                itemId: icon.id,
                kind: PANEL_ICON_KIND,
                source: "panel",
                operations: ["move"],
                preview: icon.title,
              },
              event,
            )
          }
          onClick$={() => onPress$(icon.id)}
        >
          <Icon name={icon.name} size={24} />
        </button>
      ))}
    </nav>
  );
});

/**
 * A library section's header. Under an icon holding several sections it is a
 * band's header with the caret that collapses it, its state read from the
 * layout store; under an icon holding one, the header names the section and
 * carries no caret, since collapsing the one section shown would leave the
 * panel empty. The create control rides the line either way. CA_0056_002
 */
export const SectionHeader = component$<{
  layout: Layout;
  sectionKey: string;
  name: string;
  elementId: string;
  title: string;
  collapsible: boolean;
  createLabel?: string | undefined;
  onToggle$: QRL<() => void>;
  onCreate$: QRL<() => void>;
}>((props) => {
  const state = sectionState(props.layout, props.sectionKey);
  return (
    <div class="library-category__header">
      <h2 class="library-category__heading">
        {props.collapsible ? (
          <button
            type="button"
            class="library-category__toggle"
            id={props.elementId}
            aria-expanded={state === "expanded"}
            aria-controls={`${props.elementId}-list`}
            onClick$={() => props.onToggle$()}
          >
            <span class="library-category__caret">
              <Icon name="caret-right" />
            </span>
            {props.title}
          </button>
        ) : (
          <span class="library-category__title" id={props.elementId}>
            {props.title}
          </span>
        )}
      </h2>
      {props.createLabel !== undefined && (
        <button
          type="button"
          class="library-action library-action--icon"
          aria-label={props.createLabel}
          data-new={props.name}
          onClick$={() => props.onCreate$()}
        >
          <Icon name="plus" />
        </button>
      )}
    </div>
  );
});

/** The bounds as the page stands: its width, and the other panel's whole
 * column, 0 while it is hidden. Measured at each press and key rather than
 * kept, since the other panel and the window move without telling anyone. */
const measureBounds = (side: PanelSide, rem: number): PanelBounds => {
  const other = document.querySelector<HTMLElement>(`.drawer--${side === "left" ? "right" : "left"}`);
  return panelBounds(window.innerWidth, other?.offsetWidth ?? 0, rem);
};

/**
 * The handle on a shown panel's inner border: a separator the reader drags,
 * or moves by the arrow keys, to change that panel's content width, on a
 * desktop only. It is absent in the small mode and hidden, where the column
 * alone has nothing to resize. A pointer drag captures the pointer, so
 * leaving the border mid-drag keeps resizing; the stylesheet keeps every
 * press off the workspace while `data-active` is set. A double press, and
 * Enter on the focused separator, restore the default. The width reaches
 * the page as a custom property on the root, which `.shell`'s columns read,
 * so a drag re-renders this handle and nothing in the workspace; the store
 * it writes carries the number the separator reports. CA_0066_002 CA_0066_003
 */
export const PanelResizeHandle = component$<{
  side: PanelSide;
  layout: Layout;
  widths: PanelWidths;
}>(({ side, layout, widths }) => {
  const drag = useStore({ active: false, startX: 0, startWidth: 0 });
  const bounds = useStore<{ min: number | null; max: number | null }>({ min: null, max: null });
  const shown = panelDraw(layout[side]) === "shown";

  /** The width as it stands: the store's, or the default at the root's rem. */
  const current = $((): number => widths[side] ?? defaultPanelWidth(side, remPx()));
  const measure$ = $((): PanelBounds => {
    const measured = measureBounds(side, remPx());
    bounds.min = measured.min;
    bounds.max = measured.max;
    return measured;
  });
  const set$ = $(async (width: number | null) => {
    widths[side] = width;
    applyPanelWidth(side, width);
  });

  // On the way in the stored width is read, once the page can be measured,
  // and clamped to what the page allows; storage keeps what was stored, so
  // a wider screen later gets its width back. CA_0066_004
  useVisibleTask$(async () => {
    const stored = readPanelWidth(side);
    if (stored === null) return;
    await set$(clampPanelWidth(stored, await measure$()));
  });

  if (!shown) return null;
  return (
    <div
      class="panel-resize"
      data-side={side}
      data-active={drag.active ? "" : undefined}
      role="separator"
      aria-orientation="vertical"
      aria-label={side === "left" ? "Resize library" : "Resize inspector"}
      aria-valuenow={widths[side] ?? defaultPanelWidth(side, remPx())}
      aria-valuemin={bounds.min ?? undefined}
      aria-valuemax={bounds.max ?? undefined}
      tabIndex={0}
      onPointerDown$={async (event, element) => {
        if (event.button !== 0) return;
        drag.startX = event.clientX;
        drag.startWidth = await current();
        drag.active = true;
        await measure$();
        if (typeof element.setPointerCapture === "function") element.setPointerCapture(event.pointerId);
      }}
      onPointerMove$={async (event) => {
        if (!drag.active) return;
        const measured = { min: bounds.min ?? 0, max: bounds.max ?? Number.MAX_SAFE_INTEGER };
        await set$(draggedPanelWidth(side, drag.startWidth, event.clientX - drag.startX, measured));
      }}
      onPointerUp$={() => {
        if (!drag.active) return;
        drag.active = false;
        writePanelWidth(side, widths[side]);
      }}
      onPointerCancel$={() => {
        if (!drag.active) return;
        drag.active = false;
        writePanelWidth(side, widths[side]);
      }}
      onDblClick$={async () => {
        await set$(null);
        writePanelWidth(side, null);
      }}
      onKeyDown$={async (event) => {
        const ask = resizeKey(side, event.key);
        if (ask === null) return;
        if (ask === "reset") {
          await set$(null);
          writePanelWidth(side, null);
          return;
        }
        const width = stepPanelWidth(await current(), ask, await measure$());
        await set$(width);
        writePanelWidth(side, width);
      }}
    />
  );
});
