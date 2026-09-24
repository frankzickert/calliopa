import { $, component$, jsx, useStore, type QRL } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { describe, expect, it } from "vitest";

import { ActionControl, placePopover } from "./inspector";
import { ViewBarPanel } from "./view-bar";
import type { ViewAction, ViewBar, ViewBarGroup } from "./view-bridge";

/**
 * The shell's bar pressed in Qwik's render harness: the groups a view
 * contributes, in order, the line between two drawn groups, the trailing
 * group apart, and no bar for a view that contributes none. CA_0053_003
 * CA_0053_004
 */
interface Pressed {
  presses: string[];
  typed: string[];
}

const groupsFor = (pressed: Pressed): ViewBarGroup[] => [
  {
    id: "first",
    label: "First",
    actions: [
      {
        kind: "toggle",
        id: "reveal",
        label: "Show hidden",
        icon: "archive",
        on: true,
        run$: $((on: boolean) => {
          pressed.presses.push(`reveal:${on}`);
        }),
      },
    ],
  },
  { id: "empty", label: "Empty", actions: [] },
  {
    id: "second",
    label: "Second",
    actions: [
      {
        kind: "button",
        id: "insert",
        label: "+ Paragraph",
        name: "Insert paragraph after block 2",
        keepsSelection: true,
        run$: $(() => {
          pressed.presses.push("insert");
        }),
      },
      {
        kind: "button",
        id: "undo",
        label: "Undo",
        disabled: true,
        run$: $(() => {
          pressed.presses.push("undo");
        }),
      },
      {
        kind: "field",
        id: "address",
        label: "Link address",
        type: "url",
        value: "",
        submitLabel: "Apply link",
        input$: $((value: string) => {
          pressed.typed.push(value);
        }),
        submit$: $(() => {
          pressed.presses.push("apply");
        }),
      },
    ],
  },
  {
    id: "explained",
    label: "Explained",
    actions: [
      {
        kind: "popover",
        id: "what-it-means",
        label: "What it means",
        icon: "info",
        heading: "Three states.",
        lines: [
          { term: "Discard", text: "Set aside." },
          { text: "Swipe to set one." },
        ],
      },
    ],
  },
  {
    id: "end",
    label: "End",
    trailing: true,
    actions: [
      {
        kind: "button",
        id: "delete",
        label: "Delete",
        icon: "trash",
        destructive: true,
        run$: $(() => {
          pressed.presses.push("delete");
        }),
      },
    ],
  },
];

/** What a decorating extension contributes to the view's bar. BO_0274_004 */
const decorationsFor = (pressed: Pressed): ViewBarGroup[] => [
  {
    id: "end",
    label: "End",
    trailing: true,
    actions: [
      {
        kind: "button",
        id: "establish",
        label: "Establish…",
        run$: $(() => {
          pressed.presses.push("establish");
        }),
      },
    ],
  },
  {
    id: "decision",
    label: "Decision",
    actions: [
      {
        kind: "button",
        id: "challenge",
        label: "Challenge",
        run$: $(() => {
          pressed.presses.push("challenge");
        }),
      },
    ],
  },
  { id: "quiet", label: "Quiet", actions: [] },
];

const mount = async (
  groups: (pressed: Pressed) => ViewBarGroup[],
  decorations?: (pressed: Pressed) => ViewBarGroup[],
) => {
  const pressed: Pressed = { presses: [], typed: [] };
  // Built before the component: a component may capture data, not a
  // function (`BO_0138`).
  const contributed = groups(pressed);
  const decorated = decorations === undefined ? [] : decorations(pressed);
  const Host = component$(() => {
    const bar = useStore<ViewBar>({ groups: contributed });
    const decorationBar = useStore<ViewBar>({ groups: decorated });
    return jsx("div", {
      children: [
        jsx(ViewBarPanel, { bar, decorations: decorationBar }),
        // What a tab switch does to the bar: the shell clears it.
        jsx("button", {
          type: "button",
          "data-clear": "",
          onClick$: $(() => {
            bar.groups = [];
          }),
          children: "clear",
        }),
      ],
    });
  });
  const dom = await createDOM();
  await dom.render(jsx(Host, {}));
  const root = dom.screen as unknown as HTMLElement;
  const control = (id: string) =>
    (root.querySelector(`[data-bar-action="${id}"]`) as HTMLElement | null) ??
    null;
  return { ...dom, root, pressed, control };
};

