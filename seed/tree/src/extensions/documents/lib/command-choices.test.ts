import { describe, expect, it } from "vitest";
import { commandChoiceKey, readStoredChoice, resolveChoice, sendName, storedChoice } from "./command-choices";

const consolidating = { field: "consolidate", work: "understand" } as const;

// How a block is sent and in which mode, remembered per block. DO_0025_002
// DO_0025_003
describe("a block's command choices", () => {
  it("Given a block never sent and nothing on the device, Then Keep as content is off and the mode is the document's last sent, or explore + create", () => {
    expect(resolveChoice({}, [], "blk-a", undefined, consolidating)).toEqual({ keep: false, mode: consolidating, stored: false });
    expect(resolveChoice({}, [], "blk-a", undefined, null)).toEqual({ keep: false, mode: { field: "explore", work: "create" }, stored: false });
  });

  it("Given a block sent and kept as content, Then it reads Keep as content on and the mode of its latest run; sent as a prompt, off", () => {
    const runs = [
      { source: "blk-a", startedAt: 1, mode: { field: "explore", work: "understand" } },
      { source: "blk-a", startedAt: 5, mode: consolidating },
      { source: "blk-b", startedAt: 9, mode: { field: "explore", work: "create" } },
    ];
    expect(resolveChoice({}, runs, "blk-a", "keep", null)).toEqual({ keep: true, mode: consolidating, stored: false });
    expect(resolveChoice({}, runs, "blk-a", "prompt", null).keep).toBe(false);
  });

  it("Given what the device holds, Then it wins over what was sent", () => {
    const stored = readStoredChoice(storedChoice({ keep: false, mode: consolidating }));
    expect(resolveChoice(stored, [{ source: "blk-a", startedAt: 1 }], "blk-a", "keep", null)).toEqual({ keep: false, mode: consolidating, stored: true });
    expect(readStoredChoice("not json")).toEqual({});
    expect(readStoredChoice(JSON.stringify({ keep: "yes", mode: { field: "sideways", work: "create" } }))).toEqual({});
    expect(commandChoiceKey("doc-1", "blk-a")).toBe("calliopa.command.doc-1.blk-a");
  });

  it("Given the toggle, Then Send is named for the way it sends", () => {
    expect(sendName(false, "Ctrl+Enter")).toBe("Send as prompt · Ctrl+Enter");
    expect(sendName(true, "⌘+Enter")).toBe("Send, keep as content · ⌘+Enter");
  });
});
