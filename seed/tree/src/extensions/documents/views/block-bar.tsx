import { component$, type QRL } from "@builder.io/qwik";

import { Icon } from "~/components/shell/icons";
import { CONTROL_GLYPH, type Standing } from "../lib/disposition";
import { BlockControls } from "./block-controls";

/**
 * The one bar the active row carries on its top border, right-aligned and in
 * one row (`BO_0315_013`): the shell's block controls — *Open as focused work*
 * — then ↑ and ↓, then *Remove* and *Fixate*, which reads *Unfixate* on a
 * fixated block. There is no *Keep* button, save on a prompt, which carries
 * *Keep as content* and *Fixate* instead (DO_0031_002). The bar says how wide
 * it is on its row (`--block-bar-width`).
 *
 * It is drawn on the row turned to while reading, on the row being edited and
 * on a proposal turned to, and nowhere else, so a button that should not be
 * there takes no focus; command mode draws none. Out of the flow, so showing it
 * moves no text. A revealed removed row draws its arrows and *Restore* in it
 * instead of *Remove* and *Fixate*.
 */
export const BlockBar = component$<{
  /** The document whose block controls the shell is asked for; absent on a
   * row that is not yet a block of it — a proposal, a removed row. */
  controlsFor?: {
    readonly documentId: string;
    readonly blockId: string;
    readonly hasFocusedWork: boolean;
    readonly press$: QRL<(control: string, blockId: string) => void>;
  };
  /** What the row is, in the words its controls are named with. */
  label: string;
  /** The row's position, which every control below is called with: a block's
   * identity, `proposal:<item>`, or a rejected proposal's item. The row's own
   * QRLs are handed over as they are, never wrapped in a closure of the row's,
   * which the optimizer compiled into a scope declaring one name twice. */
  id: string;
  /** The arrows' attribute names: the block being edited moves by its own
   * move (`data-block-up`), any other row by the grip's (`data-row-up`). */
  arrows: "block" | "row";
  first: boolean;
  last: boolean;
  /** Moves the row one drawn row; absent on a row that does not move. */
  step$?: QRL<(id: string, direction: -1 | 1) => void>;
  /** The row's standing, when it can take one: null draws no *Fixate*. */
  standing: Standing | null;
  fixate$?: QRL<(id: string, to: Standing) => void>;
  remove$?: QRL<(id: string) => void>;
  restore$?: QRL<(id: string) => void>;
  /** Whether the row carries the depth's categories, which are placed by the
   * bar's width: a block of the document's row. */
  measured?: boolean;
}>(({ measured, controlsFor, label, id, arrows, first, last, step$, standing, fixate$, remove$, restore$ }) => {
  const up = arrows === "block" ? { "data-block-up": true } : { "data-row-up": true };
  const down = arrows === "block" ? { "data-block-down": true } : { "data-row-down": true };
  const fixated = standing === "fixate";
  return (
    <div class="block-toolbars" data-block-bar {...(measured === true ? { ref: measureBar } : {})}>
      {controlsFor !== undefined && (
        <BlockControls
          itemId={controlsFor.documentId}
          blockId={controlsFor.blockId}
          hasFocusedWork={controlsFor.hasFocusedWork}
          press$={controlsFor.press$}
        />
      )}
      {step$ !== undefined && (
        <div class="block-arrows" role="group" aria-label={`Reorder ${label}`}>
          <button type="button" aria-label={`Move ${label} up`} {...up} disabled={first} onClick$={() => step$(id, -1)}>
            ↑
          </button>
          <button type="button" aria-label={`Move ${label} down`} {...down} disabled={last} onClick$={() => step$(id, 1)}>
            ↓
          </button>
        </div>
      )}
      <div class="standing-toolbar" role="toolbar" aria-label="Standing" data-standing-toolbar>
        {restore$ !== undefined ? (
          <button type="button" data-block-restore onClick$={() => restore$(id)}>
            Restore
          </button>
        ) : (
          <>
            {remove$ !== undefined && (
              <button type="button" data-block-remove aria-label="Remove" title="Remove" onClick$={() => remove$(id)}>
                <Icon name="x" size={14} />
              </button>
            )}
            {/* A prompt is set back from its own bar: *Keep as content*
                returns it to keep and *Fixate* fixates it, the bar above the
                document carrying no standing of its own. *Send* alone makes
                one. DO_0031_002 */}
            {fixate$ !== undefined && standing === "prompt" && (
              <>
                <button
                  type="button"
                  data-standing-option="keep"
                  aria-label="Keep as content"
                  title="Keep as content"
                  onClick$={() => fixate$(id, "keep")}
                >
                  <span aria-hidden="true">{CONTROL_GLYPH.keep}</span>
                </button>
                <button
                  type="button"
                  data-standing-option="fixate"
                  aria-label="Fixate"
                  title="Fixate"
                  aria-pressed="false"
                  onClick$={() => fixate$(id, "fixate")}
                >
                  <span aria-hidden="true">{CONTROL_GLYPH.fixate}</span>
                </button>
              </>
            )}
            {fixate$ !== undefined && standing !== null && standing !== "prompt" && (
              <button
                type="button"
                data-standing-option="fixate"
                aria-label={fixated ? "Unfixate" : "Fixate"}
                title={fixated ? "Unfixate" : "Fixate"}
                aria-pressed={fixated ? "true" : "false"}
                onClick$={() => fixate$(id, fixated ? "keep" : "fixate")}
              >
                <span aria-hidden="true">{CONTROL_GLYPH.fixate}</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
});

/**
 * The bar's width, written on its row as `--block-bar-width` for the depth's
 * categories to stand before it: on the row's style, which no render owns.
 * Called as the bar is drawn, never as a visible task — one on the row being
 * edited held up the hand-over of a proposal typed into — and kept while the
 * bar stands; once it has gone the width is taken away. Only a row the
 * categories can stand on asks for it. BO_0315_013
 */
const measureBar = (element: Element): void => {
  const bar = element as HTMLElement;
  if (typeof bar.getBoundingClientRect !== "function") return;
  const row = bar.parentElement;
  const Observer = bar.ownerDocument?.defaultView?.ResizeObserver;
  if (row === null) return;
  const measure = () => row.style.setProperty("--block-bar-width", `${bar.offsetWidth}px`);
  measure();
  if (Observer === undefined) return;
  const observer = new Observer(() => {
    if (!bar.isConnected) {
      observer.disconnect();
      if (row.querySelector("[data-block-bar]") === null) row.style.removeProperty("--block-bar-width");
      return;
    }
    measure();
  });
  observer.observe(bar);
};