describe("the view bar", () => {
  it("Given groups contributed, Then they stand in order, an empty one is not drawn, a line stands between two drawn groups, and the trailing group stands apart", async () => {
    const { root } = await mount(groupsFor);
    expect(root.querySelector("[data-view-bar]")?.getAttribute("role")).toBe(
      "toolbar",
    );
    const drawn = Array.from(root.querySelectorAll("[data-bar-group]")).map(
      (group) => [
        group.getAttribute("data-bar-group"),
        group.getAttribute("aria-label"),
        group.hasAttribute("data-ruled"),
      ],
    );
    expect(drawn).toEqual([
      ["first", "First", false],
      ["second", "Second", true],
      ["explained", "Explained", true],
      ["end", "End", true],
    ]);
    expect(
      root
        .querySelector(".view-bar__trailing [data-bar-group]")
        ?.getAttribute("data-bar-group"),
    ).toBe("end");
  });

  it("Given a view contributing only a trailing group, Then that group carries no line", async () => {
    const { root } = await mount((pressed) =>
      groupsFor(pressed).filter((group) => group.trailing === true),
    );
    expect(
      root.querySelector('[data-bar-group="end"]')?.hasAttribute("data-ruled"),
    ).toBe(false);
  });

  it("Given a decoration contributing to a group the view has, Then its control stands in that group after the view's own", async () => {
    const { root, control, pressed, userEvent } = await mount(
      groupsFor,
      decorationsFor,
    );
    const inEnd = Array.from(
      root.querySelectorAll('[data-bar-group="end"] [data-bar-action]'),
    ).map((action) => action.getAttribute("data-bar-action"));
    expect(inEnd).toEqual(["delete", "establish"]);
    expect(control("establish")?.textContent).toContain("Establish");
    await userEvent('[data-bar-action="establish"]', "click");
    expect(pressed.presses).toEqual(["establish"]);
  });

  it("Given a decoration contributing a group the view has not, Then it stands after the view's groups with its line, and an empty contributed group is not drawn", async () => {
    const { root } = await mount(groupsFor, decorationsFor);
    const drawn = Array.from(root.querySelectorAll("[data-bar-group]")).map(
      (group) => [
        group.getAttribute("data-bar-group"),
        group.hasAttribute("data-ruled"),
      ],
    );
    expect(drawn).toEqual([
      ["first", false],
      ["second", true],
      ["explained", true],
      ["decision", true],
      ["end", true],
    ]);
  });

  it("Given a view contributing no group, Then a decoration alone gives it no bar", async () => {
    const { root } = await mount(
      () => [{ id: "empty", label: "Empty", actions: [] }],
      decorationsFor,
    );
    expect(root.querySelector("[data-view-bar]") ?? null).toBeNull();
  });

  it("Given a view contributing no group, Then there is no bar", async () => {
    const { root } = await mount(() => [
      { id: "empty", label: "Empty", actions: [] },
    ]);
    expect(root.querySelector("[data-view-bar]") ?? null).toBeNull();
  });

  it("Given the bar cleared, as a tab switch clears it, Then it is gone", async () => {
    const { root, userEvent } = await mount(groupsFor);
    await userEvent("[data-clear]", "click");
    expect(root.querySelector("[data-view-bar]") ?? null).toBeNull();
  });

  it("Given each kind of control, Then an icon names itself by its label, a name says more, a disabled one is disabled, and a press keeping the selection says so", async () => {
    const { control } = await mount(groupsFor);
    expect(control("reveal")?.getAttribute("aria-label")).toBe("Show hidden");
    expect(control("reveal")?.getAttribute("title")).toBe("Show hidden");
    expect(control("reveal")?.getAttribute("aria-pressed")).toBe("true");
    expect(
      control("reveal")?.querySelector("[data-icon]")?.getAttribute("data-icon"),
    ).toBe("archive");
    expect(control("insert")?.getAttribute("aria-label")).toBe(
      "Insert paragraph after block 2",
    );
    expect(control("insert")?.textContent).toBe("+ Paragraph");
    expect(control("insert")?.hasAttribute("preventdefault:mousedown")).toBe(
      true,
    );
    expect(control("reveal")?.hasAttribute("preventdefault:mousedown")).toBe(
      false,
    );
    expect(control("undo")?.hasAttribute("disabled")).toBe(true);
    expect(control("delete")?.hasAttribute("data-destructive")).toBe(true);
  });

  it("Given presses, Then each runs the view's handler, a toggle with its state flipped and a field on Enter and on its button", async () => {
    const { userEvent, pressed, control } = await mount(groupsFor);
    await userEvent('[data-bar-action="reveal"]', "click");
    await userEvent('[data-bar-action="insert"]', "click");
    await userEvent('[data-bar-action="delete"]', "click");
    const field = control("address") as HTMLInputElement;
    field.value = "https://example.org";
    await userEvent(field, "input");
    await userEvent(field, "keydown", { key: "Enter" });
    await userEvent('[data-field-submit="address"]', "click");
    expect(pressed.presses).toEqual([
      "reveal:false",
      "insert",
      "delete",
      "apply",
      "apply",
    ]);
    expect(pressed.typed).toEqual(["https://example.org"]);
  });

  /**
   * The fourth kind of the action vocabulary: a control that opens a panel of
   * the view's own words beside it, and closes on Escape and on a press
   * outside. The shell draws it and knows nothing of what is said.
   * BO_0272_014
   */
  it("Given a popover action carrying a body, Then the panel holds the body with the view's props, and the body can close it", async () => {
    const chosen: string[] = [];
    const ChooserBody = component$<{ close$: QRL<() => void>; options: readonly string[]; choose$: QRL<(option: string) => void> }>(
      ({ close$, options, choose$ }) =>
        jsx("ul", {
          "data-chooser": "",
          children: options.map((option) =>
            jsx("li", {
              key: option,
              children: jsx("button", {
                type: "button",
                "data-choose": option,
                onClick$: $(async () => {
                  await choose$(option);
                  await close$();
                }),
                children: option,
              }),
            }),
          ),
        }),
    );
    const { root, userEvent, control } = await mount(() => [
      {
        id: "cite",
        label: "Cite",
        actions: [
          {
            kind: "popover",
            id: "choose-one",
            label: "Choose one",
            icon: "quotes",
            body: { component: ChooserBody, props: { options: ["Alpha", "Beta"], choose$: $((option: string) => void chosen.push(option)) } },
          },
        ],
      },
    ]);
    const panel = () => (root.querySelector('[data-popover-panel="choose-one"]') as HTMLElement | null) ?? null;
    expect(panel()).toBeNull();
    await userEvent('[data-bar-action="choose-one"]', "click");
    expect(control("choose-one")?.getAttribute("aria-expanded")).toBe("true");
    expect(panel()?.querySelector("dl") ?? null).toBeNull();
    expect(Array.from(panel()?.querySelectorAll("[data-choose]") ?? []).map((button) => button.textContent)).toEqual(["Alpha", "Beta"]);
    await userEvent('[data-choose="Beta"]', "click");
    expect(chosen).toEqual(["Beta"]);
    expect(panel()).toBeNull();
    expect(control("choose-one")?.getAttribute("aria-expanded")).toBe("false");
  });

  it("Given a popover action, Then the control opens a panel of the view's words, labelled by it, and closes on Escape and on a press outside", async () => {
    const { root, userEvent, control } = await mount(groupsFor);
    const panel = () =>
      (root.querySelector('[data-popover-panel="what-it-means"]') as HTMLElement | null) ?? null;
    expect(panel()).toBeNull();
    expect(control("what-it-means")?.getAttribute("aria-expanded")).toBe("false");
    expect(control("what-it-means")?.getAttribute("aria-label")).toBe("What it means");

    await userEvent('[data-bar-action="what-it-means"]', "click");
    expect(control("what-it-means")?.getAttribute("aria-expanded")).toBe("true");
    expect(panel()?.getAttribute("aria-labelledby")).toBe(
      control("what-it-means")?.getAttribute("id"),
    );
    expect(panel()?.querySelector("p")?.textContent).toBe("Three states.");
    expect(
      Array.from(panel()?.querySelectorAll("dt") ?? []).map((term) => term.textContent),
    ).toEqual(["Discard"]);
    expect(
      Array.from(panel()?.querySelectorAll("dd") ?? []).map((line) => line.textContent),
    ).toEqual(["Set aside.", "Swipe to set one."]);

    // Escape closes it, from the control or from inside the panel, and the
    // control closes it again. A press anywhere outside closes it too
    // (`useOnDocument`), which this harness cannot dispatch: the document's
    // own listeners are the browser's.
    await userEvent('[data-popover="what-it-means"]', "keydown", { key: "Escape" });
    expect(panel()).toBeNull();
    await userEvent('[data-bar-action="what-it-means"]', "click");
    expect(panel()).not.toBeNull();
    await userEvent('[data-bar-action="what-it-means"]', "click");
    expect(panel()).toBeNull();
  });
});

