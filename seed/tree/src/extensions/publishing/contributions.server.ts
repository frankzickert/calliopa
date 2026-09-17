import { serverContributions as declare, type ApiRoute, type LibraryItem } from "~/contract";
import {
  channelsListing,
  handleChannelCreate,
  handleChannelDelete,
  handleChannelRead,
  handleIndexRead,
} from "./server/api";
import { channelRoster } from "./server/roster";
import { listShapes } from "./server/shapes";
import { deliverablesListing, standingListing, workRoutes } from "./server/work-api";

/**
 * The server half of `publishing`: the reader behind the Channels section and
 * the handler table under `/api/x/publishing/`, and the party roster the
 * settings extension lists a channel's row from. It contributes no static
 * party: a channel's party record is written under `publishing-<channelId>`
 * when the channel is created. PU_0001_001 PU_0001_004 CA_0049_002
 */
const routes: readonly ApiRoute[] = [
  {
    method: "GET",
    path: "channels",
    handle: async (event) => {
      event.json(200, await channelsListing());
    },
  },
  {
    method: "POST",
    path: "channels",
    handle: async (event) => {
      const { status, body } = await handleChannelCreate(event.request);
      event.json(status === 200 ? 201 : status, body);
    },
  },
  {
    method: "GET",
    path: "channels/[id]",
    handle: async (event, params) => {
      const { status, body } = await handleChannelRead(params["id"] ?? "");
      event.json(status, body);
    },
  },
  {
    method: "DELETE",
    path: "channels/[id]",
    handle: async (event, params) => {
      const { status, body } = await handleChannelDelete(params["id"] ?? "", event.request);
      event.json(status, body);
    },
  },
  {
    // Reading what the site declares is a deliberate act, not a page load:
    // it reaches the destination.
    method: "POST",
    path: "channels/[id]/index/read",
    handle: async (event, params) => {
      const { status, body } = await handleIndexRead(params["id"] ?? "");
      event.json(status, body);
    },
  },
];

export const contributions = declare({
  readers: {
    channels: channelsListing,
    shapes: async (): Promise<readonly LibraryItem[]> => {
      const outcome = await listShapes();
      if (outcome.outcome !== "success") return [];
      return outcome.result.map((shape) => ({
        id: shape.shapeId,
        label: shape.title,
        open: { kind: "shape", itemId: shape.shapeId, title: shape.title },
      }));
    },
    deliverables: deliverablesListing,
    standing: standingListing,
  },
  routes: [...routes, ...workRoutes],
  // One party per channel node, so the settings extension lists a row for
  // every channel the author made and its credential is entered there.
  partyRoster: channelRoster,
});
