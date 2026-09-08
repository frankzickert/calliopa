import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseDocument, taskIdsIn } from "./parse";

/**
 * The fixtures are real documents of the calliopa-bootstrap repository,
 * copied at their revision of 2026-09-07: the protocol is tested against
 * text written under it, not against examples invented to pass.
 */
const fixture = (path: string): string =>
  readFileSync(new URL(`./fixtures/${path}`, import.meta.url), "utf8");

describe("parsing the live-line protocol", () => {
  const kernel = parseDocument("docs/system/ui-kernel.md", fixture("docs/system/ui-kernel.md"));
  const distribution = parseDocument("docs/system/distribution.md", fixture("docs/system/distribution.md"));
  const change = parseDocument(
    "docs/changes/completed/BO_0200_FEAT_calliopa-app-in-the-graph.md",
    fixture("docs/changes/completed/BO_0200_FEAT_calliopa-app-in-the-graph.md"),
  );
  const second = parseDocument("docs/changes/BO_0075_FEAT_second-cell.md", fixture("docs/changes/BO_0075_FEAT_second-cell.md"));

  it("Given a system document, Then every list item is a live line with its marker and state", () => {
    expect(kernel.title).toBe("UI Kernel");
    expect(kernel.lines).toHaveLength(126);
    expect(kernel.lines.filter((line) => line.state === "open")).toHaveLength(1);
    expect(kernel.lines.filter((line) => line.state === "claimed")).toHaveLength(4);
    expect(kernel.lines.filter((line) => line.marker === "fixed").length).toBeGreaterThan(5);
    expect(kernel.status).toBeNull();
  });

  it("Given a line carrying task identifiers, Then they are collected in order and once", () => {
    expect(kernel.tasks).toHaveLength(100);
    const claimed = kernel.lines.find((line) => line.state === "claimed");
    expect(claimed?.tasks[0]).toMatch(/^BO_\d{4}_\d{3}$/u);
    expect(taskIdsIn("BO_0001_002 and BO_0001_002 again, then BO_0003_001")).toEqual(["BO_0001_002", "BO_0003_001"]);
  });

  it("Given headings, Then a line knows the section it sits under", () => {
    const open = distribution.lines.find((line) => line.state === "open");
    expect(open?.section).toBe("Open Work");
    expect(distribution.lines).toHaveLength(53);
    expect(distribution.lines.filter((line) => line.state === "open")).toHaveLength(2);
  });

  it("Given a change document, Then its status line and intent are read", () => {
    expect(change.status).toBe("completed");
    expect(change.title).toBe("BO_0200_FEAT_calliopa-app-in-the-graph");
    expect(change.lines).toHaveLength(43);
    expect(change.blocks.some((block) => block.kind === "prose" && !block.code)).toBe(true);
  });

  it("Given functional-question lines, Then they are questions", () => {
    expect(second.lines.filter((line) => line.question)).toHaveLength(4);
  });

  it("Given an indented continuation, Then it belongs to the line above it", () => {
    const parsed = parseDocument("docs/system/x.md", "## S\n\n- [ ] BO_0001_001 A line\n  that continues here.\n- A second line.\n");
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[0]?.text).toBe("BO_0001_001 A line that continues here.");
    expect(parsed.lines[0]?.state).toBe("open");
    expect(parsed.lines[1]?.marker).toBe("mutable");
  });
});
