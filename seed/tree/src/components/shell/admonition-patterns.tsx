import { $, component$, useStore, useVisibleTask$ } from "@builder.io/qwik";
import type { SectionProps } from "~/contract";
import { patternImageSource, type PatternImage } from "~/lib/attachments";

interface Pattern {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly image?: PatternImage;
  readonly footline?: string;
}

interface UploadedImage {
  readonly _kind: "blob";
  readonly hash: string;
  readonly mediaType: string;
  readonly size: number;
  readonly filename: string;
}

export const AdmonitionPatternsSection = component$<SectionProps>(() => {
  const state = useStore<{
    patterns: Pattern[];
    id: string;
    name: string;
    color: string;
    image: PatternImage | null;
    removeImage: boolean;
    imageFileName: string;
    footline: string;
    busy: boolean;
    notice: string;
  }>({
    patterns: [],
    id: "",
    name: "",
    color: "#607d8b",
    image: null,
    removeImage: false,
    imageFileName: "",
    footline: "",
    busy: false,
    notice: "",
  });

  const refresh$ = $(async () => {
    const response = await fetch("/api/x/documents/patterns");
    if (!response.ok) return;
    const answer = await response.json() as { outcome: string; result?: Pattern[] };
    state.patterns = answer.result ?? [];
  });

  useVisibleTask$(async () => {
    await refresh$();
  });

  const edit$ = $((pattern: Pattern) => {
    state.id = pattern.id;
    state.name = pattern.name;
    state.color = pattern.color;
    state.image = pattern.image ?? null;
    state.removeImage = false;
    state.imageFileName = "";
    state.footline = pattern.footline ?? "";
    state.notice = "";
  });

  const clear$ = $((form?: HTMLFormElement) => {
    state.id = "";
    state.name = "";
    state.color = "#607d8b";
    state.image = null;
    state.removeImage = false;
    state.imageFileName = "";
    state.footline = "";
    state.notice = "";
    const input = form?.querySelector<HTMLInputElement>("[name='image']");
    if (input) input.value = "";
  });

  const save$ = $(async (form: HTMLFormElement) => {
    if (state.busy || state.name.trim() === "") return;
    state.busy = true;
    state.notice = "";
    try {
      const file = form.querySelector<HTMLInputElement>("[name='image']")?.files?.[0];
      let image: PatternImage = state.removeImage ? "" : state.image ?? "";
      if (file !== undefined) {
        if (file.type !== "" && !file.type.startsWith("image/")) {
          state.notice = `${file.name} is not an image file.`;
          return;
        }
        try {
          const bitmap = await createImageBitmap(file);
          bitmap.close();
        } catch {
          state.notice = `${file.name} could not be read as an image.`;
          return;
        }

        const uploadedResponse = await fetch("/api/x/documents/blobs", {
          method: "POST",
          headers: {
            "content-type": file.type === "" ? "application/octet-stream" : file.type,
            "x-calliopa-filename": encodeURIComponent(file.name),
          },
          body: file,
        });
        const uploaded = await uploadedResponse.json() as {
          outcome: string;
          result?: { readonly reference: UploadedImage };
        };
        if (!uploadedResponse.ok || uploaded.outcome !== "success" || uploaded.result === undefined) {
          state.notice = "The image could not be uploaded to Garage.";
          return;
        }
        image = uploaded.result.reference;
      }

      const response = await fetch(
        state.id ? `/api/x/documents/patterns/${state.id}` : "/api/x/documents/patterns",
        {
          method: state.id ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: state.name, color: state.color, image, footline: state.footline }),
        },
      );
      if (!response.ok) {
        state.notice = "The pattern could not be saved.";
        return;
      }
      await refresh$();
      window.dispatchEvent(new Event("admonition-patterns-updated"));
      await clear$(form);
    } catch {
      state.notice = "The image or pattern could not be saved.";
    } finally {
      state.busy = false;
    }
  });

  const imageSource = patternImageSource(state.image);

  return (
    <div class="admonition-patterns">
      <ul>
        {state.patterns.map((pattern) => (
          <li key={pattern.id}>
            <button type="button" onClick$={() => edit$(pattern)}>
              <span style={{ color: pattern.color }}>●</span> {pattern.name}
            </button>
          </li>
        ))}
      </ul>
      <form class="admonition-patterns__form" preventdefault:submit onSubmit$={(_, form) => save$(form)}>
        <label>Name <input required value={state.name} onInput$={(_, el) => state.name = el.value} /></label>
        <label>Color <input type="color" value={state.color} onInput$={(_, el) => state.color = el.value} /></label>
        <label>Image file <input name="image" type="file" accept="image/*" disabled={state.busy} onChange$={async (_, el) => {
          const file = el.files?.[0];
          state.imageFileName = file?.name ?? "";
          state.notice = "";
          if (file === undefined) return;
          if (file.type !== "" && !file.type.startsWith("image/")) {
            state.notice = `${file.name} is not an image file.`;
            el.value = "";
            state.imageFileName = "";
            return;
          }
          try {
            const bitmap = await createImageBitmap(file);
            bitmap.close();
            state.removeImage = false;
          } catch {
            state.notice = `${file.name} could not be read as an image.`;
            el.value = "";
            state.imageFileName = "";
          }
        }} /></label>
        {state.imageFileName && <span class="admonition-patterns__filename">Selected: {state.imageFileName}</span>}
        {(imageSource || state.imageFileName) && (
          <div class="admonition-patterns__preview">
            {imageSource && <img src={imageSource} alt="Current pattern image" />}
            <button type="button" disabled={state.busy} onClick$={(_, button) => {
              const input = button.form?.querySelector<HTMLInputElement>("[name='image']");
              if (input) input.value = "";
              state.image = null;
              state.removeImage = true;
              state.imageFileName = "";
              state.notice = "";
            }}>Remove image</button>
          </div>
        )}
        <label>Footline <input value={state.footline} onInput$={(_, el) => state.footline = el.value} /></label>
        <button type="submit" disabled={state.busy}>{state.busy ? "Saving pattern…" : state.id ? "Save pattern" : "Create pattern"}</button>
        {state.id && <button type="button" onClick$={(_, button) => clear$(button.form ?? undefined)}>New pattern</button>}
        {state.notice && <p role="status">{state.notice}</p>}
      </form>
    </div>
  );
});
