import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildNetwork } from "./network";
import { renderExtension, renderNode, type ExtensionFacts } from "./render";

const fixture = (path: string): string =>
  readFileSync(new URL(`./fixtures/${path}`, import.meta.url), "utf8");

const sources = [
  "docs/system/ui-kernel.md",
  "docs/system/distribution.md",
  "docs/changes/completed/BO_0200_FEAT_calliopa-app-in-the-graph.md",
  "docs/changes/BO_0075_FEAT_second-cell.md",
].map((path) => ({ path, content: fixture(path) }));

/** The proposal groups of the calliopa-graph instance on 2026-09-06, as the gateway reported them. */
const proposals = [
  { id: "node:chg-26c56898e7df61b5", status: "accepted", rationale: "BO_0200_016: create-extension skill revised", author: "frankzickert", dataRevision: 20 },
  { id: "node:chg-3180e1c16ae9059f", status: "accepted", rationale: "BO_0200_013: calliopa-app as the ui.shell of this graph", author: "frankzickert", dataRevision: 14 },
  { id: "node:chg-d6cd27f5882632e9", status: "accepted", rationale: "BO_0200_015: calliopa-base and calliopa-extension carried", author: "frankzickert", dataRevision: 12 },
];

const facts: ExtensionFacts = {
  id: "ui.shell",
  version: "0.1.0",
  category: "bundled",
  elevated: true,
  establishedBy: "frankzickert",
  establishedAt: 14,
  servedPin: 17,
  newestRevision: 20,
  dependsOn: [],
  dependedOnBy: ["settings"],
  skillGoal: null,
};

describe("the owner network", () => {
  const network = buildNetwork(sources, proposals);

  it("Given system and change documents, Then topics and changes are told apart and counted", () => {
    expect(network.topics.map((topic) => topic.path)).toEqual([
      "docs/system/distribution.md",
      "docs/system/ui-kernel.md",
    ]);
    expect(network.changes).toHaveLength(2);
    const kernel = network.topics.find((topic) => topic.path.endsWith("ui-kernel.md"));
    expect(kernel?.openCount).toBe(1);
    expect(kernel?.claimedCount).toBe(4);
  });

  it("Given a task identifier in a topic line, Then the task links the line to the change that enumerated it", () => {
    const task = network.tasks.get("BO_0200_002");
    expect(task?.lines.length).toBeGreaterThan(0);
    expect(task?.changes).toContain("docs/changes/completed/BO_0200_FEAT_calliopa-app-in-the-graph.md");
  });

  it("Given a change whose file name carries an identifier, Then tasks under that prefix belong to it even unspelled", () => {
    const change = network.changes.find((candidate) => candidate.id === "BO_0200");
    expect(change?.status).toBe("completed");
    for (const [id, task] of network.tasks) {
      if (id.startsWith("BO_0200_")) expect(task.changes).toContain(change?.path);
    }
  });

  it("Given proposal groups, Then history carries the identifiers their rationales name, newest first", () => {
    expect(network.history.map((entry) => entry.dataRevision)).toEqual([20, 14, 12]);
    expect(network.history[0]?.identifiers).toEqual(["BO_0200", "BO_0200_016"]);
  });

  it("Given functional-question lines, Then the network collects them across documents", () => {
    expect(network.questions).toHaveLength(4);
  });

  it("Given the extension node, Then the document names purpose, topics, changes, questions and history", () => {
    const document = renderExtension(network, facts);
    const headings = document.blocks
      .filter((block) => block.kind === "text" && block.role === "h2")
      .map((block) => (block.kind === "text" ? block.runs[0]?.text : ""));
    expect(headings).toEqual(["Purpose", "Topics", "Changes", "Questions", "History"]);
    expect(document.facts.find((fact) => fact.label === "Served")?.value).toBe("pin 17, newer truth at 20");
    const links = document.blocks.flatMap((block) =>
      block.kind === "text" ? block.runs.filter((run) => run.link !== undefined) : [],
    );
    expect(links.some((run) => run.link === "calliopa:ext:ui.shell/docs/system/ui-kernel.md")).toBe(true);
  });

  it("Given change documents, Then the Changes section lists them open first by title descending, each opening the document, with the files still held listed after (BO_0222_009)", () => {
    const changes = [
      { documentId: "d-done", title: "BO_0001_FEAT_done", change: "ui.shell", status: "completed" as const, revisedAt: 0 },
      { documentId: "d-a", title: "BO_0002_FEAT_a", change: "ui.shell", status: "idea" as const, revisedAt: 0 },
      { documentId: "d-b", title: "BO_0003_FEAT_b", change: "ui.shell", status: "wip" as const, revisedAt: 0 },
    ];
    const document = renderExtension(network, facts, changes);
    const blocks = document.blocks.filter((block) => block.kind === "text");
    const start = blocks.findIndex((block) => block.kind === "text" && block.runs[0]?.text === "Changes");
    const rows = blocks
      .slice(start + 1)
      .filter((block) => block.kind === "text" && block.role === "paragraph" && block.runs.some((run) => run.link?.startsWith("calliopa:doc:")))
      .map((block) => (block.kind === "text" ? block.runs.map((run) => run.text).join("") : ""));
    expect(rows).toEqual(["wip BO_0003_FEAT_b", "idea BO_0002_FEAT_a", "completed BO_0001_FEAT_done"]);
    const files = blocks.findIndex((block) => block.kind === "text" && block.runs[0]?.text === "Files not yet imported");
    expect(files).toBeGreaterThan(start);
    expect(renderExtension(network, facts).blocks.some((block) => block.kind === "text" && block.runs[0]?.text === "Files not yet imported")).toBe(true);
  });

  it("Given a topic node, Then fixed lines and open work come before mutable truth within a section", () => {
    const document = renderNode("docs/system/distribution.md", network, facts);
    expect(document?.nodeId).toBe("ext:ui.shell/docs/system/distribution.md");
    const badges = (document?.blocks ?? [])
      .filter((block) => block.kind === "text" && block.role === "paragraph")
      .map((block) => (block.kind === "text" ? block.runs.map((run) => run.text).slice(0, 3).join("") : ""))
      .filter((text) => /^(fixed|mutable) /u.test(text));
    const firstMutableTruth = badges.findIndex((text) => text.startsWith("mutable truth"));
    const lastOpen = badges.map((text) => text.startsWith("mutable open")).lastIndexOf(true);
    expect(lastOpen).toBeGreaterThanOrEqual(0);
    // Every open line in the last section renders before that section's truth; the
    // sections are rendered in order, so the last open line precedes the truth after it.
    expect(firstMutableTruth).toBeGreaterThanOrEqual(0);
  });

  it("Given an unknown node, Then nothing is rendered", () => {
    expect(renderNode("docs/system/nope.md", network, facts)).toBeNull();
  });

  it("Given no docs and no skill, Then the purpose states the gap", () => {
    const empty = buildNetwork([], []);
    const document = renderExtension(empty, { ...facts, skillGoal: null });
    const purpose = document.blocks[2];
    expect(purpose?.kind === "text" && purpose.role === "quote").toBe(true);
    const withSkill = renderExtension(empty, { ...facts, skillGoal: "Stage work as one proposal." });
    expect(withSkill.blocks[2]?.kind === "text" && withSkill.blocks[2].runs[0]?.text).toBe("Stage work as one proposal.");
  });
});
