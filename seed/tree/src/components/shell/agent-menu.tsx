import {
  $,
  component$,
  sync$,
  useId,
  useSignal,
  useStore,
  type QRL,
} from "@builder.io/qwik";

import { axesOf, faceOf, menuKey, pick, roomFor, type MenuStep } from "~/lib/agent-menu";
import type { SelectableRuntime } from "~/lib/connections";
import { Icon, isIconName } from "./icons";

/**
 * Which agent performs the next command: a dropdown of three, each shown by
 * its character's face (`AGENT_FACES`, where the crops are recorded).
 *
 * A native `select` cannot show a face, so this is the select-only combobox
 * pattern — a button naming the chosen agent, and a listbox opening upward
 * from the dock. Every decision is `menuKey`'s and `pick`'s; this component
 * draws their answers and sends the keys. It is its own component so that it
 * can be pressed in a test (`BO_0224_009`).
 *
 * An agent that cannot run is listed, dimmed, with its reason as text under
 * its name — never a `title`, which no touch screen can hover (`BO_0225_004`)
 * — and `aria-disabled` rather than removed, so it is still reached and read.
 * Every attribute is set unconditionally: a conditional JSX spread is what
 * made the optimizer emit `value` twice in the control this replaces.
 * BO_0228_011
 *
 * What can run changes while the page is open — a sign-in in the settings
 * row, another tab, the agent's container — so every opening asks
 * `refresh$` for the list again and shows the one it holds meanwhile, and a
 * choice the held list refuses asks again before refusing: a press racing
 * the read is not lost. CA_0052_001
 */
