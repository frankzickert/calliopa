import { jsx } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GeneratorsSection } from "./section";

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * The Generators section lists the generators a person signs in to here,
 * Higgsfield and OpenArt. The service's roster also answers Codex, the image
 * backend `BO_0320` added, which is signed in under Agents: drawn here it was
 * a second row headed *OpenArt* with a Sign in this section's route refuses
 * (`calliopa-bootstrap`'s `BO_0312_063`).
 */
describe("the Generators section", () => {
  it("draws Higgsfield and OpenArt, each with its own standing, and not Codex", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      new Response(
        JSON.stringify(
          url.startsWith("/api/x/media/services")
            ? {
                services: [
                  { service: "codex", signedIn: true, reason: null, models: [], openSet: {}, workspaces: null },
                  { service: "higgsfield", signedIn: false, reason: "run `higgsfield auth login`", models: [], openSet: {}, workspaces: null },
                  { service: "openart", signedIn: true, reason: null, models: [], openSet: {}, workspaces: null },
                ],
              }
            : { models: [], named: [] },
        ),
        { status: 200 },
      ));
    const dom = await createDOM();
    await dom.render(jsx(GeneratorsSection, {}));
    const root = dom.screen as unknown as HTMLElement;
    for (let at = 0; at < 50 && root.querySelectorAll("[data-media-service]").length === 0; at++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await dom.userEvent(root, "harnessSettle");
    }
    const rows = Array.from(root.querySelectorAll("[data-media-service]"));
    expect(rows.map((row) => row.getAttribute("data-media-service"))).toEqual(["higgsfield", "openart"]);
    expect(rows.map((row) => row.querySelector("h4")?.textContent)).toEqual(["Higgsfield", "OpenArt"]);
    expect(rows.map((row) => row.querySelector("[data-media-signed-in]")?.getAttribute("data-media-signed-in"))).toEqual(["false", "true"]);
  });

  it("keeps the sign-in and the workspace, and no models, names, icons or axes (calliopa-bootstrap's BO_0336_021)", async () => {
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      asked.push(url);
      return new Response(
        JSON.stringify({
          services: [
            {
              service: "higgsfield",
              signedIn: true,
              reason: null,
              models: [{ model: "gpt_image_2", kind: "image", default: true }],
              openSet: { video: true },
              workspaces: [{ id: "ws-1", name: "Studio", plan: "pro", credits: 40, selected: true }],
            },
          ],
        }),
        { status: 200 },
      );
    });
    const dom = await createDOM();
    await dom.render(jsx(GeneratorsSection, {}));
    const root = dom.screen as unknown as HTMLElement;
    for (let at = 0; at < 50 && root.querySelectorAll("[data-media-service]").length === 0; at++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await dom.userEvent(root, "harnessSettle");
    }
    expect(root.querySelector('[data-media-sign-in="higgsfield"]')).not.toBeNull();
    expect(root.querySelector('[data-media-workspaces="higgsfield"]')).not.toBeNull();
    for (const gone of ["[data-media-offer]", "[data-media-axes]", "[data-media-name]", "[data-media-icon]", "[data-media-name-job]"])
      expect(root.querySelector(gone), gone).toBeFalsy();
    expect(asked).toEqual(["/api/x/media/services"]);
  });
});
