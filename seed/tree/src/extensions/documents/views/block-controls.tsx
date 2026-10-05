import { $, component$, useContext, useSignal, useVisibleTask$, type QRL } from "@builder.io/qwik";

import { ActionControl } from "~/components/shell/inspector";
import { ViewBridgeContext, type BlockControl, type ViewAction } from "~/components/shell/view-bridge";
import { Marked } from "./block-text";
import type { Run } from "~/lib/runs";

/**
 * The shell's own controls for a block, drawn in the editor's row
 * (`CA_0065_009`).
 *
 * Focused work is the frame's capability, not this extension's: the shell
 * says which controls exist, what they are called and what they do, and this
 * view says where they are drawn. They render through `ActionControl`, the
 * one named-action vocabulary the inspector and the bar already share, so a
 * control the shell contributes reads as every other named action does — and
 * a reader reaches focused work on every install rather than only where a
 * decorating extension draws it.
 *
 * The row is a sibling of the standing toolbar on the block's top border, at
 * the same leading end and inside the same wrapper, so neither moves the
 * other and no control is nested in another.
 */
export const BlockControls = component$<{
  itemId: string;
  blockId: string;
  hasFocusedWork: boolean;
  press$: QRL<(control: string, blockId: string) => void>;
}>(({ itemId, blockId, hasFocusedWork, press$ }) => {
  const controls = useSignal<readonly BlockControl[]>([]);
  const reads = useSignal(0);
  const bridge = useContext(ViewBridgeContext);
  // A visible task, never a `useTask$`: Qwik holds every render the page asks
  // for until a `useTask$` settles, so a read there freezes the tabs, the
  // library and the blocks for as long as the shell takes. The row draws
  // empty until the shell answers. DO_0001
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ track }) => {
    track(() => blockId);
    track(() => hasFocusedWork);
    // The initial faces read, or a nest that gives this block a child, changes
    // the shell's label for its focused-work control. DO_0029_001
    const read = ++reads.value;
    const answer = await bridge.blockControls$(itemId, blockId);
    if (read === reads.value) controls.value = answer;
  });
  if (controls.value.length === 0) return null;
  return (
    <div class="block-controls" role="toolbar" aria-label="Block" data-block-controls>
      {controls.value.map((control) => (
        <ActionControl
          key={control.id}
          surface="block"
          action={
            {
              kind: "button",
              id: control.id,
              label: control.label,
              icon: control.icon,
              run$: $(() => press$(control.id, blockId)),
            } satisfies ViewAction
          }
        />
      ))}
    </div>
  );
});

/**
 * The face a block's focused work wears: the child's own words when it holds
 * any, else its title, under the block's own runs, which are never
 * overwritten (`CA_0065_010`). What the line says is the shell's answer; what
 * it looks like is this view's.
 */
export const BlockFace = component$<{
  itemId: string;
  title: string;
  face: readonly Run[] | null;
  /** The first words of the blocks the work holds: listed under the block in
   * place of its title, so what was nested shows where it was put.
   * BO_0349_019 */
  lines?: readonly string[] | undefined;
  open$: QRL<() => void>;
}>(({ itemId, title, face, lines, open$ }) => (
  <button
    type="button"
    class={["block-face", lines !== undefined && lines.length > 0 ? "block-face--lines" : ""]}
    data-block-face={itemId}
    aria-label={`Open ${title}`}
    onClick$={() => open$()}
  >
    {lines !== undefined && lines.length > 0 ? (
      <span class="block-face__lines">
        {lines.map((line, index) => (
          <span key={index} class="block-face__line" data-block-face-line>
            {line}
          </span>
        ))}
      </span>
    ) : face === null ? (
      title
    ) : (
      face.map((run, index) => (
        <Marked key={index} text={run.text} marks={run.marks ?? []} {...(run.link === undefined ? {} : { link: run.link })} />
      ))
    )}
  </button>
));
