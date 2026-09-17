import { $, component$, useContext, useSignal, useStore, useTask$, useVisibleTask$ } from "@builder.io/qwik";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { ViewProps } from "~/components/shell/view-host";
import { ASPECTS } from "../lib/content-index";
import type { PartView, ShapeSummary, ShapeView as Shape } from "../lib/work";

/**
 * The shape tab: the editor of a shape's parts — add, revise, reorder,
 * remove, nest — and its title. PU_0002_006
 */

const PART_CLASSES = ["video", "image", "audio", "prose", "file", "shape"] as const;
const CARDINALITIES: readonly { value: string; label: string }[] = [
  { value: "one", label: "exactly one" },
  { value: "optional", label: "at most one" },
  { value: "some", label: "one or more" },
  { value: "any", label: "any number" },
];

const refusalOf = (body: unknown): string => {
  const failures = (body as { failures?: { detail: string }[] } | null)?.failures;
  return failures === undefined ? "It did not happen." : failures.map((failure) => failure.detail).join(" ");
};

const constraintWords = (part: PartView): string => {
  const c = part.constraints;
  const words: string[] = [];
  if (c.aspect !== undefined) words.push(c.aspect);
  if (c.maxDurationSeconds !== undefined) words.push(`≤${c.maxDurationSeconds}s`);
  if (c.minWidth !== undefined || c.minHeight !== undefined) words.push(`≥${c.minWidth ?? 0}×${c.minHeight ?? 0}`);
  if (c.formats !== undefined && c.formats.length > 0) words.push(c.formats.join("/"));
  return words.join(" · ");
};

