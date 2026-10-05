import { describe, expect, it } from "vitest";

import { APPLY_A_STRUCTURE, BUILTIN_INSTRUCTIONS, EXTEND_A_STRUCTURE, FILL_A_FIELD_INSTRUCTION, INSTRUCTION_STRUCTURE, SHAPE_AN_INSTRUCTION } from "../lib/instructions";
import { builtinGuard, builtinInstructionsStatement } from "./builtins";

// The built-in instructions the drops run under (`calliopa-bootstrap`'s
// `BO_0349_033`): made once where an instance holds none, never written over.
describe("builtinInstructionsStatement", () => {
  it("Given an instance holding none, Then Fill a field is made under its fixed id as an instruction using Instruction, its words one block each in order", () => {
    let minted = 0;
    const made = builtinInstructionsStatement(new Set(), () => `blk-${(minted += 1)}`);
    const fill = BUILTIN_INSTRUCTIONS.find((release) => release.id === FILL_A_FIELD_INSTRUCTION)!;
    expect(made.parameters["i0_id"]).toBe(FILL_A_FIELD_INSTRUCTION);
    expect(made.parameters["i0_title"]).toBe("Fill a field");
    expect(made.parameters["i0_record"]).toBe("instruction");
    expect(made.statement).toContain('CREATE (i0:document {id: $i0_id, title: $i0_title, record: $i0_record, status: "established"})');
    expect(made.parameters["i0s"]).toBe(`node:${INSTRUCTION_STRUCTURE}`);
    expect(made.statement).toContain("RELATE i0ref -[i0h:hasBlockRole]-> i0s");
    const words = fill.words.map((_, at) => (made.parameters[`i0b${at}_runs`] as { text: string }[])[0]!.text);
    expect(words).toEqual(fill.words);
    const orders = fill.words.map((_, at) => made.parameters[`i0b${at}_order`] as string);
    expect([...orders].sort()).toEqual(orders);
  });

  it("Given an instance that holds the first three, Then only Apply a structure is made (BO_0349_012)", () => {
    const made = builtinInstructionsStatement(new Set([FILL_A_FIELD_INSTRUCTION, SHAPE_AN_INSTRUCTION, EXTEND_A_STRUCTURE]));
    expect(made.parameters["i0_id"]).toBeUndefined();
    expect(made.parameters["i2_id"]).toBeUndefined();
    expect(made.parameters["i3_id"]).toBe(APPLY_A_STRUCTURE);
    expect(made.parameters["i3_title"]).toBe("Apply a structure");
  });

  it("Given an instance that holds them all, Then nothing is written", () => {
    expect(builtinInstructionsStatement(new Set(BUILTIN_INSTRUCTIONS.map((release) => release.id))).statement).toBe("");
  });
});

// A built-in instruction is never deleted (`BO_0349_035`).
describe("builtinGuard", () => {
  it("Given a built-in instruction, Then it is undeletable, with why", () => {
    expect(builtinGuard(FILL_A_FIELD_INSTRUCTION).undeletable).toBe("Fill a field is built in: the drops that start work run under it, so revise it rather than deleting it.");
  });

  it("Given any other document, Then nothing is fixed", () => {
    expect(builtinGuard("00000000-0000-4000-8000-000000000000")).toEqual({ blocks: {} });
  });
});

