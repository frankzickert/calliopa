import { describe, expect, it } from "vitest";
import { BUILTIN_STRUCTURES } from "../lib/structures";
import { builtinNamesFor } from "./migrations";

/**
 * A built-in's name and description are the release's (`calliopa-bootstrap`'s
 * `BO_0338_022`): a stored *Profile* is renamed *Instruction* on its own node,
 * its id kept; a built-in already as the release says it, and a person's own
 * structure, are left alone, and nothing to rename answers an empty script.
 */
describe("builtinNamesFor", () => {
  const stored = (id: string, name: string, description: string) => [id, { id, name, description }] as const;
  const release = (id: string) => BUILTIN_STRUCTURES.find((structure) => structure.id === id)!;

  it("Given the built-in stored as Profile, Then it is named Instruction on the same node", () => {
    const instruction = release("builtin:profile");
    const keyword = release("builtin:keyword");
    const byId = new Map([
      stored("builtin:profile", "Profile", instruction.description),
      stored("builtin:keyword", keyword.name, keyword.description),
      stored("r-mine", "Blog post", "mine"),
    ]);
    const index = BUILTIN_STRUCTURES.findIndex((structure) => structure.id === "builtin:profile");
    expect(instruction.name).toBe("Instruction");
    expect(builtinNamesFor(byId)).toEqual({
      statement: `SET n${index}.name = $n${index}Name, n${index}.description = $n${index}Description`,
      parameters: { [`n${index}NodeId`]: "node:builtin:profile", [`n${index}Name`]: "Instruction", [`n${index}Description`]: instruction.description },
    });
  });

  it("Given every built-in as the release names it, Then the script is empty", () => {
    const byId = new Map(BUILTIN_STRUCTURES.map((structure) => stored(structure.id, structure.name, structure.description)));
    expect(builtinNamesFor(byId)).toEqual({ statement: "", parameters: {} });
  });
});
