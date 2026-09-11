import { describe, expect, it } from "vitest";

import { updateCommands } from "./update-commands";

/**
 * The commands shown where the updater is absent are the README's update
 * path, with the forced tag fetch that takes a corrected release tag.
 * BO_0238_006
 */
describe("updateCommands", () => {
  it("checks out the chosen release after a forced tag fetch, then installs", () => {
    expect(updateCommands("0.3.4").split("\n")).toEqual([
      "cd ~/calliopa",
      "git fetch --tags --force && git checkout --detach v0.3.4",
      "./install.sh",
    ]);
  });
});