export const AgentMenu = component$<{
  runtimes: readonly SelectableRuntime[];
  value: string | null;
  disabled: boolean;
  onChoose$: QRL<(agent: string) => void>;
  /** Reads the list again, answering it, or null when it could not. */
  refresh$: QRL<() => Promise<readonly SelectableRuntime[] | null>>;
  /** What the reader has chosen on the chosen sender's axes. BO_0279_007 */
  options?: Readonly<Record<string, string>>;
  onOption$?: QRL<(axis: string, value: string) => void>;
}>(({ runtimes, value, disabled, onChoose$, refresh$, options, onOption$ }) => {
  const axes = axesOf(runtimes, value);
  const listId = useId();
  const root = useSignal<HTMLElement>();
  const button = useSignal<HTMLButtonElement>();
  const menu = useStore({ open: false, active: 0 });
  const list = useSignal<HTMLElement>();

  /**
   * Where the list will fit, measured when it opens (`BO_0273_036`).
   *
   * The menu opened upward always, which was right in the composer at the foot
   * of the page and wrong on a block: a chip near the top of the document
   * pushed the list off the screen, and the models made the list long enough
   * that it happened on most blocks. So it opens on whichever side has more
   * room, is never taller than that room, and scrolls inside it; and it is
   * pulled back from the right edge when it would cross it.
   */
  const fit = $(() => {
    const anchor = button.value;
    const drawn = list.value;
    if (anchor === undefined || drawn === undefined || typeof window === "undefined") return;
    const rect = anchor.getBoundingClientRect();
    const held = roomFor(rect, drawn.offsetWidth, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    drawn.dataset["side"] = held.side;
    drawn.dataset["from"] = held.from;
    drawn.style.setProperty("--agent-menu-room", `${held.room}px`);
  });

  const apply = $(async (step: MenuStep | null) => {
    if (step === null) return;
    // Not awaited: the list opens on what it holds, and the answer redraws it.
    if (!menu.open && step.state.open) void refresh$();
    menu.open = step.state.open;
    menu.active = step.state.active;
    if (step.choose !== null) await onChoose$(step.choose);
  });
  const choose = $(async (index: number) => {
    const held = runtimes[index];
    if (held !== undefined && !held.selectable) {
      const read = await refresh$();
      const again = read?.findIndex((runtime) => runtime.id === held.id) ?? -1;
      if (read !== null && read[again]?.selectable) {
        await apply(pick(read, again));
        return;
      }
    }
    await apply(pick(runtimes, index));
  });

  if (runtimes.length === 0) return null;
  const chosen = runtimes.find((runtime) => runtime.id === value) ?? null;
  const optionId = (index: number) =>
    `${listId}-${runtimes[index]?.id ?? index}`;

  return (
    <div
      class="agent-menu"
      ref={root}
      data-open={menu.open ? "true" : "false"}
      document:onPointerDown$={(event) => {
        // A press outside closes the list with the choice unchanged.
        if (menu.open && !root.value?.contains(event.target as Node))
          menu.open = false;
      }}
    >
      <button
        type="button"
        ref={button}
        class="agent-menu__button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={menu.open ? "true" : "false"}
        aria-controls={listId}
        aria-activedescendant={menu.open ? optionId(menu.active) : undefined}
        aria-label={`Agent: ${chosen?.label ?? "none"}`}
        data-agent-menu
        data-chosen={chosen?.id ?? ""}
        disabled={disabled}
        onKeyDown$={[
          // The default must go synchronously — a `$`-handler's
          // preventDefault() runs after the page has already scrolled or
          // the button been pressed — and a sync$ handler captures nothing,
          // so it reads what it needs from the element.
          sync$((event: KeyboardEvent, element: HTMLElement) => {
            const open = element.getAttribute("aria-expanded") === "true";
            if (
              ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(
                event.key,
              ) ||
              (open && event.key === "Escape")
            ) {
              event.preventDefault();
            }
          }),
          $((event: KeyboardEvent) =>
            menu.open && (event.key === "Enter" || event.key === " ")
              ? choose(menu.active)
              : apply(menuKey(runtimes, value, menu, event.key)),
          ),
        ]}
        onClick$={() => {
          if (menu.open) {
            menu.open = false;
            return;
          }
          const index = runtimes.findIndex((runtime) => runtime.id === value);
          menu.active = Math.max(0, index);
          menu.open = true;
          void refresh$();
          // After the list is drawn, so it has a width and a height to
          // measure. A frame when there is one to wait for, and otherwise a
          // task: the render harness has no animation frames.
          if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => void fit());
          else setTimeout(() => void fit(), 0);
        }}
      >
        {/* An agent wears its own face; a contributed sender wears the icon it
            declared, because it has no face and a borrowed one would say it
            was an agent. BO_0273_035 */}
        {chosen?.icon !== undefined && isIconName(chosen.icon) ? (
          <Icon name={chosen.icon} size={20} />
        ) : (
          <img
            class="agent-menu__face"
            src={faceOf(chosen?.id ?? null)}
            alt=""
            width={28}
            height={28}
          />
        )}
        <Icon name="caret-down" size={12} />
      </button>
      <ul
        ref={list}
        class="agent-menu__list"
        id={listId}
        role="listbox"
        aria-label="Agents"
        hidden={!menu.open}
        // Pressing an option must not take focus from the button, which
        // holds the keys and the active descendant.
        preventdefault:mousedown
      >
        {runtimes.map((runtime, index) => (
          <li
            key={runtime.id}
            id={optionId(index)}
            class="agent-menu__option"
            role="option"
            aria-selected={runtime.id === value ? "true" : "false"}
            aria-disabled={runtime.selectable ? "false" : "true"}
            data-agent={runtime.id}
            data-active={menu.open && index === menu.active ? "true" : "false"}
            onClick$={async () => {
              await choose(index);
              button.value?.focus();
            }}
          >
            {runtime.icon !== undefined && isIconName(runtime.icon) ? (
              <span class="agent-menu__face agent-menu__face--icon">
                <Icon name={runtime.icon} size={24} />
              </span>
            ) : (
              <img
                class="agent-menu__face"
                src={faceOf(runtime.id)}
                alt=""
                width={40}
                height={40}
              />
            )}
            <span class="agent-menu__text">
              <span class="agent-menu__name">{runtime.label}</span>
              {runtime.reason !== null && (
                <span class="agent-menu__reason">{runtime.reason}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {/* What the chosen sender lets a person decide before the press: its own
          axes, with the values that model takes (`BO_0279_007`). An agent has
          none and this draws nothing. The press is *Send*, which stands beside
          this menu in the same chip — the whole gesture is one.

          They stand in the chip rather than inside the list, because choosing
          closes the list (`pick`): drawn there they could only ever be seen
          before a model was chosen, which is to say never. */}
      {axes.length > 0 && (
        <div class="agent-menu__options" data-agent-options>
          {axes.map((axis) => (
            // The value is what shows — `1:1`, `2k` — because the chip is one
            // line of 24px controls and a visible label would crowd it out.
            // The label is the control's name, for a reader who cannot see
            // which axis a value belongs to.
            <select
              key={axis.axis}
              class="agent-menu__option-control"
              data-agent-axis={axis.axis}
              aria-label={axis.label}
              title={axis.label}
              value={options?.[axis.axis] ?? axis.start ?? ""}
              disabled={disabled}
              onChange$={(_, element) => onOption$?.(axis.axis, element.value)}
            >
              {/* An axis with one value is a control rather than a hidden one,
                  so the chip keeps its shape as the model changes. */}
              {axis.values.map((held) => (
                <option key={held} value={held}>
                  {held}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}
    </div>
  );
});
