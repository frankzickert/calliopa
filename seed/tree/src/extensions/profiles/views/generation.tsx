import { $, component$, useContext, useStore, useTask$, useVisibleTask$ } from "@builder.io/qwik";

import type { DocumentDecorationProps } from "~/contract";
import { ViewBridgeContext, type ViewBarGroup } from "~/components/shell/view-bridge";
import type { ProfileGeneration } from "~/extensions/documents/lib/profile";

/**
 * A profile's setup in its own document's bar (`calliopa-bootstrap`'s
 * `BO_0320` and `BO_0312`): *Profile type* — instructions, image generation or
 * video generation — and, for an image or a video profile, its backend, saved on the profile as structured data that
 * `media.generate` reads; the profile's words never choose the backend
 * (`BO_0320_Q4`, `BO_0320_Q5`). Drawn on a profile's document alone: the read
 * answers nothing for any other, so no group stands there. The profile a
 * command uses is chosen in the chip (`BO_0311`), so the bar carries no
 * selector. The group is this extension's own and the write keeps every other
 * extension's group.
 */
const GROUP = "profile-generation";

export const ProfileGenerationSetup = component$<DocumentDecorationProps>(({ documentId }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<{ generation: ProfileGeneration | null; busy: boolean }>({ generation: null, busy: false });

  // eslint-disable-next-line qwik/no-use-visible-task -- read in the browser with the person's session
  useVisibleTask$(async ({ track }) => {
    const id = track(() => documentId);
    const answered = await fetch(`/api/x/profiles/documents/${encodeURIComponent(id)}/generation-profile`).catch(() => null);
    if (answered === null || !answered.ok) return;
    const answer = (await answered.json().catch(() => null)) as { outcome: string; result?: ProfileGeneration | null } | null;
    if (answer?.outcome === "success") state.generation = answer.result ?? null;
  });

  const save$ = $(async (profileType: "instructions" | "image" | "video", imageBackend?: "higgsfield" | "openart" | "codex") => {
    if (state.busy || state.generation === null) return;
    state.busy = true;
    try {
      const response = await fetch(`/api/x/profiles/documents/${encodeURIComponent(documentId)}/generation-profile`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileType, ...(imageBackend ? { imageBackend } : {}) }),
      });
      const answer = (await response.json().catch(() => ({ outcome: "refused" }))) as { outcome: string; result?: ProfileGeneration; detail?: string };
      if (response.ok && answer.outcome === "success" && answer.result) {
        state.generation = answer.result;
        return;
      }
      await bridge.raiseMessage$({ headline: "The image profile was not saved", body: answer.detail ?? `The server answered ${response.status}.`, answers: [{ id: "ok", label: "OK" }] });
    } finally {
      state.busy = false;
    }
  });

  useTask$(({ track }) => {
    const generation = track(() => state.generation);
    const others = bridge.decorationBar.groups.filter((group) => group.id !== GROUP);
    if (generation === null) {
      bridge.decorationBar.groups = others;
      return;
    }
    const setup: ViewBarGroup = {
      id: GROUP,
      label: "Generation",
      actions: [
        {
          kind: "choice",
          id: "profile-type",
          label: "Profile type",
          value: generation.profileType,
          options: [
            { value: "instructions", label: "Instructions" },
            { value: "image", label: "Image generation" },
            { value: "video", label: "Video generation" },
          ],
          run$: $((value: string) => {
            const type = value === "image" || value === "video" ? value : "instructions";
            // Codex makes pictures only, so a video profile does not carry it
            // over from an image profile's choice. BO_0312
            const backend = type === "video" && generation.imageBackend === "codex" ? undefined : generation.imageBackend ?? undefined;
            return save$(type, backend);
          }),
        },
        ...((generation.profileType === "image" || generation.profileType === "video") && generation.imageBackend !== "codex"
          ? [
              {
                kind: "choice" as const,
                id: "profile-image-backend",
                label: generation.profileType === "video" ? "Video backend" : "Image backend",
                value: generation.imageBackend ?? "",
                options: [
                  { value: "", label: "Choose backend" },
                  { value: "higgsfield", label: "Higgsfield" },
                  { value: "openart", label: "OpenArt" },
                ],
                run$: $((value: string) =>
                  value === "openart" || value === "higgsfield"
                    ? save$(generation.profileType === "video" ? "video" : "image", value)
                    : Promise.resolve(),
                ),
              },
            ]
          : []),
      ],
    };
    bridge.decorationBar.groups = [...others, setup];
  });

  return null;
});
