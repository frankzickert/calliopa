import { describe, expect, it } from "vitest";
import type { Component } from "@builder.io/qwik";
import type { ApiRoute, ViewContribution } from "~/contract";
import { buildRegistry, buildServerRegistry, matchRoute, RegistryError } from "./registry";

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
        id: "ui.shell",
        contributions: {
          sections: [{ name: "documents", title: "Documents", empty: "", kind: "document" }],
          kinds: { document: view("block-editor") },
        },
      },
    ]);
    expect(registry.sections.map((section) => section.key)).toEqual(["ui.shell:documents"]);
    expect(registry.sections[0]?.opens).toBe("ui.shell:document");
    expect(registry.kinds).toEqual({ "process-result": "context", "ui.shell:document": "block-editor" });
    expect(registry.extensions).toEqual(["ui.shell"]);
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

  it("refuses two extensions contributing the same section key", () => {
    expect(
      code(() =>
        buildRegistry(host, [
          { id: "a", contributions: { sections: [{ name: "s", title: "", empty: "" }] } },
          { id: "a", contributions: { sections: [{ name: "s", title: "", empty: "" }] } },
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
      { id: "ui.shell", contributions: { readers: { documents: reader }, routes: [route("GET", "documents")] } },
    ]);
    expect(registry.readers["ui.shell:documents"]).toBe(reader);
    expect(registry.routes["ui.shell"]?.length).toBe(1);
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
