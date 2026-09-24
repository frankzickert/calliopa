import { component$, type QRL } from "@builder.io/qwik";

import { otherSpeed, SPEED_LABEL, type Speed } from "~/lib/agent-menu";
import { Icon } from "./icons";

/**
 * How the next command asks its agent to work, beside the agent menu: one
 * button showing the speed it holds — `lightning` for *Fast*, `hourglass-medium`
 * for *Thorough* — and switching to the other when pressed. Its name says the
 * speed and its title what a press does, since the icon alone says neither.
 * It is its own component so that the composer and a block's command control
 * draw the same control, and so that it can be pressed in a test. BO_0269_015
 */
export const SpeedToggle = component$<{
  value: Speed;
  disabled: boolean;
  onChoose$: QRL<(speed: Speed) => void>;
}>(({ value, disabled, onChoose$ }) => {
  const next = otherSpeed(value);
  return (
    <button
      type="button"
      class="speed-toggle"
      data-speed={value}
      aria-label={`Speed: ${SPEED_LABEL[value]}`}
      title={`${SPEED_LABEL[value]} — press for ${SPEED_LABEL[next].toLowerCase()}`}
      disabled={disabled}
      onClick$={() => onChoose$(next)}
    >
      <Icon name={value === "fast" ? "lightning" : "hourglass-medium"} />
    </button>
  );
});
