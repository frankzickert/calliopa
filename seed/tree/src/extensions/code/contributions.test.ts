import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { idleWords } from "./lib/types";
import { OTHER_IMAGE, SUGGESTED_IMAGES } from "./lib/images";

/**
 * What this extension contributes (`BO_0289_019`), read from the source
 * rather than imported, since the server contributions pull in Qwik City:
 * no party and no tool of its own — the runtimes are the kernel's, reached
 * through its code surface — a section, a provider and one place, and every
 * route forwarding to the kernel with the person's session.
 */
describe("what this extension contributes", () => {
  const server = readFileSync(new URL("./contributions.server.ts", import.meta.url), "utf8");
  const client = readFileSync(new URL("./contributions.ts", import.meta.url), "utf8");

  it("contributes no party and no tool: the runtimes are the kernel's", () => {
    expect(server).not.toMatch(/^\s*parties:/mu);
    expect(server).not.toMatch(/kernelCallback/u);
  });

  it("forwards every route to the kernel's code surface", () => {
    for (const path of ['path: "runtimes"', 'path: "runtimes/[id]/start"', 'path: "runtimes/[id]/stop"', 'path: "connection"', 'path: "interrupt"', 'path: "restart"', 'path: "executions"']) {
      expect(server).toContain(path);
    }
    expect(server).toContain("/__kernel/code/");
  });

  it("owns the Runtimes section, the session in the bar, and the send in the run place", () => {
    expect(client).toContain('name: "runtimes"');
    expect(client).toContain("provider: SessionProvider");
    expect(client).toContain("places: { run: SendControl }");
    expect(client).not.toMatch(/kinds:/u);
  });
});

describe("the images the form suggests", () => {
  it("are the Jupyter Docker Stacks, each with words, and never the free-text marker", () => {
    expect(SUGGESTED_IMAGES.length).toBeGreaterThanOrEqual(5);
    for (const suggested of SUGGESTED_IMAGES) {
      expect(suggested.image).toMatch(/^jupyter\//u);
      expect(suggested.words).not.toBe("");
      expect(suggested.image).not.toBe(OTHER_IMAGE);
    }
  });
});

describe("how long a runtime has been idle", () => {
  const record = { id: "r", name: "py", image: "i", kernelspec: null, state: "running", error: null, createdAt: "", startedAt: "2026-09-23T10:00:00Z", lastUsedAt: null, sessions: [] };
  it("counts from the last use, or the start, in words", () => {
    const at = Date.parse("2026-09-23T10:00:30Z");
    expect(idleWords(record, at)).toBe("used just now");
    expect(idleWords(record, at + 5 * 60 * 1000)).toBe("idle 6 min");
    expect(idleWords({ ...record, lastUsedAt: "2026-09-23T12:00:00Z" }, Date.parse("2026-09-23T15:00:00Z"))).toBe("idle 3 h");
    expect(idleWords({ ...record, state: "stopped" }, at)).toBe("");
  });
});
