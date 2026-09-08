import { afterAll, describe, expect, it } from "vitest";

import { readGraphEnv } from "../../src/server/ccgw/env";
import {
  acknowledgeProcess,
  createProcess,
  listProcesses,
  readProcess,
  transitionProcess,
} from "../../src/server/processes";
import {
  createWorkspace,
  DEFAULT_WORKSPACE_ID,
  deleteWorkspace,
  readDefaultWorkspace,
  readWorkspace,
  saveWorkspace,
} from "../../src/server/workspaces";

/**
 * The shell's working state over the kernel's state record, against a real
 * kernel: `CALLIOPA_KERNEL_URL` names it (and `CALLIOPA_CCGW_URL` beside it,
 * though nothing here reads the graph). Without both the suite skips; the
 * repository's kernel harness provides them over a scratch kernel. The party
 * scenarios that stood here are the settings extension's own suite since
 * `BO_0202_011` (`src/extensions/settings/tests/behavior/parties.test.ts`).
 * `BO_0207_014`
 */

const configured = ((): boolean => {
  try {
    readGraphEnv();
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!configured)("workspaces and processes in the kernel's state record", () => {
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created) {
      try {
        await deleteWorkspace(id);
      } catch {
        // already gone
      }
    }
  });

  it("Given a first visit, Then the default workspace exists under its fixed identity and reads back the same", async () => {
    const first = await readDefaultWorkspace();
    expect(first.id).toBe(DEFAULT_WORKSPACE_ID);
    // A new workspace opens with no tabs (BO_0203_005).
    expect(first.tabs).toEqual([]);
    const again = await readDefaultWorkspace();
    expect(again.createdAt).toBe(first.createdAt);
  });

  it("Given a workspace, Then tabs and layout save, read back, and a deleted workspace is gone", async () => {
    const workspace = await createWorkspace();
    created.push(workspace.id);
    const saved = await saveWorkspace(workspace.id, {
      ...workspace,
      tabs: [
        {
          id: "t1",
          kind: "ui.shell:document",
          title: "Kept",
          itemId: null,
          selection: null,
          drawerContext: null,
          unsaved: false,
        },
      ],
      activeTabId: "t1",
    });
    expect(saved.tabs.map((tab) => tab.title)).toEqual(["Kept"]);
    const read = await readWorkspace(workspace.id);
    expect(read.activeTabId).toBe("t1");
    expect(read.createdAt).toBe(workspace.createdAt);

    await expect(
      saveWorkspace(workspace.id, { ...read, activeTabId: "nope" }),
    ).rejects.toMatchObject({ status: 400 });

    await deleteWorkspace(workspace.id);
    await expect(readWorkspace(workspace.id)).rejects.toMatchObject({ status: 404 });
    created.pop();
  });

  it("Given a workspace, Then processes are created, listed in creation order, moved by the rule, and acknowledged", async () => {
    const workspace = await createWorkspace();
    created.push(workspace.id);
    const first = await createProcess(workspace.id, { title: "Render", step: "queued up" });
    const second = await createProcess(workspace.id, { title: "Publish" });
    const listed = await listProcesses(workspace.id);
    expect(listed.map((process) => process.id)).toEqual([first.id, second.id]);

    const running = await transitionProcess(first.id, { state: "running", step: "encoding" });
    expect(running.state).toBe("running");
    await expect(
      transitionProcess(first.id, { state: "queued" }),
    ).rejects.toMatchObject({ status: 409 });
    const failed = await transitionProcess(first.id, { state: "failed", error: "the encoder said no" });
    expect(failed.error).toBe("the encoder said no");
    expect((await readProcess(first.id)).acknowledged).toBe(false);
    expect((await acknowledgeProcess(first.id)).acknowledged).toBe(true);
    await expect(acknowledgeProcess(second.id)).rejects.toMatchObject({ status: 409 });
  });
});