/**
 * What lies beyond the bar's ends, and the fade drawn from it: the bar scrolls
 * as one, so an end is the only thing that says there is more. CA_0060_001
 * CA_0060_002
 */
describe("the fade at the bar's ends", () => {
  it("Given a bar that is not scrolled and holds nothing beyond its ends, Then neither end fades", async () => {
    const { root } = await mount(groupsFor);
    const drawn = root.querySelector("[data-view-bar]") as HTMLElement;
    // The harness measures nothing, which is a bar whose groups fit: the
    // fade is drawn from what the bar reads off itself, and the widths it
    // reads are the browser's. The measurement covers the fade drawn
    // (`CA_0060_004`).
    expect(drawn.hasAttribute("data-more-start")).toBe(false);
    expect(drawn.hasAttribute("data-more-end")).toBe(false);
  });
});

/**
 * A choice on the bar is its symbol, in the inspector its words: the bar has
 * the least room of the two surfaces and already says a button by its icon,
 * and the inspector has the room and no icon idiom. A choice whose options
 * name no icon keeps its label on both, so a change document's status control
 * is untouched. DO_0010_009
 */
describe("a choice on the bar and in the inspector", () => {
  const withIcons: Extract<ViewAction, { kind: "choice" }> = {
    kind: "choice",
    id: "block-standing",
    label: "Standing",
    value: "fixate",
    options: [
      { value: "discarded", label: "Discard", icon: "x" },
      { value: "keep", label: "Keep", icon: "circle" },
      { value: "fixate", label: "Fixate", icon: "diamond" },
    ],
    run$: $(() => {}),
  };
  const withoutIcons: Extract<ViewAction, { kind: "choice" }> = {
    kind: "choice",
    id: "change-status",
    label: "Status",
    value: "draft",
    options: [
      { value: "idea", label: "Idea" },
      { value: "draft", label: "Draft" },
    ],
    run$: $(() => {}),
  };
  const draw = async (action: Extract<ViewAction, { kind: "choice" }>, surface: "bar" | "inspector") => {
    const dom = await createDOM();
    await dom.render(jsx(ActionControl, { action, surface }));
    const root = dom.screen as unknown as HTMLElement;
    return {
      label: root.querySelector(".choice-control__label")?.textContent ?? null,
      icons: Array.from(root.querySelectorAll("[data-icon]")).map((icon) =>
        icon.getAttribute("data-icon"),
      ),
      named: root.querySelector("select")?.getAttribute("aria-label") ?? null,
      options: Array.from(root.querySelectorAll("option")).map((option) =>
        option.getAttribute("value"),
      ),
    };
  };

  it("Given a choice whose current option names an icon, Then the bar draws the icon and a caret and no words", async () => {
    const drawn = await draw(withIcons, "bar");
    expect(drawn.label).toBeNull();
    expect(drawn.icons).toEqual(["diamond", "caret-down"]);
    // The words are not lost: they are the select's accessible name, and
    // every option is still there to be chosen.
    expect(drawn.named).toBe("Standing");
    expect(drawn.options).toEqual(["discarded", "keep", "fixate"]);
  });

  it("Given the same choice in the inspector, Then it keeps its label", async () => {
    const drawn = await draw(withIcons, "inspector");
    expect(drawn.label).toBe("Standing");
    expect(drawn.icons).toEqual(["diamond"]);
    expect(drawn.named).toBeNull();
  });

  it("Given a choice whose options name no icon, Then it keeps its label on the bar too", async () => {
    const drawn = await draw(withoutIcons, "bar");
    expect(drawn.label).toBe("Status");
    expect(drawn.icons).toEqual([]);
    expect(drawn.named).toBeNull();
  });
});

/**
 * Where a popover's panel stands. It is fixed and placed from the control's
 * own box, because `.view-bar` is one bar-height tall and scrolls sideways,
 * and a scrollport clips the absolutely positioned descendants whose
 * containing block is inside it. DO_0010_010
 */
describe("where a popover's panel stands", () => {
  const viewport = { width: 1280, height: 800 };

  it("Given room to its right, Then the panel hangs under the control at its leading edge", () => {
    expect(placePopover({ top: 8, left: 200, bottom: 48 }, 320, viewport)).toEqual({
      top: 53.6,
      left: 200,
    });
  });

  it("Given a control near the trailing edge, Then the panel is pulled back inside the viewport", () => {
    // 1200 + 320 is past 1280, so the panel stands where its own trailing
    // edge clears the margin instead of under the control's leading edge.
    expect(placePopover({ top: 8, left: 1200, bottom: 48 }, 320, viewport).left).toBe(944);
  });

  it("Given a viewport narrower than the panel, Then it still starts inside the leading margin", () => {
    expect(placePopover({ top: 8, left: 4, bottom: 48 }, 320, { width: 300, height: 600 }).left).toBe(16);
  });
});
