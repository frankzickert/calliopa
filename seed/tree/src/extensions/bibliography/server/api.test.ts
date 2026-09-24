import { describe, expect, it } from "vitest";

import { parseWorkCommand } from "./api";

/** The commands as this extension's route parses them (`BO_0291_016`). */
describe("parseWorkCommand", () => {
  it("reads the three commands with what each needs", () => {
    expect(parseWorkCommand({ command: "addWork", record: { title: "T", kind: "book" } })).toEqual({
      command: { command: "addWork", record: { title: "T", kind: "book" } },
    });
    expect(parseWorkCommand({ command: "reviseWork", workId: "w", baseRevisionId: "r", record: { title: "T", kind: "book" } })).toEqual({
      command: { command: "reviseWork", workId: "w", baseRevisionId: "r", record: { title: "T", kind: "book" } },
    });
    expect(parseWorkCommand({ command: "retireWork", workId: "w", baseRevisionId: "r" })).toEqual({
      command: { command: "retireWork", workId: "w", baseRevisionId: "r" },
    });
  });

  it("refuses what is not one of them, and one missing what it needs", () => {
    expect(parseWorkCommand({ command: "declareRelation" })).toEqual({ failure: "declareRelation is not a command of this extension" });
    expect(parseWorkCommand({ command: "addWork" })).toEqual({ failure: "an addWork command carries a record" });
    expect(parseWorkCommand({ command: "reviseWork", workId: "w" })).toEqual({ failure: "a reviseWork command names the baseRevisionId it read" });
    expect(parseWorkCommand({ command: "retireWork", baseRevisionId: "r" })).toEqual({ failure: "a retireWork command names the workId" });
    expect(parseWorkCommand("x")).toEqual({ failure: "a command is an object" });
  });
});
