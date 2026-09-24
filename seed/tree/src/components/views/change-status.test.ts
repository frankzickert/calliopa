import { $, component$, jsx, useContextProvider, useStore } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { describe, expect, it } from "vitest";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import { ChangeStatus, changeStatusOf, isChangeDocumentPath, waitingMoveOf } from "./change-status";

/**
 * The status control on a change's own tab. Pressed rather than described,
 * because a control that renders and does nothing looks identical in the
 * markup — the lesson `BO_0224_009` paid for. What it must do is stage and
 * never write: the status is established by confirming, on the kernel's
 * page, the proposal the kernel stages, which is `BO_0254`'s rule kept; and a
 * waiting move is shown after a reload and replaced by the next choice.
 * BO_0282_009 BO_0297_007 BO_0297_008
 */

describe("reading the change", () => {
  it("takes the status out of the rendered change's facts", () => {
    expect(changeStatusOf([{ label: "Path", value: "x" }, { label: "Status", value: "draft" }])).toBe(
      "draft",
    );
  });

  it("answers nothing when the document states none", () => {
    expect(changeStatusOf([])).toBe("");
  });

  it("knows a change document from a topic", () => {
    expect(isChangeDocumentPath("docs/changes/BO_0001_FEAT_x.md")).toBe(true);
    expect(isChangeDocumentPath("src/extensions/e/docs/changes/RF_0001_FEAT_y.md")).toBe(true);
    expect(isChangeDocumentPath("docs/system/workspace/layout.md")).toBe(false);
    expect(isChangeDocumentPath(undefined)).toBe(false);
  });

  it("finds the change's waiting move among the staged groups", () => {
    const groups = [
      { group: "node:chg-other" },
      { group: "node:chg-2", statusMove: { path: "docs/changes/BO_0002_FEAT_y.md", to: "wip" } },
      { group: "node:chg-1", statusMove: { path: "docs/changes/BO_0001_FEAT_x.md", to: "ready" } },
    ];
    expect(waitingMoveOf(groups, "docs/changes/BO_0001_FEAT_x.md")).toEqual({
      group: "node:chg-1",
      to: "ready",
    });
    expect(waitingMoveOf(groups, "docs/changes/BO_0003_FEAT_z.md")).toBeNull();
  });
});

const host = () =>
  component$(() => {
    const bridge = useStore({
      drag: {},
      inspector: { text: null, facts: [], actions: [] },
      dock: {},
      save: {},
      openTarget$: $(async () => {}),
    });
    useContextProvider(ViewBridgeContext, bridge as never);
    return jsx(ChangeStatus, {
      extension: "test.ext",
      path: "docs/changes/BO_0001_FEAT_x.md",
      status: "draft",
    });
  });


type Answer = { status?: number; body: unknown };

