import { describe, expect, it } from "vitest";

import { parseRoleCommand } from "../contributions.server";
import {
  offeredBy,
  offeredRoles,
  roleState,
  type DocumentRoleView,
} from "../lib/roles";

/** The acts the role page posts, read from a body (`BO_0299_018`). */
const id = "2b0c1f3a-0f6a-4d1e-9a3c-1d2e3f4a5b6c";
const other = "7e8f9a0b-1c2d-4e3f-8a5b-6c7d8e9f0a1b";

describe("parseRoleCommand", () => {
  it("reads each act with what it carries", () => {
    expect(parseRoleCommand({ command: "rename", name: "Story" })).toEqual({
      command: { command: "rename", name: "Story" },
    });
    expect(
      parseRoleCommand({ command: "describe", description: "A story" }),
    ).toEqual({ command: { command: "describe", description: "A story" } });
    expect(parseRoleCommand({ command: "retire" })).toEqual({
      command: { command: "retire" },
    });
    expect(parseRoleCommand({ command: "restore" })).toEqual({
      command: { command: "restore" },
    });
    expect(parseRoleCommand({ command: "addBlockRole", name: "Hook" })).toEqual(
      { command: { command: "addBlockRole", name: "Hook" } },
    );
    expect(
      parseRoleCommand({
        command: "renameBlockRole",
        blockRole: id,
        name: "Hook",
      }),
    ).toEqual({
      command: { command: "renameBlockRole", blockRole: id, name: "Hook" },
    });
    expect(
      parseRoleCommand({
        command: "describeBlockRole",
        blockRole: id,
        description: "Opens",
      }),
    ).toEqual({
      command: {
        command: "describeBlockRole",
        blockRole: id,
        description: "Opens",
      },
    });
    expect(
      parseRoleCommand({ command: "retireBlockRole", blockRole: id }),
    ).toEqual({ command: { command: "retireBlockRole", blockRole: id } });
    expect(
      parseRoleCommand({ command: "restoreBlockRole", blockRole: id }),
    ).toEqual({ command: { command: "restoreBlockRole", blockRole: id } });
    expect(
      parseRoleCommand({ command: "reorder", blockRoles: [other, id] }),
    ).toEqual({ command: { command: "reorder", blockRoles: [other, id] } });
  });

  it("refuses an act it does not know, and one missing what it carries, in words", () => {
    expect(parseRoleCommand({ command: "delete" })).toEqual({
      failure: "delete is not an act on a role",
    });
    expect(parseRoleCommand({ command: "rename" })).toEqual({
      failure: "rename carries a name",
    });
    expect(
      parseRoleCommand({ command: "renameBlockRole", name: "Hook" }),
    ).toEqual({ failure: "renameBlockRole names the block role by its id" });
    expect(
      parseRoleCommand({ command: "retireBlockRole", blockRole: "not-an-id" }),
    ).toEqual({ failure: "retireBlockRole names the block role by its id" });
    expect(
      parseRoleCommand({ command: "reorder", blockRoles: [id, 3] }),
    ).toEqual({
      failure: "reorder carries blockRoles, the ids in their new order",
    });
    expect(parseRoleCommand(null)).toEqual({
      failure: "null is not an act on a role",
    });
  });
});

describe("what the choices offer", () => {
  const hook = { id, name: "Hook", description: "", order: 2, retired: false };
  const closing = {
    id: other,
    name: "Closing",
    description: "",
    order: 1,
    retired: true,
  };
  const story: DocumentRoleView = {
    id: "3c3c3c3c-3c3c-4c3c-8c3c-3c3c3c3c3c3c",
    name: "Story",
    description: "",
    retired: false,
    blockRoles: [hook, closing],
  };
  const old: DocumentRoleView = {
    id: "4d4d4d4d-4d4d-4d4d-8d4d-4d4d4d4d4d4d",
    name: "Old",
    description: "",
    retired: true,
    blockRoles: [],
  };

  it("leaves retired roles out and keeps the person's order", () => {
    expect(offeredRoles([old, story]).map((role) => role.name)).toEqual([
      "Story",
    ]);
    expect(offeredBy(story).map((role) => role.name)).toEqual(["Hook"]);
    expect(
      offeredBy({
        ...story,
        blockRoles: [hook, { ...closing, retired: false }],
      }).map((role) => role.name),
    ).toEqual(["Closing", "Hook"]);
  });

  it("says what stands beside a block role's name", () => {
    expect(
      roleState({ ...hook, documentRole: story.id, offered: true }),
    ).toBeNull();
    expect(roleState({ ...hook, documentRole: story.id, offered: false })).toBe(
      "not offered",
    );
    expect(
      roleState({
        ...hook,
        documentRole: story.id,
        offered: true,
        retired: true,
      }),
    ).toBe("retired");
  });
});
