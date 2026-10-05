import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { inBackground } from "./background";

/**
 * Work the server does not wait for cannot end it: a rejected task is logged
 * with its name and subject and settles, and a rejection nothing handled is
 * logged while the process keeps running. CA_0080_003
 */
describe("work the server starts in the background", () => {
  const logged: string[] = [];
  const original = console.error;

  afterEach(() => {
    console.error = original;
    logged.length = 0;
  });

  const capture = () => {
    console.error = (...parts: unknown[]) => {
      logged.push(parts.map(String).join(" "));
    };
  };

  it("Given a task that rejects, Then it settles, and the log names the task, its subject and the reason with its cause", async () => {
    capture();
    await expect(
      inBackground("follow run", "arun-1", () => Promise.reject(new TypeError("terminated", { cause: new Error("Body Timeout Error") }))),
    ).resolves.toBeUndefined();
    expect(logged).toEqual(["background follow run (arun-1) failed: terminated: Body Timeout Error"]);
  });

  it("Given a task that throws before it returns a promise, Then it is logged the same way", async () => {
    capture();
    await inBackground("follow run", "arun-2", () => {
      throw new Error("no process");
    });
    expect(logged).toEqual(["background follow run (arun-2) failed: no process"]);
  });

  it("Given a task that succeeds, Then nothing is logged", async () => {
    capture();
    await inBackground("follow run", "arun-3", () => Promise.resolve("done"));
    expect(logged).toEqual([]);
  });
});

describe("a rejection nothing handled", () => {
  it("Given the serve entry's net, Then the rejection is logged and the process keeps running to its own end", () => {
    const module = fileURLToPath(new URL("./background.ts", import.meta.url));
    const script = `
      const { keepServingOnUnhandledRejection } = await import(${JSON.stringify(module)});
      keepServingOnUnhandledRejection();
      Promise.reject(new TypeError("terminated", { cause: new Error("Body Timeout Error") }));
      setTimeout(() => console.log("still serving"), 100);
    `;
    const run = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "--input-type=module", "-e", script], {
      encoding: "utf8",
      timeout: 15_000,
    });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("still serving");
    expect(run.stderr).toContain("unhandled rejection, still serving: terminated: Body Timeout Error");
  });
});
