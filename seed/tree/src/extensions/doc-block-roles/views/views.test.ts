import {
  $,
  component$,
  jsx,
  useContextProvider,
  useStore,
  type JSXOutput,
} from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActionControl } from "~/components/shell/inspector";
import {
  ViewBridgeContext,
  type ViewBar,
  type ViewBridge,
} from "~/components/shell/view-bridge";
import {
  EditorSurfaceContext,
  type EditorSurface,
} from "~/extensions/documents/views/editor-surface";

import {
  NO_ROLE,
  type DocumentRolesView,
  type DocumentRoleView,
  type RolesListing,
} from "../lib/roles";
import { RoleLabel } from "./label";
import { RolesProvider, STANDING_ROLE } from "./provider";
import { RolesSection } from "./section";

/**
 * The roles extension's surfaces in Qwik's render harness (`BO_0299_018`):
 * the section listing the document roles and creating one; the provider's
 * *Roles* group in the bar — *No role* first, the document's role shown, a
 * choice posted and reflected, the block choice present only with a block
 * active and a document role chosen, a role not offered any more said; and
 * the label a roled block carries. What the routes answer is stood in for by
 * the browser's own `fetch`.
 */
const hook: DocumentRoleView["blockRoles"][number] = {
  id: "1a2b3c4d-1111-4aaa-8bbb-000000000001",
  name: "Hook",
  description: "Opens the story",
  order: 1,
  retired: false,
};
const closing: DocumentRoleView["blockRoles"][number] = {
  id: "1a2b3c4d-1111-4aaa-8bbb-000000000002",
  name: "Closing",
  description: "",
  order: 2,
  retired: false,
};
const story: DocumentRoleView = {
  id: "2b0c1f3a-0f6a-4d1e-9a3c-1d2e3f4a5b6c",
  name: "Story",
  description: "",
  retired: false,
  blockRoles: [hook, closing],
};
const thesis: DocumentRoleView["blockRoles"][number] = {
  id: "1a2b3c4d-2222-4aaa-8bbb-000000000001",
  name: "Thesis",
  description: "",
  order: 1,
  retired: false,
};
const essay: DocumentRoleView = {
  id: "7e8f9a0b-1c2d-4e3f-8a5b-6c7d8e9f0a1b",
  name: "Essay",
  description: "",
  retired: false,
  blockRoles: [thesis],
};
const retired: DocumentRoleView = {
  id: "3c3c3c3c-3c3c-4c3c-8c3c-3c3c3c3c3c3c",
  name: "Old",
  description: "",
  retired: true,
  blockRoles: [],
};
const listing: RolesListing = {
  reachable: true,
  roles: [essay, retired, story],
};

const documentId = "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f";
const first = "5e5e5e5e-5e5e-4e5e-8e5e-5e5e5e5e5e5e";
const second = "6f6f6f6f-6f6f-4f6f-8f6f-6f6f6f6f6f6f";

const view = (
  documentRole: DocumentRoleView | null,
  firstRole: DocumentRolesView["blocks"][number]["blockRole"],
): DocumentRolesView => ({
  documentId,
  dataRevision: 7,
  documentRole:
    documentRole === null
      ? null
      : {
          id: documentRole.id,
          name: documentRole.name,
          description: documentRole.description,
          retired: documentRole.retired,
        },
  blocks: [
    { blockId: first, kind: "text", blockRole: firstRole },
    { blockId: second, kind: "image", blockRole: null },
  ],
});

const opened: { kind: string; itemId: string; title: string }[] = [];
const raised: string[] = [];
const hosted = (child: JSXOutput, activeBlockId: string | null) =>
  component$(() => {
    const decorationBar = useStore<ViewBar>({ groups: [] });
    const bridge = {
      decorationBar,
      openTarget$: $(
        (target: { kind: string; itemId: string; title: string }) => {
          opened.push({
            kind: target.kind,
            itemId: target.itemId,
            title: target.title,
          });
        },
      ),
      raiseMessage$: $((message: { body: string }) => {
        raised.push(message.body);
      }),
    } as unknown as ViewBridge;
    useContextProvider(ViewBridgeContext, bridge);
    const surface = useStore({
      documentId,
      document: null,
      activeBlockId,
      focusedBlockId: null,
      focusedItemId: null,
      proposals: null,
      loaded: 1,
      readMark: null,
      notice: null,
    });
    useContextProvider(
      EditorSurfaceContext,
      surface as unknown as EditorSurface,
    );
    return jsx("div", {
      children: [
        child,
        jsx("div", {
          "data-test-bar": "",
          children: decorationBar.groups.flatMap((group) =>
            group.actions.map((action) =>
              jsx(ActionControl, { action, surface: "bar" }, action.id),
            ),
          ),
        }),
      ],
    });
  });

