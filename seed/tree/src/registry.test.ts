import { describe, expect, it } from "vitest";
import type { Component } from "@builder.io/qwik";
import type { ApiRoute, ViewContribution } from "~/contract";
import { buildRegistry, buildServerRegistry, matchRoute, mergeRoster, RegistryError } from "./registry";

/**
 * The merge behind the generated registries, over fixture contributions: what
 * qualifies, what merges, and every collision it refuses by name. BO_0202_001
 * BO_0202_004
 */
const component = {} as Component<never>;
const view = (id: string, targetKinds: readonly string[] = []): ViewContribution => ({
  id,
  name: id,
  targetKinds,
  inspector: "",
  drag: [],
  component,
});
const host = { kinds: { "process-result": view("context") } };
const icon = { title: "A", name: "files" } as const;
const code = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    if (error instanceof RegistryError) return error.code;
    throw error;
  }
  return "no error";
};

describe("building the client registry", () => {
  it("qualifies sections and kinds by extension and keeps the host's bare", () => {
    const registry = buildRegistry(host, [
      {
        id: "documents",
        contributions: {
          icon: { title: "Docs", name: "files" },
          sections: [{ name: "documents", title: "Documents", empty: "", kind: "document" }],
          kinds: { document: view("block-editor") },
        },
      },
    ]);
    expect(registry.sections.map((section) => section.key)).toEqual(["documents:documents"]);
    expect(registry.sections[0]?.opens).toBe("documents:document");
    expect(registry.kinds).toEqual({ "process-result": "context", "documents:document": "block-editor" });
    expect(registry.extensions).toEqual(["documents"]);
  });

  it("lets a section open another extension's kind, and refuses one nothing contributes or one naming both", () => {
    const registry = buildRegistry(host, [
      { id: "documents", contributions: { icon: { title: "Docs", name: "files" }, sections: [], kinds: { document: view("block-editor") } } },
      { id: "profiles", contributions: { icon: { title: "Profiles", name: "compass" }, sections: [{ name: "profiles", title: "Profiles", empty: "", opens: "documents:document" }], kinds: {} } },
    ]);
    expect(registry.sections.find((section) => section.key === "profiles:profiles")?.opens).toBe("documents:document");
    expect(
      code(() =>
        buildRegistry(host, [
          { id: "profiles", contributions: { icon: { title: "Profiles", name: "compass" }, sections: [{ name: "profiles", title: "Profiles", empty: "", opens: "documents:document" }], kinds: {} } },
        ]),
      ),
    ).toBe("target_kind_unknown");
    expect(
      code(() =>
        buildRegistry(host, [
          { id: "profiles", contributions: { icon: { title: "Profiles", name: "compass" }, sections: [{ name: "profiles", title: "Profiles", empty: "", kind: "x", opens: "documents:document" }], kinds: { x: view("v") } } },
        ]),
      ),
    ).toBe("section_opens");
  });

  it("gives a kind's default view that kind, and a further view the kinds it names", () => {
    const shared = view("context");
    const registry = buildRegistry(
      { kinds: { script: shared, scene: shared }, views: [view("outline", ["script"])] },
      [],
    );
    expect(registry.views.find((v) => v.id === "context")?.targetKinds).toEqual(["script", "scene"]);
    expect(registry.views.find((v) => v.id === "outline")?.targetKinds).toEqual(["script"]);
  });

  it("stands each extension's sections under its one icon, in contribution order", () => {
    const section = (name: string) => ({ name, title: name, empty: "" });
    const registry = buildRegistry(host, [
      { id: "documents", contributions: { icon: { title: "Docs", name: "files" }, sections: [section("documents")] } },
      { id: "settings", contributions: { kinds: { settings: view("settings") } } },
      {
        id: "publishing",
        contributions: {
          icon: { title: "Publish", name: "paper-plane-tilt" },
          sections: [section("channels"), section("shapes")],
        },
      },
    ]);
    expect(registry.libraryIcons).toEqual([
      { id: "documents", title: "Docs", name: "files", sections: ["documents:documents"] },
      {
        id: "publishing",
        title: "Publish",
        name: "paper-plane-tilt",
        sections: ["publishing:channels", "publishing:shapes"],
      },
    ]);
  });

  it("refuses sections without an icon, and an icon the table does not hold", () => {
    const sections = [{ name: "s", title: "", empty: "" }];
    expect(code(() => buildRegistry(host, [{ id: "a", contributions: { sections } }]))).toBe(
      "section_icon_missing",
    );
    expect(
      code(() =>
        buildRegistry(host, [
          { id: "a", contributions: { icon: { title: "A", name: "no-such-icon" as "files" }, sections } },
        ]),
      ),
    ).toBe("icon_unknown");
  });

  it("refuses two extensions contributing the same section key", () => {
    expect(
      code(() =>
        buildRegistry(host, [
          { id: "a", contributions: { icon, sections: [{ name: "s", title: "", empty: "" }] } },
          { id: "a", contributions: { icon, sections: [{ name: "s", title: "", empty: "" }] } },
        ]),
      ),
    ).toBe("section_collision");
  });

  it("refuses the same tab kind contributed twice", () => {
    expect(
      code(() =>
        buildRegistry(host, [
          { id: "a", contributions: { kinds: { k: view("v1") } } },
          { id: "a", contributions: { kinds: { k: view("v2") } } },
        ]),
      ),
    ).toBe("kind_collision");
  });

  it("refuses two extensions contributing the same view id", () => {
    expect(
      code(() =>
        buildRegistry(host, [
          { id: "a", contributions: { kinds: { k: view("editor") } } },
          { id: "b", contributions: { kinds: { k: view("editor") } } },
        ]),
      ),
    ).toBe("view_collision");
  });

  it("refuses a view presenting a kind no extension contributes", () => {
    expect(
      code(() => buildRegistry(host, [{ id: "a", contributions: { views: [view("v", ["ghost"])] } }])),
    ).toBe("target_kind_unknown");
  });
});

