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

/**
 * How a command asks its agent to work: *Fast* or *Thorough*, for every
 * agent, each mapping it to its own model and effort. Fast is preselected,
 * and the person's last speed is remembered for them by the kernel when a run
 * starts with it. Thorough is how a run worked before speeds existed.
 * BO_0269_015
 */
export type Speed = "fast" | "thorough";

export const SPEED_LABEL: Readonly<Record<Speed, string>> = { fast: "Fast", thorough: "Thorough" };

/** A speed the server answered, or fast. */
export const speedOf = (value: unknown): Speed => (value === "thorough" ? "thorough" : "fast");

/** The speed a press on the toggle leaves. */
export const otherSpeed = (speed: Speed): Speed => (speed === "fast" ? "thorough" : "fast");

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

/** What a later read of the list does to the choice. */
export interface Reread {
  readonly agent: string | null;
  readonly restored: boolean;
}

/**
 * A later read of the list, after the one the dropdown opened on. `awaiting`
 * is the instance's remembered agent the page opened away from because it
 * could not run, until the reader chooses on this page: once a read finds it
 * able to run, it is the choice again, which is what the opening notice said
 * had not happened. Anything else leaves the choice where it is — a choice the
 * reader made on this page is theirs. CA_0052_002
 */
export function rereadAgent(
  runtimes: readonly SelectableRuntime[],
  agent: string | null,
  awaiting: string | null,
): Reread {
  const remembered = runtimes.find((runtime) => runtime.id === awaiting);
  return remembered?.selectable
    ? { agent: remembered.id, restored: true }
    : { agent, restored: false };
}

/**
 * The agents as the command bar holds them: the list, the choice, the notice
 * line, and what `rereadAgent` needs — the remembered agent the page opened
 * away from, and the notice that said so, so lowering it never lowers
 * anything said since. The shell's run store is one. CA_0052_002
 */
export interface AgentList {
  runtimes: SelectableRuntime[];
  agent: string | null;
  /**
   * What the reader chose on the chosen sender's axes, by axis name
   * (`BO_0279_007`). An agent has no axes and leaves this empty; a sender's
   * axes start where the sender says and change as the reader changes them.
   */
  options: Record<string, string>;
  /** The next command's speed. BO_0269_015 */
  speed: Speed;
  notice: string | null;
  awaiting: string | null;
  openingNotice: string | null;
}

interface RuntimesAnswer {
  readonly runtimes: SelectableRuntime[];
  readonly chosen: string | null;
  readonly active: string | null;
  /** The signed-in person's last speed. BO_0269_015 */
  readonly speed?: string;
}

/** `GET /api/agent/runtimes`, or null when it could not be read. */
async function readRuntimes(): Promise<RuntimesAnswer | null> {
  const response = await fetch("/api/agent/runtimes").catch(() => null);
  if (response === null || !response.ok) return null;
  return (await response.json().catch(() => null)) as RuntimesAnswer | null;
}

/**
 * The first read, when the page opens: the list, and the agent
 * `openingAgent` opens on, with its notice. BO_0228_011 CA_0052_002
 */
export async function loadAgents(list: AgentList): Promise<void> {
  const answered = await readRuntimes();
  if (answered === null) return;
  list.runtimes = answered.runtimes;
  list.speed = speedOf(answered.speed);
  const opening = openingAgent(answered.runtimes, answered.chosen, answered.active);
  list.agent = opening.agent;
  list.awaiting = opening.notice === null ? null : answered.chosen;
  list.openingNotice = opening.notice;
  if (opening.notice !== null) list.notice = opening.notice;
}

/**
 * Every later read — the dropdown opening, a choice the held list refused, a
 * view saying the agents changed: the list as the server answers it now, and
 * the remembered agent back when it can run. A read that fails keeps the list
 * held. Answers the list read, or null. CA_0052_001 CA_0052_002
 */
export async function refreshAgents(
  list: AgentList,
): Promise<readonly SelectableRuntime[] | null> {
  const answered = await readRuntimes();
  if (answered === null) return null;
  list.runtimes = answered.runtimes;
  const reread = rereadAgent(answered.runtimes, list.agent, list.awaiting);
  if (reread.restored) {
    list.agent = reread.agent;
    list.awaiting = null;
    if (list.notice === list.openingNotice) list.notice = null;
    list.openingNotice = null;
  }
  return answered.runtimes;
}

/**
 * The reader's choice: it stands for the page — no later read takes it back
 * — and is remembered for the instance, said when it could not be, since the
 * next reload would open elsewhere. BO_0228_011 CA_0052_002
 */
export async function chooseAgent(list: AgentList, agent: string): Promise<void> {
  list.agent = agent;
  list.awaiting = null;
  // A new choice brings its own axes, starting where it says. What was chosen
  // for another model means nothing here — the values are not even the same
  // words. BO_0279_007
  list.options = startingOptions(list.runtimes, agent);
  if (!(await rememberAgent(agent))) list.notice = CHOICE_NOT_REMEMBERED;
}

/** Where a sender's controls start: its own start value, or nothing chosen. */
export function startingOptions(
  runtimes: readonly SelectableRuntime[],
  agent: string | null,
): Record<string, string> {
  const chosen = runtimes.find((runtime) => runtime.id === agent);
  const starting: Record<string, string> = {};
  for (const axis of chosen?.options ?? []) {
    if (axis.start !== null && axis.values.includes(axis.start)) starting[axis.axis] = axis.start;
  }
  return starting;
}

/** The axes the chosen sender offers, or none. */
export function axesOf(
  runtimes: readonly SelectableRuntime[],
  agent: string | null,
): readonly { readonly axis: string; readonly label: string; readonly values: readonly string[]; readonly start: string | null }[] {
  return runtimes.find((runtime) => runtime.id === agent)?.options ?? [];
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

/**
 * Where the agent list opens, and how tall it may be (`BO_0273_036`).
 *
 * It opened upward always, which was right in the composer at the foot of the
 * page and wrong on a block: a chip near the top pushed the list off the
 * screen, and the models made the list long enough for that to happen on most
 * blocks. So it opens on whichever side has more room, never asks for more
 * than that side has, and scrolls inside it. The floor keeps something to
 * scroll when a chip has almost no room either way.
 */
export interface Room {
  readonly side: "above" | "below";
  readonly room: number;
  readonly from: "left" | "right";
}

export function roomFor(
  anchor: { readonly top: number; readonly bottom: number; readonly left: number },
  width: number,
  viewport: { readonly width: number; readonly height: number },
  margin = 8,
  least = 120,
): Room {
  const above = anchor.top - margin;
  const below = viewport.height - anchor.bottom - margin;
  const side = below > above ? "below" : "above";
  return {
    side,
    room: Math.max(least, Math.floor(side === "below" ? below : above)),
    // Left-aligned to the button unless that would run past the right edge.
    from: anchor.left + width > viewport.width - margin ? "right" : "left",
  };
}
