import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { db } from "~/server/db";
import { actOnEpisode } from "~/server/publishing/api";

/**
 * Releasing and retiring are one route because they are the same act against a
 * destination with opposite intent, and a person performs both from the same
 * panel.
 */
export const onPost: RequestHandler = (event) =>
  api(event, async () => {
    const asked = (await event.request.json()) as {
      act?: "release" | "retire";
      channel?: string;
    };
    const { status, body } = await actOnEpisode(db(), {
      episodeId: event.params["id"] as string,
      act: asked.act === "retire" ? "retire" : "release",
      channel: asked.channel ?? "homepage",
    });
    event.json(status, body);
  });
