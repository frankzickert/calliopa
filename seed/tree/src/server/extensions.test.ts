import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { membersByManifest, nodesOfType, parseQueryAnswer } from "./graph-gateway";
import { forTesting } from "./extensions";

/**
 * The fixtures are the gateway's own answers, recorded from the calliopa-graph
 * instance on 2026-09-07 at head 20. `sources.json` carries every source's
 * code replaced by its length: the grouping under test never reads code, and
 * the shell's own source is not a fixture worth a megabyte. BO_0201_004
 */
const recorded = (name: string): string =>
  readFileSync(new URL(`./fixtures/gateway/${name}`, import.meta.url), "utf8");

describe("reading the graph's extension namespace", () => {
  it("Given the recorded manifests answer, Then every manifest is a node with provenance", () => {
    const reply = parseQueryAnswer(recorded("manifests.json"));
    expect(reply.ok).toBe(true);
    if (!reply.ok) return;
    const manifests = nodesOfType(reply.value, "ext.manifest");
    expect(manifests.map((node) => node.revision.content["id"])).toEqual([
      "calliopa-base",
      "calliopa-extension",
      "settings",
      "ui.shell",
    ]);
    expect(manifests[3]?.revision.createdBy).toBe("frankzickert");
    expect(manifests[3]?.revision.dataRevision).toBe(14);
  });

  it("Given the recorded member pairs, Then members group by the manifest their partOf names", () => {
    const reply = parseQueryAnswer(recorded("sources.json"));
    expect(reply.ok).toBe(true);
    if (!reply.ok) return;
    const grouped = membersByManifest(reply.value);
    expect(grouped.get("node:ui.shell")).toHaveLength(190);
    expect(grouped.get("node:settings")).toHaveLength(8);
    expect(grouped.has("node:calliopa-base")).toBe(false);
  });

  it("Given the recorded skills, Then the two skill-only extensions each hold one", () => {
    const reply = parseQueryAnswer(recorded("skills.json"));
    expect(reply.ok).toBe(true);
    if (!reply.ok) return;
    const grouped = membersByManifest(reply.value);
    expect(grouped.get("node:calliopa-base")).toHaveLength(1);
    expect(grouped.get("node:calliopa-extension")).toHaveLength(1);
    expect(grouped.get("node:calliopa-base")?.[0]?.revision.content["goal"]).toMatch(/proposal/u);
  });

  it("Given the recorded pin and a manifest, Then the summary says whether newer truth waits", () => {
    const manifests = parseQueryAnswer(recorded("manifests.json"));
    const sources = parseQueryAnswer(recorded("sources.json"));
    const skills = parseQueryAnswer(recorded("skills.json"));
    const pins = parseQueryAnswer(recorded("releasepin.json"));
    if (!manifests.ok || !sources.ok || !skills.ok || !pins.ok) throw new Error("fixtures did not parse");
    const pin = nodesOfType(pins.value, "kernel.releasepin")[0]?.revision.content["pin"];
    expect(pin).toBe(17);
    const snapshot = {
      head: 20,
      manifests: nodesOfType(manifests.value, "ext.manifest"),
      membersByManifest: membersByManifest(sources.value),
      skillsByManifest: membersByManifest(skills.value),
      dependsOn: new Map<string, string[]>(),
      proposals: [],
      eventsByManifest: new Map(),
      servedPin: 17,
      elevated: ["ui.shell"],
    };
    const shell = snapshot.manifests.find((node) => node.id === "node:ui.shell");
    const extension = snapshot.manifests.find((node) => node.id === "node:calliopa-extension");
    if (shell === undefined || extension === undefined) throw new Error("manifests missing");
    // The shell's newest member revision is the README round trip at 17: current.
    expect(forTesting.summaryOf(snapshot, shell)).toMatchObject({ id: "ui.shell", category: "bundled", ahead: false });
    // The skill revision accepted at 20 is past the served pin: newer truth waits.
    expect(forTesting.summaryOf(snapshot, extension)).toMatchObject({ id: "calliopa-extension", ahead: true, newestRevision: 20 });
  });

  it("Given a refusal or a non-JSON answer, Then the reason is reported rather than thrown", () => {
    expect(parseQueryAnswer("not json")).toEqual({ ok: false, detail: "The gateway's answer was not JSON." });
    const refused = parseQueryAnswer(JSON.stringify({ status: "error", error: { message: "unknown_node_type" } }));
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.detail).toContain("unknown_node_type");
  });

  it("Given members, Then only docs and the README are read as owner docs", () => {
    const reply = parseQueryAnswer(recorded("sources.json"));
    if (!reply.ok) throw new Error("fixture did not parse");
    const docs = forTesting.docsOf(membersByManifest(reply.value).get("node:ui.shell") ?? []);
    expect(docs.map((doc) => doc.path)).toEqual(["README.md"]);
  });
});

describe("an extension's history", () => {
  it("Given metadata-only history of its members, Then superseded revisions still name the proposal that wrote them", async () => {
    const { eventsByManifest, historyOf } = await import("./extensions");
    const skills = parseQueryAnswer(recorded("skills-history.json"));
    const manifests = parseQueryAnswer(recorded("manifests-history.json"));
    const groups = parseQueryAnswer(recorded("proposals.json"));
    if (!skills.ok || !manifests.ok || !groups.ok) throw new Error("fixtures did not parse");
    const events = eventsByManifest(skills.value, manifests.value).get("node:calliopa-extension") ?? [];
    // The current skill revision, the one it superseded, and the carried one:
    // three rationales, none lost to the supersession.
    const rationales = events.map((event) => event.purpose);
    expect(rationales.some((text) => text.startsWith("BO_0201_001"))).toBe(true);
    expect(rationales.some((text) => text.startsWith("BO_0200_016"))).toBe(true);
    expect(rationales.some((text) => text.startsWith("BO_0200_015"))).toBe(true);
    const proposals = nodesOfType(groups.value, "ProposalGroup").map((node) => ({
      id: node.id,
      status: String(node.revision.content["status"]),
      rationale: String(node.revision.content["rationale"]),
      author: node.revision.createdBy,
      dataRevision: node.revision.dataRevision,
    }));
    const history = historyOf(events, proposals);
    // The recorded groups predate the BO_0201 acceptance, so that one falls
    // back to the revision's own author and revision; the other two join their groups.
    expect(history.find((entry) => entry.rationale.startsWith("BO_0200_016"))).toMatchObject({ status: "accepted", dataRevision: 20 });
    expect(history.find((entry) => entry.rationale.startsWith("BO_0200_015"))).toMatchObject({ status: "accepted", dataRevision: 12 });
    expect(history[0]?.rationale.startsWith("BO_0201_001")).toBe(true);
  });
});
