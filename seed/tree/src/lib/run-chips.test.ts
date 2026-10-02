import { describe, expect, it } from "vitest";

import { replayChipsKey, type RunChip } from "~/components/shell/view-bridge";
import { chipsFor } from "./run-chips";
import type { Tab } from "./tabs";

/** A replay's tab reads the chips its view reported under the tab, never the
 * document's own, so the two tabs never speak for each other. BO_0340_004 */
describe("the run chips of a replay's tab", () => {
  const own: Tab = { id: "documents:document-doc-1", kind: "documents:document", title: "Draft", itemId: "doc-1", viewType: "block-editor", selection: null, drawerContext: null, unsaved: false };
  const replay: Tab = { ...own, id: "replay-tab-r1", replay: "r1" };
  const chip = (key: string): RunChip => ({ key, group: key, face: { kind: "icon", icon: "sparkle" }, text: key }) as unknown as RunChip;
  const byItem = { "doc-1": [chip("live")], [replayChipsKey(replay.id)]: [chip("replayed")] };
  it("Given chips reported for the document and for its replay, Then each tab reads its own", () => {
    expect(chipsFor(byItem, own).map((entry) => entry.key)).toEqual(["live"]);
    expect(chipsFor(byItem, replay).map((entry) => entry.key)).toEqual(["replayed"]);
    expect(chipsFor({}, replay)).toEqual([]);
  });
});
