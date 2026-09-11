import type { SelectableRuntime } from "./connections";

/**
 * The composer's agent dropdown, decided here and drawn by
 * `agent-menu.tsx`, which holds no decision of its own. BO_0228_011
 */

/**
 * Each agent's face: a Calliopa character, never a vendor's logo (decided
 * 2026-09-10). Square crops cut once from
 * `~/projects/calliopa-video/library/characters/`, scaled to 96 × 96 WebP,
 * twice the largest size drawn:
 *
 * - Codex is Codey: the top-left panel (front, neutral) of
 *   `codey/codey_face.png`, centred at (190, 255), 340 px square.
 * - Claude Code is Clauderic: the top-left panel of
 *   `clauderic/clauderic_face.png`, centred at (182, 195), 300 px square.
 * - Hermes is, for now, the Fairytales barista robot: the head of the front
 *   view in `ftrobot/ftrobot_turnaround.png`, centred at (350, 222), 200 px
 *   square. It has no face plate, and its visor is its face by canon.
 *
 * Cut them again from those coordinates when the characters change.
 * BO_0228_010
 */
export const AGENT_FACES = {
  codex: "/agents/codey.webp",
  "claude-code": "/agents/clauderic.webp",
  hermes: "/agents/ftrobot.webp",
} as const;

export const faceOf = (agent: string | null): string =>
  (agent !== null && Object.hasOwn(AGENT_FACES, agent)
    ? AGENT_FACES[agent as keyof typeof AGENT_FACES]
    : null) ?? AGENT_FACES.hermes;

/** Where the dropdown opens, and what the reader is told about it. */
export interface Opening {
  readonly agent: string | null;
  readonly notice: string | null;
}

/**
 * The instance's last choice when it can run. With nothing chosen, the agent
 * the gateway is running, or else the first that can run. When the choice
 * cannot run, the same fallback — and a notice that says so in words, since a
 * dropdown that quietly showed another agent would be a substitution nobody
 * made (`BO_0089_006`). BO_0228_011
 */
export function openingAgent(
  runtimes: readonly SelectableRuntime[],
  chosen: string | null,
  active: string | null,
): Opening {
  const find = (id: string | null) =>
    runtimes.find((runtime) => runtime.id === id) ?? null;
  const choice = find(chosen);
  if (choice?.selectable) return { agent: choice.id, notice: null };
  const running = find(active);
  const fallback = running?.selectable
    ? running
    : (runtimes.find((runtime) => runtime.selectable) ?? null);
  if (choice === null) {
    return {
      agent: fallback?.id ?? running?.id ?? runtimes[0]?.id ?? null,
      notice: null,
    };
  }
  const why = (choice.reason ?? `${choice.label} cannot run.`).replace(
    /\.$/,
    "",
  );
  if (fallback === null) {
    return { agent: choice.id, notice: `${why} — no agent can run a command.` };
  }
  return {
    agent: fallback.id,
    notice: `${why} — opened on ${fallback.label}.`,
  };
}

/** What the reader is told when a choice could not be remembered. */
export const CHOICE_NOT_REMEMBERED =
  "The choice of agent could not be remembered; it holds for this command.";

/**
 * Remembers a choice for every device of the instance
 * (`PUT /api/agent/choice`), answering whether it was. A choice that could not
 * be written still stands for the command at hand. BO_0228_011
 */
export async function rememberAgent(agent: string): Promise<boolean> {
  const saved = await fetch("/api/agent/choice", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent }),
  }).catch(() => null);
  return saved !== null && saved.ok;
}

/** The dropdown's own state: whether the list is open, and which option the
 * keys are on. */
export interface MenuState {
  readonly open: boolean;
  readonly active: number;
}

/** What one key does: the state after it, and the agent it chose, if any. */
export interface MenuStep {
  readonly state: MenuState;
  readonly choose: string | null;
}

/**
 * One key, as the select-only combobox pattern reads it. Closed, the arrows,
 * `Home`, `End`, `Enter` and `Space` open the list — on the chosen agent, or
 * the first or last — and a letter opens it on the agent it begins. Open, the
 * arrows, `Home` and `End` move without wrapping, a letter moves to the next
 * agent it begins, `Enter` and `Space` choose, and `Escape` and `Tab` close
 * with the choice unchanged. An agent that cannot run can be reached, so its
 * reason is read, and choosing it changes nothing and leaves the list open.
 * Anything else is not the dropdown's. BO_0228_011
 */
export function menuKey(
  runtimes: readonly SelectableRuntime[],
  value: string | null,
  state: MenuState,
  key: string,
): MenuStep | null {
  const last = runtimes.length - 1;
  if (last < 0) return null;
  const chosenIndex = Math.max(
    0,
    runtimes.findIndex((runtime) => runtime.id === value),
  );
  const letter = key.length === 1 && key !== " " ? key.toLowerCase() : null;
  const byLetter = (from: number): number => {
    for (let step = 1; step <= runtimes.length; step += 1) {
      const index = (from + step) % runtimes.length;
      if (runtimes[index]?.label.toLowerCase().startsWith(letter ?? ""))
        return index;
    }
    return from;
  };
  const stay = (active: number): MenuStep => ({
    state: { open: true, active },
    choose: null,
  });

  if (!state.open) {
    switch (key) {
      case "ArrowDown":
      case "ArrowUp":
      case "Enter":
      case " ":
        return stay(chosenIndex);
      case "Home":
        return stay(0);
      case "End":
        return stay(last);
      default:
        // From just before the chosen agent, so a letter naming it opens on it.
        return letter === null
          ? null
          : stay(byLetter((chosenIndex + last) % runtimes.length));
    }
  }
  switch (key) {
    case "ArrowDown":
      return stay(Math.min(state.active + 1, last));
    case "ArrowUp":
      return stay(Math.max(state.active - 1, 0));
    case "Home":
      return stay(0);
    case "End":
      return stay(last);
    case "Enter":
    case " ":
      return pick(runtimes, state.active);
    case "Escape":
    case "Tab":
      return { state: { open: false, active: state.active }, choose: null };
    default:
      return letter === null ? null : stay(byLetter(state.active));
  }
}

/** Choosing an option: an agent that can run closes the list and is chosen;
 * one that cannot leaves both where they were. */
export function pick(
  runtimes: readonly SelectableRuntime[],
  index: number,
): MenuStep {
  const runtime = runtimes[index];
  if (runtime === undefined || !runtime.selectable) {
    return { state: { open: true, active: index }, choose: null };
  }
  return { state: { open: false, active: index }, choose: runtime.id };
}