async function mount(child: JSXOutput, activeBlockId: string | null = null) {
  const dom = await createDOM();
  await dom.render(jsx(hosted(child, activeBlockId), {}));
  const root = dom.screen as unknown as HTMLElement;
  const settle = async (until: () => boolean) => {
    for (let at = 0; at < 50; at++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await dom.userEvent(root, "harnessSettle");
      if (until()) return;
    }
  };
  return { dom, root, settle };
}

const selects = (root: HTMLElement): HTMLSelectElement[] =>
  Array.from(root.querySelectorAll("[data-test-bar] select"));
const optionsOf = (control: HTMLSelectElement): string[] =>
  Array.from(control.querySelectorAll("option")).map(
    (option) => option.textContent ?? "",
  );
/** The harness DOM does not reflect a select's value; the drawn option does. */
const chosenOf = (control: HTMLSelectElement): string | null =>
  control.querySelector("option[selected]")?.getAttribute("value") ?? null;

afterEach(() => {
  opened.length = 0;
  raised.length = 0;
  vi.unstubAllGlobals();
});

describe("the Roles section", () => {
  it("lists the document roles by name with retired ones left out, opens one on its page, and its + creates one and opens it", async () => {
    const asked: { url: string; body?: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      asked.push({
        url,
        ...(typeof init?.body === "string" ? { body: init.body } : {}),
      });
      if (url === "/api/x/doc-block-roles/roles" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            outcome: "success",
            result: {
              id: "4d4d4d4d-4d4d-4d4d-8d4d-4d4d4d4d4d4d",
              name: "Untitled role",
              description: "",
              retired: false,
              blockRoles: [],
            },
          }),
          { status: 201 },
        );
      }
      return new Response(JSON.stringify(listing), { status: 200 });
    });
    const { root, settle, dom } = await mount(
      jsx(RolesSection, {
        data: listing,
        activeItemId: story.id,
        sectionKey: "doc-block-roles:roles",
        filter: null,
        setFilter$: $(async () => {}),
      }),
    );
    const rows = () => Array.from(root.querySelectorAll("[data-role-row]"));
    expect(rows().map((row) => row.textContent?.trim())).toEqual([
      "Essay",
      "Story",
    ]);
    expect(
      root
        .querySelector(`[data-role-row="${story.id}"]`)
        ?.getAttribute("aria-current"),
    ).toBe("true");

    await dom.userEvent(`[data-role-row="${essay.id}"]`, "click");
    await settle(() => opened.length > 0);
    expect(opened).toEqual([
      {
        kind: "doc-block-roles:documentRole",
        itemId: essay.id,
        title: "Essay",
      },
    ]);

    await dom.userEvent("[data-new-role]", "click");
    await settle(() => opened.length > 1);
    expect(asked.find((entry) => entry.body !== undefined)).toEqual({
      url: "/api/x/doc-block-roles/roles",
      body: JSON.stringify({ name: "Untitled role" }),
    });
    expect(opened[1]).toEqual({
      kind: "doc-block-roles:documentRole",
      itemId: "4d4d4d4d-4d4d-4d4d-8d4d-4d4d4d4d4d4d",
      title: "Untitled role",
    });
  });

  it("says when there are none, and when they could not be read", async () => {
    const none = await mount(
      jsx(RolesSection, {
        data: { reachable: true, roles: [retired] },
        activeItemId: null,
        sectionKey: "doc-block-roles:roles",
        filter: null,
        setFilter$: $(async () => {}),
      }),
    );
    expect(
      none.root.querySelector("[data-roles-empty]")?.textContent?.trim(),
    ).toBe("No roles yet");
    const unread = await mount(
      jsx(RolesSection, {
        data: { reachable: false, roles: [] },
        activeItemId: null,
        sectionKey: "doc-block-roles:roles",
        filter: null,
        setFilter$: $(async () => {}),
      }),
    );
    expect(
      unread.root.querySelector("[data-roles-empty]")?.textContent?.trim(),
    ).toBe("The roles could not be read");
  });
});

