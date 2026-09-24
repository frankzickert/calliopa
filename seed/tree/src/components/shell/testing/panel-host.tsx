import { $, component$, useStore } from "@builder.io/qwik";

import type { DragPayload } from "~/lib/drag";
import {
  INSPECTOR_ICON,
  nextSectionState,
  orderedIcons,
  panelDraw,
  pressClosesSheet,
  pressHandle,
  pressIcon,
  sectionState,
  togglePanel,
  type Layout,
  type PanelWidths,
  type Sheet,
} from "~/lib/layout";
import { PanelIcons, PanelResizeHandle, SectionHeader, type PanelIconEntry } from "../panel";
import { LibraryRow } from "../library-row";

const LIBRARY: readonly PanelIconEntry[] = [
  { id: "documents", title: "Docs", name: "files" },
  { id: "publishing", title: "Publish", name: "paper-plane-tilt" },
  { id: "ui.shell", title: "Extensions", name: "puzzle-piece" },
];
const INSPECTOR: readonly PanelIconEntry[] = [{ id: INSPECTOR_ICON, title: "Inspector", name: "info" }];
const ids = (layout: Layout, side: "left" | "right"): string[] =>
  side === "left" ? orderedIcons(LIBRARY, layout.libraryOrder).map((icon) => icon.id) : [INSPECTOR_ICON];

/**
 * The two panels' icon columns and the header's two controls wired in real
 * JSX the way the shell wires them — the same layout rules, the phone read
 * from `matchMedia` at the press — beside a section header alone under its
 * icon and one of two. Test support, imported by `panel.test.ts` and nothing
 * that ships. CA_0056_005
 *
 * The library's column is drawn in the stored order and reorders through
 * `startDrag$`, as the shell's does; the shell's pointer tracking is not here,
 * so a drag starts on the press and the target under the pointer is the one
 * `over` names. What the drag carries is drawn on the root. CA_0068_005
 */
export const PanelHost = component$<{ layout: Layout; over?: string | undefined }>((props) => {
  const layout = useStore<Layout>({ ...props.layout });
  const drag = useStore<{ payload: DragPayload | null; overId: string | null }>({ payload: null, overId: null });
  const mobile = useStore({ sheet: "left" as Sheet });
  /** What the row opened, so a closing sheet is not mistaken for a press that
   * never reached the tabs. The shell's `openTarget$` opens and closes in the
   * same step; here the opening is recorded rather than tabbed. CA_0059_001 */
  const opened = useStore({ titles: [] as string[] });
  /** The two panels' widths, the browser's and not the record's, as the
   * shell keeps them beside the layout. CA_0066_002 */
  const widths = useStore<PanelWidths>({ left: null, right: null });
  return (
    <main
      data-left={panelDraw(layout.left)}
      data-right={panelDraw(layout.right)}
      data-sheet={mobile.sheet ?? undefined}
      data-opened={opened.titles.join(",")}
      data-dragged={drag.payload === null ? "" : `${drag.payload.kind}:${drag.payload.itemId}:${drag.payload.operations.join(" ")}`}
    >
      {/* The header is outside the sheet: a press there closes it, and the
          control still does its own work. CA_0059_002 */}
      <header class="shell-header" onPointerDown$={() => (mobile.sheet = null)}>
        <button type="button" class="settings-control" aria-label="Settings" />
      </header>
      {(["left", "right"] as const).map((side) => (
        <button
          key={`handle-${side}`}
          type="button"
          class={`sheet-handle sheet-handle--${side}`}
          aria-label={side === "left" ? "Open library" : "Open inspector"}
          onClick$={() => (mobile.sheet = pressHandle(mobile.sheet, side))}
        />
      ))}
      {mobile.sheet !== null && (
        <div class="sheet-shield" aria-hidden="true" onClick$={() => (mobile.sheet = null)} />
      )}
      {/* A row of the uniform shape, opened the way the shell opens one: the
          sheet has done its job the moment it lands the reader on a tab, and
          the panel is left as it was. CA_0059_001 */}
      <LibraryRow
        item={{ id: "doc-1", label: "A document", open: { kind: "document", itemId: "doc-1", title: "A document" } }}
        current={false}
        onOpen$={(target) => {
          mobile.sheet = null;
          opened.titles = [...opened.titles, target.title];
        }}
      />
      {(["left", "right"] as const).map((side) => (
        <button
          key={side}
          type="button"
          class="layout-control"
          data-side={side}
          aria-label={side === "left" ? "Library" : "Inspector"}
          aria-pressed={layout[side].shown}
          onClick$={() => (layout[side] = togglePanel(layout[side]))}
        />
      ))}
      {(["left", "right"] as const).map((side) => (
        <PanelIcons
          key={side}
          side={side}
          label={side === "left" ? "Library sections" : "Inspector sections"}
          layout={layout}
          icons={side === "left" ? orderedIcons(LIBRARY, layout.libraryOrder) : INSPECTOR}
          onPress$={(id) => {
            const phone = window.matchMedia("(max-width: 640px)").matches;
            if (pressClosesSheet(layout[side], ids(layout, side), id, phone)) {
              mobile.sheet = null;
              return;
            }
            layout[side] = pressIcon(layout[side], ids(layout, side), id, phone);
          }}
          startDrag$={
            side === "left"
              ? $((payload: DragPayload) => {
                  drag.payload = payload;
                  drag.overId = props.over ?? null;
                })
              : undefined
          }
          drag={drag}
        />
      ))}
      {(["left", "right"] as const).map((side) => (
        <PanelResizeHandle key={`resize-${side}`} side={side} layout={layout} widths={widths} />
      ))}
      {[
        { key: "documents:documents", title: "Documents", collapsible: false },
        { key: "publishing:channels", title: "Channels", collapsible: true },
      ].map((section) => (
        <section key={section.key} data-section={section.key}>
          <SectionHeader
            layout={layout}
            sectionKey={section.key}
            name={section.key}
            elementId={`section-${section.key.replace(":", "-")}`}
            title={section.title}
            collapsible={section.collapsible}
            createLabel="New"
            onToggle$={() => {
              layout.sections = {
                ...layout.sections,
                [section.key]: nextSectionState(sectionState(layout, section.key)),
              };
            }}
            onCreate$={() => undefined}
          />
        </section>
      ))}
    </main>
  );
});
