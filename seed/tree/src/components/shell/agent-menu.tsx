import {
  $,
  component$,
  sync$,
  useId,
  useSignal,
  useStore,
  type QRL,
} from "@builder.io/qwik";

import { faceOf, menuKey, pick, type MenuStep } from "~/lib/agent-menu";
import type { SelectableRuntime } from "~/lib/connections";
import { Icon } from "./icons";

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
 */
export const AgentMenu = component$<{
  runtimes: readonly SelectableRuntime[];
  value: string | null;
  disabled: boolean;
  onChoose$: QRL<(agent: string) => void>;
}>(({ runtimes, value, disabled, onChoose$ }) => {
  const listId = useId();
  const root = useSignal<HTMLElement>();
  const button = useSignal<HTMLButtonElement>();
  const menu = useStore({ open: false, active: 0 });

  const apply = $(async (step: MenuStep | null) => {
    if (step === null) return;
    menu.open = step.state.open;
    menu.active = step.state.active;
    if (step.choose !== null) await onChoose$(step.choose);
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
            apply(menuKey(runtimes, value, menu, event.key)),
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
        }}
      >
        <img
          class="agent-menu__face"
          src={faceOf(chosen?.id ?? null)}
          alt=""
          width={28}
          height={28}
        />
        <Icon name="caret-down" size={12} />
      </button>
      <ul
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
              await apply(pick(runtimes, index));
              button.value?.focus();
            }}
          >
            <img
              class="agent-menu__face"
              src={faceOf(runtime.id)}
              alt=""
              width={40}
              height={40}
            />
            <span class="agent-menu__text">
              <span class="agent-menu__name">{runtime.label}</span>
              {runtime.reason !== null && (
                <span class="agent-menu__reason">{runtime.reason}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});