describe("building the server registry", () => {
  const route = (method: ApiRoute["method"], path: string): ApiRoute => ({
    method,
    path,
    handle: async () => undefined,
  });
  const party = (id: string) => ({
    id,
    kind: "service" as const,
    credential: "apiKey" as const,
    label: id,
    purpose: "",
    fields: [],
  });

  it("keys readers by section and tables by extension", () => {
    const reader = async () => [];
    const registry = buildServerRegistry([
      { id: "documents", contributions: { readers: { documents: reader }, routes: [route("GET", "d")] } },
    ]);
    expect(registry.readers["documents:documents"]).toBe(reader);
    expect(registry.routes["documents"]?.length).toBe(1);
  });

  it("keeps one citation resolver and refuses a second by name (BO_0291_030)", () => {
    const resolve = async () => ({ labels: {} });
    const registry = buildServerRegistry([
      { id: "bibliography", contributions: { citations: resolve } },
      { id: "documents", contributions: {} },
    ]);
    expect(registry.citations).toEqual({ extension: "bibliography", resolve });
    expect(buildServerRegistry([{ id: "documents", contributions: {} }]).citations).toBeUndefined();
    expect(() =>
      buildServerRegistry([
        { id: "bibliography", contributions: { citations: resolve } },
        { id: "other", contributions: { citations: resolve } },
      ]),
    ).toThrow(expect.objectContaining({ code: "citation_resolver_collision" }));
  });

  it("keys focused work by the qualified target kind, so the shell reaches it from a tab's own kind", () => {
    // Focused work is the shell's capability and the vocabulary the
    // extension's, so the shell asks the kind's owner for the child.
    // CA_0065_001
    const contribution = {
      childType: "document",
      plan: async () => ({ outcome: "success" as const, result: { itemId: "", title: "", statements: [], parameters: {} } }),
      faces: async () => ({ outcome: "success" as const, result: [] }),
      blocksOf: async () => ({ outcome: "success" as const, result: [] }),
    };
    const registry = buildServerRegistry([
      { id: "documents", contributions: { focusedWork: { document: contribution } } },
      { id: "publishing", contributions: {} },
    ]);
    expect(registry.focusedWork["documents:document"]).toBe(contribution);
    // A kind that contributes none opens no focused work, and the shell's
    // control is not drawn for it.
    expect(registry.focusedWork["publishing:deliverable"]).toBeUndefined();
  });

  it("refuses a handler table naming one method and path twice", () => {
    expect(
      code(() =>
        buildServerRegistry([
          { id: "a", contributions: { routes: [route("GET", "x/[id]"), route("GET", "x/[id]")] } },
        ]),
      ),
    ).toBe("route_collision");
  });

  it("refuses a rest segment that is not last", () => {
    expect(
      code(() => buildServerRegistry([{ id: "a", contributions: { routes: [route("GET", "[...rest]/x")] } }])),
    ).toBe("route_shape");
  });

  it("refuses two extensions contributing the same party", () => {
    expect(
      code(() =>
        buildServerRegistry([
          { id: "a", contributions: { parties: [party("homepage")] } },
          { id: "b", contributions: { parties: [party("homepage")] } },
        ]),
      ),
    ).toBe("party_collision");
  });

  it("keeps a runtime roster by extension, and merges its answer under its namespace without shadowing", () => {
    const roster = async () => [party("publishing-c1"), party("publishing-c2")];
    const registry = buildServerRegistry([
      { id: "settings", contributions: { parties: [party("honcho")] } },
      { id: "publishing", contributions: { partyRoster: roster } },
    ]);
    expect(registry.rosters).toEqual([{ extension: "publishing", roster }]);

    const held = registry.parties;
    const merged = mergeRoster(held, "publishing", [
      party("publishing-c1"),
      // Outside the roster's namespace: dropped.
      party("honcho"),
      party("other-c9"),
      // Already held: dropped rather than shadowing.
      party("publishing-c1"),
      party("publishing-c2"),
    ]);
    expect(merged.map((entry) => entry.id)).toEqual(["honcho", "publishing-c1", "publishing-c2"]);
    expect(merged[1]?.extension).toBe("publishing");
    // The static roster is untouched.
    expect(held.map((entry) => entry.id)).toEqual(["honcho"]);
  });

  it("matches a path against the table in order, with named and rest parameters", () => {
    const table = [
      route("GET", "documents"),
      route("GET", "documents/[id]"),
      route("GET", "documents/[id]/changes"),
      route("POST", "documents/[id]/commands"),
      route("GET", "files/[...path]"),
    ];
    expect(matchRoute(table, "GET", "documents")?.route.path).toBe("documents");
    expect(matchRoute(table, "GET", "documents/abc")?.params).toEqual({ id: "abc" });
    expect(matchRoute(table, "GET", "documents/abc/changes")?.params).toEqual({ id: "abc" });
    expect(matchRoute(table, "POST", "documents/abc/commands")?.route.method).toBe("POST");
    expect(matchRoute(table, "GET", "documents/abc/commands")).toBeNull();
    expect(matchRoute(table, "GET", "files/a/b/c.png")?.params).toEqual({ path: "a/b/c.png" });
    expect(matchRoute(table, "GET", "documents/a%20b")?.params).toEqual({ id: "a b" });
    expect(matchRoute(table, "DELETE", "documents")).toBeNull();
  });
});

/**
 * Senders stand in the agent menu beside the agents, and a command is sent to
 * one the way it is sent to an agent (`BO_0273_035`). Both halves or neither:
 * a sender nothing answers for would be listed and refuse every send.
 */
describe("contributed senders", () => {
  const sender = {
    id: "media:higgsfield:seedream_v5_pro",
    label: "Seedream",
    icon: "image" as const,
    selectable: true,
    reason: null,
  };

  it("keeps a roster and its send together", () => {
    const registry = buildServerRegistry([
      {
        id: "media",
        contributions: { senders: async () => [sender], send: async () => ({ ok: true, processId: "p1" }) },
      },
    ]);
    expect(registry.senders).toHaveLength(1);
    expect(registry.senders[0]?.extension).toBe("media");
  });

  it("refuses a roster with nothing to answer a send", () => {
    expect(() =>
      buildServerRegistry([{ id: "media", contributions: { senders: async () => [sender] } }]),
    ).toThrow(RegistryError);
  });

  it("contributes none when neither half is offered", () => {
    expect(buildServerRegistry([{ id: "media", contributions: {} }]).senders).toHaveLength(0);
  });
});
