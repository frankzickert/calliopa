import { describe, expect, it } from "vitest";

import {
  changeFilterOf,
  filterChanges,
  groupChanges,
  isDefaultChangeFilter,
  statusOf,
  toggleChangeStatus,
} from "./changes";
import type { ChangeDocumentSummary } from "./library";

const change = (
  title: string,
  extension: string,
  status: ChangeDocumentSummary["status"],
): ChangeDocumentSummary => ({
  documentId: title.toLowerCase(),
  title,
  change: extension,
  status,
  revisedAt: 0,
});

describe("the change filter", () => {
  it("Given nothing stored, Then the default lists what is open and hides what is finished", () => {
    expect(changeFilterOf(null)).toEqual(["idea", "draft", "ready", "wip"]);
    expect(changeFilterOf(undefined)).toEqual(["idea", "draft", "ready", "wip"]);
    expect(isDefaultChangeFilter(changeFilterOf(null))).toBe(true);
  });

  it("Given a stored set, Then it reads back in the vocabulary's order with unknown values dropped", () => {
    expect(changeFilterOf(["completed", "idea", "gone"])).toEqual(["idea", "completed"]);
    expect(isDefaultChangeFilter(["wip", "ready", "draft", "idea"])).toBe(true);
    expect(isDefaultChangeFilter(["idea", "completed"])).toBe(false);
    expect(changeFilterOf([])).toEqual([]);
  });

  it("Given a toggle, Then one status flips and the order stays the vocabulary's", () => {
    expect(toggleChangeStatus(["idea", "wip"], "completed")).toEqual(["idea", "wip", "completed"]);
    expect(toggleChangeStatus(["idea", "wip", "completed"], "idea")).toEqual(["wip", "completed"]);
  });

  it("Given changes and a set, Then only those statuses list", () => {
    const changes = [change("A", "x", "idea"), change("B", "x", "completed"), change("C", "x", "rejected")];
    expect(filterChanges(changes, changeFilterOf(null)).map((c) => c.title)).toEqual(["A"]);
    expect(filterChanges(changes, ["completed", "rejected"]).map((c) => c.title)).toEqual(["B", "C"]);
  });
});

describe("grouping changes under extensions", () => {
  it("Given changes naming known and unknown extensions, Then each goes under its extension by title and the rest under other", () => {
    const grouped = groupChanges(
      [
        change("b-second", "ui.shell", "wip"),
        change("A-first", "ui.shell", "idea"),
        change("Gone", "retired-ext", "completed"),
        change("Video", "calliopa-video", "draft"),
      ],
      ["ui.shell", "calliopa-video", "settings"],
    );
    expect(grouped.byExtension.get("ui.shell")?.map((c) => c.title)).toEqual(["A-first", "b-second"]);
    expect(grouped.byExtension.get("calliopa-video")?.map((c) => c.title)).toEqual(["Video"]);
    expect(grouped.byExtension.get("settings")).toEqual([]);
    expect(grouped.other.map((c) => `${c.change}/${c.title}`)).toEqual(["retired-ext/Gone"]);
  });

  it("Given a stored status, Then it reads as itself and anything else as idea", () => {
    expect(statusOf("ready")).toBe("ready");
    expect(statusOf(undefined)).toBe("idea");
    expect(statusOf("done")).toBe("idea");
  });
});