export const ShapeView = component$<ViewProps>(({ tab }) => {
  const bridge = useContext(ViewBridgeContext);
  const missing = useSignal(false);
  const state = useStore<{
    shape: Shape | null;
    shapes: ShapeSummary[];
    notice: string | null;
    busy: boolean;
    reads: number;
    title: string;
    part: { title: string; class: string; cardinality: string; role: string; aspect: string; maxDurationSeconds: string; formats: string; shape: string };
  }>({
    shape: null,
    shapes: [],
    notice: null,
    busy: false,
    reads: 0,
    title: "",
    part: { title: "", class: "video", cardinality: "any", role: "", aspect: "", maxDurationSeconds: "", formats: "", shape: "" },
  });

  const read$ = $(async (shapeId: string) => {
    const [response, all] = await Promise.all([fetch(`/api/x/publishing/shapes/${shapeId}`), fetch("/api/x/publishing/shapes")]);
    const body = (await response.json()) as { outcome: "success"; result: Shape } | { outcome: string };
    if (body.outcome !== "success") {
      missing.value = true;
      return;
    }
    state.shape = (body as { result: Shape }).result;
    state.title = state.shape.title;
    const shapes = (await all.json()) as { outcome: "success"; result: ShapeSummary[] } | { outcome: string };
    state.shapes = shapes.outcome === "success" ? (shapes as { result: ShapeSummary[] }).result.filter((shape) => shape.shapeId !== shapeId) : [];
    state.reads += 1;
  });

  useVisibleTask$(async ({ track }) => {
    const shapeId = track(() => tab.itemId);
    if (shapeId === null) return;
    await read$(shapeId);
  });

  const send$ = $(async (path: string, method: string, body?: unknown) => {
    const shapeId = tab.itemId;
    if (shapeId === null || state.busy) return false;
    state.notice = null;
    state.busy = true;
    try {
      const response = await fetch(`/api/x/publishing/shapes/${shapeId}${path}`, {
        method,
        headers: { "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const outcome = (await response.json()) as { outcome: string };
      if (outcome.outcome !== "success") {
        state.notice = refusalOf(outcome);
        return false;
      }
      await read$(shapeId);
      return true;
    } finally {
      state.busy = false;
    }
  });

  const retitle$ = $(async () => {
    if (state.shape === null || state.title.trim() === state.shape.title) return;
    await send$("", "PUT", { title: state.title });
  });

  const addPart$ = $(async () => {
    const p = state.part;
    const constraints: Record<string, unknown> = {};
    if (p.aspect !== "") constraints["aspect"] = p.aspect;
    if (p.maxDurationSeconds.trim() !== "") constraints["maxDurationSeconds"] = Number(p.maxDurationSeconds);
    if (p.formats.trim() !== "") constraints["formats"] = p.formats.split(",").map((format) => format.trim()).filter((format) => format !== "");
    const done = await send$("/parts", "POST", {
      title: p.title,
      class: p.class,
      cardinality: p.cardinality,
      role: p.role,
      constraints: p.class === "shape" ? {} : constraints,
      shape: p.class === "shape" ? p.shape || (state.shapes[0]?.shapeId ?? "") : null,
    });
    if (done) state.part = { ...state.part, title: "", role: "", aspect: "", maxDurationSeconds: "", formats: "" };
  });

  const move$ = $(async (partId: string, direction: -1 | 1) => {
    if (state.shape === null) return;
    const parts = state.shape.parts;
    const at = parts.findIndex((part) => part.partId === partId);
    const target = at + direction;
    if (at < 0 || target < 0 || target > parts.length - 1) return;
    // Moving up places before the one above; moving down places before the one after next, or last.
    const before = direction === -1 ? parts[target]?.partId ?? null : parts[target + 1]?.partId ?? null;
    await send$(`/parts/${partId}/move`, "POST", { before });
  });

  const remove$ = $(async () => {
    const shape = state.shape;
    if (shape === null) return;
    const done = await send$("", "DELETE", { baseRevisionId: shape.revisionId });
    if (done) missing.value = true;
  });

  useTask$(({ track }) => {
    const shape = track(() => state.shape);
    track(() => state.reads);
    if (shape === null) return;
    bridge.inspector.facts = [
      { kind: "count" as const, label: "Parts", value: shape.parts.length },
      ...(shape.nestedIn.length === 0 ? [] : [{ kind: "text" as const, label: "Nested in", value: shape.nestedIn.map((found) => found.title).join(", ") }]),
    ];
    bridge.inspector.actions = [{ kind: "button" as const, id: "delete-shape", label: "Delete shape", destructive: true, run$: remove$ }];
  });

  if (missing.value) {
    return (
      <div class="view view--shape" data-view-body="shape">
        <p data-shape-missing>This shape is gone.</p>
      </div>
    );
  }
  const shape = state.shape;
  if (shape === null) {
    return (
      <div class="view view--shape" data-view-body="shape">
        <p data-shape-loading>Reading the shape…</p>
      </div>
    );
  }
  return (
    <div class="view view--shape" data-view-body="shape">
      <header class="shape__header">
        <input class="shape__title" type="text" aria-label="Shape title" value={state.title} data-shape-title onInput$={(_, element) => (state.title = element.value)} onChange$={() => retitle$()} />
      </header>
      {state.notice !== null && (
        <p class="shape__notice" role="alert" data-shape-notice>
          {state.notice}
        </p>
      )}
      <section class="shape__section" data-shape-parts>
        <h2>Parts</h2>
        {shape.parts.length === 0 ? (
          <p data-shape-empty>No parts yet. A part names what this shape is made of.</p>
        ) : (
          <ol class="shape__parts">
            {shape.parts.map((part, at) => (
              <li key={part.partId} data-part-row={part.partId} data-part-class={part.class}>
                <strong>{part.title}</strong> <code>{part.class === "shape" ? `shape: ${part.shapeTitle ?? part.shape}` : part.class}</code>
                <span> · {CARDINALITIES.find((found) => found.value === part.cardinality)?.label ?? part.cardinality}</span>
                {part.role !== "" && <span> · {part.role}</span>}
                {constraintWords(part) !== "" && <span> · {constraintWords(part)}</span>}
                <span class="shape__part-controls">
                  <button type="button" class="shape__action" aria-label={`Move ${part.title} up`} disabled={state.busy || at === 0} data-part-up onClick$={() => move$(part.partId, -1)}>
                    ↑
                  </button>
                  <button type="button" class="shape__action" aria-label={`Move ${part.title} down`} disabled={state.busy || at === shape.parts.length - 1} data-part-down onClick$={() => move$(part.partId, 1)}>
                    ↓
                  </button>
                  <button type="button" class="shape__action" aria-label={`Remove ${part.title}`} disabled={state.busy} data-part-remove onClick$={() => send$(`/parts/${part.partId}`, "DELETE")}>
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}
        <form class="shape__new-part" data-new-part-form preventdefault:submit onSubmit$={() => addPart$()}>
          <h3>Add a part</h3>
          <label>
            <span>Title</span>
            <input type="text" name="title" value={state.part.title} data-new-part-title onInput$={(_, element) => (state.part.title = element.value)} />
          </label>
          <label>
            <span>Class</span>
            <select name="class" value={state.part.class} data-new-part-class onChange$={(_, element) => (state.part.class = element.value)}>
              {PART_CLASSES.map((partClass) => (
                <option key={partClass} value={partClass}>
                  {partClass}
                </option>
              ))}
            </select>
          </label>
          {state.part.class === "shape" ? (
            <label>
              <span>Nests</span>
              <select name="shape" value={state.part.shape} data-new-part-shape onChange$={(_, element) => (state.part.shape = element.value)}>
                {state.shapes.map((found) => (
                  <option key={found.shapeId} value={found.shapeId}>
                    {found.title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label>
                <span>Role</span>
                <input type="text" name="role" placeholder="what the author makes it as" value={state.part.role} onInput$={(_, element) => (state.part.role = element.value)} />
              </label>
              <label>
                <span>Aspect</span>
                <select name="aspect" value={state.part.aspect} onChange$={(_, element) => (state.part.aspect = element.value)}>
                  <option value="">any</option>
                  {ASPECTS.map((aspect) => (
                    <option key={aspect} value={aspect}>
                      {aspect}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Duration limit (s)</span>
                <input type="number" name="maxDurationSeconds" min="1" value={state.part.maxDurationSeconds} onInput$={(_, element) => (state.part.maxDurationSeconds = element.value)} />
              </label>
              <label>
                <span>Formats</span>
                <input type="text" name="formats" placeholder="mp4, png" value={state.part.formats} onInput$={(_, element) => (state.part.formats = element.value)} />
              </label>
            </>
          )}
          <label>
            <span>Cardinality</span>
            <select name="cardinality" value={state.part.cardinality} onChange$={(_, element) => (state.part.cardinality = element.value)}>
              {CARDINALITIES.map((found) => (
                <option key={found.value} value={found.value}>
                  {found.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" class="shape__action" disabled={state.busy} data-new-part-add>
            Add part
          </button>
        </form>
      </section>
    </div>
  );
});
