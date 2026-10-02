import { describe, expect, it } from "vitest";

import { parseWorkCommand } from "./api";

/** The commands as this extension's route parses them (`BO_0291_016`, `BO_0313_020`). */
describe("parseWorkCommand", () => {
  it("reads adding a source and filling one, with what each needs", () => {
    expect(parseWorkCommand({ command: "addWork", record: { title: "T", kind: "interview" } })).toEqual({
      command: { command: "addWork", record: { title: "T", kind: "interview" } },
    });
    expect(parseWorkCommand({ command: "fillWork", workId: "w", baseRevisionId: "r", record: { title: "T", kind: "book" } })).toEqual({
      command: { command: "fillWork", workId: "w", baseRevisionId: "r", record: { title: "T", kind: "book" } },
    });
  });

  it("refuses what is not one of them, and one missing what it needs", () => {
    expect(parseWorkCommand({ command: "declareRelation" })).toEqual({ failure: "declareRelation is not a command of this extension" });
    expect(parseWorkCommand({ command: "retireWork", workId: "w", baseRevisionId: "r" })).toEqual({ failure: "retireWork is not a command of this extension" });
    expect(parseWorkCommand({ command: "addWork" })).toEqual({ failure: "an addWork command carries a record" });
    expect(parseWorkCommand({ command: "fillWork", workId: "w" })).toEqual({ failure: "a fillWork command names the baseRevisionId it read" });
    expect(parseWorkCommand({ command: "fillWork", baseRevisionId: "r" })).toEqual({ failure: "a fillWork command names the workId" });
    expect(parseWorkCommand("x")).toEqual({ failure: "a command is an object" });
  });
});
