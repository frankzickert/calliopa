import { $ } from "@builder.io/qwik";
import { contributions as declare, type ViewContribution } from "~/contract";
import { ChannelsSection } from "./components/channels-section";
import { DeliverablesSection } from "./components/deliverables-section";
import { StandingSection } from "./components/standing-section";
import { ChannelView } from "./views/channel";
import { DeliverableView } from "./views/deliverable";
import { ItemView } from "./views/item";
import { ShapeView } from "./views/shape";

/**
 * What `publishing` contributes: the Channels section below the shell's own
 * categories, and the `channel` tab kind with the view presenting it. An
 * instance without the extension has neither; the shell builds the same
 * either way. PU_0001_001 PU_0001_005 PU_0001_006
 */

const channel: ViewContribution = {
  id: "channel",
  name: "Channel",
  // A channel has no selection of its own; the inspector states its facts.
  inspector: "No channel open",
  drag: [],
  component: ChannelView,
};

const shape: ViewContribution = {
  id: "shape",
  name: "Shape",
  inspector: "No shape open",
  drag: [],
  component: ShapeView,
};

const deliverable: ViewContribution = {
  id: "deliverable",
  name: "Deliverable",
  inspector: "No deliverable open",
  drag: [],
  component: DeliverableView,
};

const item: ViewContribution = {
  id: "item",
  name: "Item",
  inspector: "No item open",
  drag: [],
  component: ItemView,
};

export const contributions = declare({
  sections: [
    {
      name: "channels",
      title: "Channels",
      empty: "No channels yet",
      kind: "channel",
      // The `+` is the section's own control, because creating a channel
      // asks for a kind and a title, and the header's create control creates
      // at once and can carry no form.
      component: ChannelsSection,
    },
    {
      // Shapes are the author's vocabulary; a new one is created at once and
      // named in its tab. PU_0002_005
      name: "shapes",
      title: "Shapes",
      empty: "No shapes yet",
      kind: "shape",
      createLabel: "New shape",
      create$: $(async () => {
        const response = await fetch("/api/x/publishing/shapes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "Untitled shape" }),
        });
        const outcome = (await response.json()) as { outcome: "success"; result: { shapeId: string } } | { outcome: string };
        if (outcome.outcome !== "success") return null;
        return { kind: "shape", itemId: (outcome as { result: { shapeId: string } }).result.shapeId, title: "Untitled shape" };
      }),
    },
    {
      // Deliverables grouped by their shape; the `+` picks a shape and titles
      // the deliverable, so it is the section's own control. PU_0002_005
      name: "deliverables",
      title: "Deliverables",
      empty: "No deliverables yet",
      kind: "deliverable",
      component: DeliverablesSection,
    },
    {
      // Items no deliverable gathers; the `+` takes a file. PU_0002_005
      name: "standing",
      title: "Standing Items",
      empty: "No standing items",
      kind: "item",
      component: StandingSection,
    },
  ],
  kinds: { channel, shape, deliverable, item },
});
