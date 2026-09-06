import { describe, expect, it } from "vitest";
import {
  activeProcessCount,
  allowedTransitions,
  canTransition,
  describeProcess,
  isActive,
  isTerminal,
  PROCESS_STATES,
  tabProcessState,
  type ProcessRecord,
  type ProcessState,
} from "./process";

const EXPECTED: Record<ProcessState, ProcessState[]> = {
  queued: ["running", "failed", "cancelled"],
  running: ["waiting-for-input", "completed", "failed", "cancelled"],
  "waiting-for-input": ["running", "completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

describe("process state model", () => {
  it("Given every state pair, Then the transition rule is exhaustive", () => {
    const decided = PROCESS_STATES.flatMap((from) =>
      PROCESS_STATES.map((to) => ({
        pair: `${from} → ${to}`,
        allowed: canTransition(from, to),
        expected: EXPECTED[from].includes(to),
      })),
    );

    expect(decided).toHaveLength(36);
    expect(
      decided.filter(({ allowed, expected }) => allowed !== expected),
    ).toEqual([]);
  });

  it("Given a state, Then no state transitions to itself", () => {
    for (const state of PROCESS_STATES) {
      expect(canTransition(state, state), state).toBe(false);
    }
  });

  it("Given an outcome state, Then it is terminal and inactive", () => {
    for (const state of ["completed", "failed", "cancelled"] as const) {
      expect(allowedTransitions(state)).toEqual([]);
      expect(isTerminal(state), state).toBe(true);
      expect(isActive(state), state).toBe(false);
    }
  });

  it("Given a state before an outcome, Then it is active", () => {
    for (const state of ["queued", "running", "waiting-for-input"] as const) {
      expect(isActive(state), state).toBe(true);
    }
  });
});

const process = (
  state: ProcessState,
  overrides: Partial<ProcessRecord> = {},
): ProcessRecord => ({
  id: `process-${state}`,
  workspaceId: "workspace",
  title: "Render opening",
  state,
  step: "rendering frame 12",
  error: null,
  itemId: "placeholder-scene",
  itemKind: "storyboard",
  acknowledged: false,
  createdAt: "2026-08-29T10:00:00.000Z",
  updatedAt: "2026-08-29T10:00:00.000Z",
  ...overrides,
});

const boardTab = { itemId: "placeholder-scene", kind: "storyboard" } as const;

describe("registry projections", () => {
  it("Given mixed states, When the header counts, Then only unfinished work counts", () => {
    expect(
      activeProcessCount([
        process("queued"),
        process("running"),
        process("waiting-for-input"),
        process("completed"),
        process("failed"),
        process("cancelled"),
      ]),
    ).toBe(3);
  });

  it("Given work on an open item, Then its tab marks running until it finishes", () => {
    expect(tabProcessState([process("running")], boardTab)).toBe("running");
    expect(tabProcessState([process("completed")], boardTab)).toBe(null);
    expect(
      tabProcessState([process("running")], { itemId: null, kind: "script" }),
    ).toBe(null);
    expect(
      tabProcessState(
        [process("running", { itemId: "other-scene" })],
        boardTab,
      ),
    ).toBe(null);
  });

  it("Given a failure, Then the tab keeps marking it until it is acknowledged", () => {
    const failed = process("failed", { error: "no renderer" });
    expect(tabProcessState([process("running"), failed], boardTab)).toBe(
      "failed",
    );
    expect(
      tabProcessState(
        [process("running"), { ...failed, acknowledged: true }],
        boardTab,
      ),
    ).toBe("running");
  });

  it("Given a console entry, Then it reports title, state and step", () => {
    expect(describeProcess(process("running"))).toBe(
      "Render opening — running · rendering frame 12",
    );
    expect(describeProcess(process("queued", { step: null }))).toBe(
      "Render opening — queued",
    );
  });
});