describe("the Roles group in the document's bar", () => {
  const api =
    (
      current: DocumentRolesView,
      asked: { url: string; body?: string }[],
      refuse = false,
    ) =>
    async (url: string, init?: RequestInit) => {
      asked.push({
        url,
        ...(typeof init?.body === "string" ? { body: init.body } : {}),
      });
      if (url === "/api/library/doc-block-roles/roles")
        return new Response(JSON.stringify(listing), { status: 200 });
      if (init?.method === "POST") {
        if (refuse)
          return new Response(
            JSON.stringify({
              outcome: "validationFailure",
              failures: [
                {
                  operation: null,
                  rule: "retiredRole",
                  detail: "Old is retired and is not offered any more.",
                },
              ],
            }),
            { status: 422 },
          );
        const body = JSON.parse(init.body as string) as {
          documentRole?: string | null;
          blockRole?: string | null;
        };
        if (body.documentRole !== undefined) {
          const role =
            listing.roles.find(
              (candidate) => candidate.id === body.documentRole,
            ) ?? null;
          return new Response(
            JSON.stringify({
              outcome: "success",
              result: view(role, current.blocks[0]!.blockRole),
            }),
            { status: 200 },
          );
        }
        const blockRole =
          story.blockRoles.find(
            (candidate) => candidate.id === body.blockRole,
          ) ?? null;
        return new Response(
          JSON.stringify({
            outcome: "success",
            result: view(
              story,
              blockRole === null
                ? null
                : { ...blockRole, documentRole: story.id, offered: true },
            ),
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({ outcome: "success", result: current }),
        { status: 200 },
      );
    };

  it("offers No role first and every unretired document role, shows the document's role, and a choice is posted and reflected", async () => {
    const asked: { url: string; body?: string }[] = [];
    vi.stubGlobal("fetch", api(view(story, null), asked));
    const { root, settle, dom } = await mount(
      jsx(RolesProvider, { documentId }),
    );
    await settle(() => selects(root).length > 0);
    expect(selects(root)).toHaveLength(1);
    const control = selects(root)[0]!;
    expect(optionsOf(control)).toEqual(["No role", "Essay", "Story"]);
    expect(chosenOf(control)).toBe(story.id);
    expect(asked.map((entry) => entry.url)).toContain(
      `/api/x/doc-block-roles/documents/${documentId}`,
    );

    control.value = essay.id;
    await dom.userEvent("[data-test-bar] select", "change");
    await settle(() => asked.some((entry) => entry.body !== undefined));
    expect(asked.find((entry) => entry.body !== undefined)).toEqual({
      url: `/api/x/doc-block-roles/documents/${documentId}/role`,
      body: JSON.stringify({ documentRole: essay.id }),
    });
    await settle(() => chosenOf(selects(root)[0]!) === essay.id);
    expect(chosenOf(selects(root)[0]!)).toBe(essay.id);

    selects(root)[0]!.value = NO_ROLE;
    await dom.userEvent("[data-test-bar] select", "change");
    await settle(
      () => asked.filter((entry) => entry.body !== undefined).length > 1,
    );
    expect(asked.filter((entry) => entry.body !== undefined)[1]?.body).toBe(
      JSON.stringify({ documentRole: null }),
    );
  });

  it("offers a block role only while a block is active and the document carries a role, from the roles that role offers", async () => {
    const asked: { url: string; body?: string }[] = [];
    vi.stubGlobal("fetch", api(view(story, null), asked));
    const { root, settle, dom } = await mount(
      jsx(RolesProvider, { documentId }),
      first,
    );
    await settle(() => selects(root).length > 1);
    const [, block] = selects(root);
    expect(optionsOf(block!)).toEqual(["No role", "Hook", "Closing"]);
    expect(chosenOf(block!)).toBe(NO_ROLE);

    block!.value = hook.id;
    await dom.userEvent(block!, "change");
    await settle(() => asked.some((entry) => entry.body !== undefined));
    expect(asked.find((entry) => entry.body !== undefined)).toEqual({
      url: `/api/x/doc-block-roles/documents/${documentId}/blocks/${first}/role`,
      body: JSON.stringify({ blockRole: hook.id }),
    });
    await settle(() => chosenOf(selects(root)[1]!) === hook.id);
    expect(chosenOf(selects(root)[1]!)).toBe(hook.id);

    vi.stubGlobal("fetch", api(view(null, null), []));
    const noRole = await mount(jsx(RolesProvider, { documentId }), first);
    await noRole.settle(() => selects(noRole.root).length > 0);
    expect(selects(noRole.root)).toHaveLength(1);
  });

  it("says a block role the document's role no longer offers, with No role offered", async () => {
    vi.stubGlobal(
      "fetch",
      api(view(essay, { ...hook, documentRole: story.id, offered: false }), []),
    );
    const { root, settle } = await mount(
      jsx(RolesProvider, { documentId }),
      first,
    );
    await settle(() => selects(root).length > 1);
    const block = selects(root)[1]!;
    expect(optionsOf(block)).toEqual([
      "No role",
      "Hook (not offered)",
      "Thesis",
    ]);
    expect(chosenOf(block)).toBe(STANDING_ROLE);
  });

  it("offers nothing while the roles cannot be read", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      url === "/api/library/doc-block-roles/roles"
        ? new Response(JSON.stringify({ reachable: false, roles: [] }), {
            status: 200,
          })
        : new Response(
            JSON.stringify({ outcome: "success", result: view(null, null) }),
            { status: 200 },
          ),
    );
    const { root, settle } = await mount(jsx(RolesProvider, { documentId }));
    await settle(() => false);
    expect(selects(root)).toHaveLength(0);
  });

  it("says a refused choice in the route's words and keeps the choice", async () => {
    vi.stubGlobal("fetch", api(view(null, null), [], true));
    const { root, settle, dom } = await mount(
      jsx(RolesProvider, { documentId }),
    );
    await settle(() => selects(root).length > 0);
    selects(root)[0]!.value = story.id;
    await dom.userEvent("[data-test-bar] select", "change");
    await settle(() => raised.length > 0);
    expect(raised).toEqual(["Old is retired and is not offered any more."]);
    expect(chosenOf(selects(root)[0]!)).toBe(NO_ROLE);
  });
});

describe("the label at a roled block", () => {
  it("names the block's role while reading, says when it is not offered, and draws nothing on a block without one", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      url === "/api/library/doc-block-roles/roles"
        ? new Response(JSON.stringify(listing), { status: 200 })
        : new Response(
            JSON.stringify({
              outcome: "success",
              result: view(essay, {
                ...hook,
                documentRole: story.id,
                offered: false,
              }),
            }),
            { status: 200 },
          ),
    );
    const { root, settle } = await mount(
      jsx(RolesProvider, {
        documentId,
        children: [
          jsx(
            RoleLabel,
            { documentId, blockId: first, revisionId: "rev:1", active: false },
            "first",
          ),
          jsx(
            RoleLabel,
            { documentId, blockId: second, revisionId: "rev:2", active: false },
            "second",
          ),
        ],
      }),
    );
    await settle(() => root.querySelector("[data-block-role]") !== null);
    const labels = Array.from(root.querySelectorAll("[data-block-role]"));
    expect(labels).toHaveLength(1);
    expect(labels[0]?.getAttribute("data-block-role")).toBe(hook.id);
    expect(labels[0]?.getAttribute("data-role-state")).toBe("not offered");
    expect(labels[0]?.querySelector(".block-role__name")?.textContent).toBe(
      "Hook",
    );
    expect(labels[0]?.querySelector(".block-role__state")?.textContent).toBe(
      "not offered",
    );
  });
});