/** kernel answers the control's calls by route, and records them. */
function kernel(routes: {
  groups?: unknown;
  move?: (body: { status: string }) => Answer;
  accept?: Answer;
}) {
  const posted: { url: string; body: string }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    const body = String(init?.body ?? "");
    let answer: Answer = { status: 404, body: { message: "no route" } };
    if (target.endsWith("/groups")) answer = { body: routes.groups ?? { groups: [] } };
    else {
      posted.push({ url: target, body });
      if (target.endsWith("/change-status") && routes.move !== undefined)
        answer = routes.move(JSON.parse(body) as { status: string });
      if (target.endsWith("/accept") && routes.accept !== undefined) answer = routes.accept;
    }
    return new Response(JSON.stringify(answer.body), {
      status: answer.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { posted, restore: () => (globalThis.fetch = original) };
}

// The tab reads the waiting move once it is visible, and this platform draws
// only when a dispatched event ends: a tick and an event settle the read, so
// its draw lands in this render rather than in a later test's.
async function settle(userEvent: (target: string, event: string) => Promise<void>) {
  await new Promise((resolve) => setTimeout(resolve, 20));
  await userEvent(".change-status", "focusin");
}

async function choose(
  screen: HTMLElement,
  userEvent: (target: Element, event: string) => Promise<void>,
  status: string,
) {
  const control = screen.querySelector(".change-status__choice") as HTMLSelectElement;
  control.value = status;
  await userEvent(control, "change");
}

const staged = (to: string, group: string) => () => ({
  body: {
    changed: true,
    group,
    to,
    status: "pending",
    confirmUrl: `http://127.0.0.1:8091/confirm/${group}`,
  },
});

describe("the control on the change's tab", () => {
  it("offers every status, stages the move without writing, and links its confirmation", async () => {
    const calls = kernel({ move: staged("ready", "p1") });
    try {
      const { screen, render, userEvent } = await createDOM();
      await render(jsx(host(), {}));
      await settle(userEvent);

      expect(
        [...screen.querySelectorAll(".change-status__choice option")].map(
          (option) => (option as HTMLOptionElement).value,
        ),
      ).toEqual(["idea", "draft", "ready", "wip", "completed", "rejected"]);

      await choose(screen, userEvent, "ready");

      expect(calls.posted).toHaveLength(1);
      expect(calls.posted[0]?.url).toContain("/extensions/test.ext/change-status");
      expect(JSON.parse(calls.posted[0]?.body ?? "{}")).toEqual({
        path: "docs/changes/BO_0001_FEAT_x.md",
        status: "ready",
      });
      // It says the document still reads draft and that confirming is what
      // lands it, never that it has landed, and it links the confirmation.
      const note = screen.querySelector("[data-status-staged]")?.textContent ?? "";
      expect(note).toContain("It reads draft");
      expect(note).toContain("once you confirm");
      expect(screen.querySelector("[data-status-confirm]")?.getAttribute("href")).toBe(
        "http://127.0.0.1:8091/confirm/p1",
      );
    } finally {
      calls.restore();
    }
  });

  it("shows a waiting move after a reload and asks for its confirmation again", async () => {
    const calls = kernel({
      groups: {
        groups: [
          { group: "node:chg-9", statusMove: { path: "docs/changes/BO_0001_FEAT_x.md", from: "draft", to: "wip" } },
        ],
      },
      accept: { body: { status: "pending", confirmUrl: "http://127.0.0.1:8091/confirm/again" } },
    });
    try {
      const { screen, render, userEvent } = await createDOM();
      await render(jsx(host(), {}));
      await settle(userEvent);

      const control = screen.querySelector(".change-status__choice") as HTMLSelectElement;
      expect(control.getAttribute("data-status-waiting")).toBe("wip");
      const note = screen.querySelector("[data-status-staged]")?.textContent ?? "";
      expect(note).toContain("It reads draft");
      expect(note).toContain("reads wip once you confirm");

      await userEvent(screen.querySelector("[data-status-ask]") as Element, "click");
      expect(calls.posted.map((call) => call.url)).toEqual([
        "/api/x/ui.shell/extensions/group/node%3Achg-9/accept",
      ]);
      expect(screen.querySelector("[data-status-confirm]")?.getAttribute("href")).toBe(
        "http://127.0.0.1:8091/confirm/again",
      );
    } finally {
      calls.restore();
    }
  });

  it("shows only the latest move, and withdraws it when the document's status is chosen", async () => {
    const calls = kernel({
      move: (body) =>
        body.status === "draft"
          ? { body: { changed: false, to: "draft", replaced: ["node:chg-2"] } }
          : body.status === "ready"
            ? staged("ready", "node:chg-1")()
            : { body: { ...staged("wip", "node:chg-2")().body, replaced: ["node:chg-1"] } },
    });
    try {
      const { screen, render, userEvent } = await createDOM();
      await render(jsx(host(), {}));
      await settle(userEvent);

      await choose(screen, userEvent, "ready");
      await choose(screen, userEvent, "wip");
      const notes = screen.querySelectorAll("[data-status-staged]");
      expect(notes).toHaveLength(1);
      expect(notes[0]?.textContent ?? "").toContain("reads wip once you confirm");

      await choose(screen, userEvent, "draft");
      expect(screen.querySelector("[data-status-staged]")).toBeFalsy();
      expect(screen.querySelector("[data-status-note]")?.textContent ?? "").toContain(
        "the waiting move was withdrawn",
      );
    } finally {
      calls.restore();
    }
  });

  it("shows the kernel's refusal in its own words", async () => {
    const calls = kernel({
      move: () => ({ status: 403, body: { message: "your account is class agent" } }),
    });
    try {
      const { screen, render, userEvent } = await createDOM();
      await render(jsx(host(), {}));
      await settle(userEvent);
      await choose(screen, userEvent, "ready");
      expect(screen.querySelector("[data-status-refusal]")?.textContent ?? "").toContain(
        "class agent",
      );
      // And says nothing was staged. toBeFalsy rather than toBeNull: the
      // render harness answers undefined for a selector that matches
      // nothing, where a browser answers null.
      expect(screen.querySelector("[data-status-staged]")).toBeFalsy();
    } finally {
      calls.restore();
    }
  });
});
