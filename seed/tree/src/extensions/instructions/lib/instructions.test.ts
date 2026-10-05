import { describe, expect, it } from "vitest";

import { startingInstruction, type InstructionChoices } from "./instructions";

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const choices = (extra: Partial<InstructionChoices>): InstructionChoices => ({
  reachable: true,
  isInstruction: false,
  instructions: [
    { id: A, title: "A", matches: false },
    { id: B, title: "B", matches: false },
  ],
  last: null,
  ...extra,
});

// What a command carrying no choice starts with (`calliopa-bootstrap`'s
// `BO_0349_031`).
describe("startingInstruction", () => {
  it("Given an instruction standing, Then it, over the person's last", () => {
    expect(startingInstruction(choices({ standing: A, last: B }))).toBe(A);
  });

  it("Given none standing, Then the person's last", () => {
    expect(startingInstruction(choices({ standing: null, last: B }))).toBe(B);
  });

  it("Given one standing or last that is no instruction any more, Then the next, or none", () => {
    expect(startingInstruction(choices({ standing: "gone", last: B }))).toBe(B);
    expect(startingInstruction(choices({ standing: null, last: "gone" }))).toBeNull();
  });
});
