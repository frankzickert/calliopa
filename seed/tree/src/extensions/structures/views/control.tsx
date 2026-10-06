import {
  $,
  component$,
  useContext,
  useContextProvider,
  useOnDocument,
  useSignal,
  useStore,
  useTask$,
  useVisibleTask$,
} from "@builder.io/qwik";

import { Icon } from "~/components/shell/icons";
import type { BlockDecorationProps, DocumentPlaceProps } from "~/contract";

import {
  FIELD_TYPE_LABELS,
  STRUCTURE_STRUCTURE,
  isFile,
  structureState,
  type FieldDeclaration,
  type FieldValue,
  type FileValue,
  type StructureView,
  type TakenStructure,
} from "../lib/structures";
import { startsRun } from "../lib/children";
import { StructureActs } from "./structure-acts";
import { placePopover, type Box } from "../lib/placement";
import { offerDistance, suggestStructures } from "../lib/suggest";
import { valuesLine } from "../lib/values";
import { pillNote, pillTitle } from "./label";
import { adopt, postStructures, readStructures, StructuresContext, STRUCTURES_CHANGED, type StructuresState } from "./provider";
import { takeOpening } from "./drops";
import { ViewBridgeContext } from "~/components/shell/view-bridge";
import { EditorSurfaceContext } from "~/extensions/documents/views/editor-surface";
import { routeOf } from "~/lib/tabs";
import "./structures.css";

/**
 * The structure control (`BO_0309_021`, `calliopa-bootstrap`'s `BO_0318` folded
 * in): for a block, the structures chip beside the command chip of the block being
 * edited, and for the document, the structures line of its header (`DO_0030_004`):
 * the structures taken as pills and a `+` (`RO_0002_004`), always drawn. It opens
 * a popover holding the structures taken there, each a pill
 * with its own ×, unfolding to its fields; the suggestions, each taken with
 * one press; and a typeahead over the structures that can be taken where the block
 * stands. Taking or clearing a structure, and a value on commit, is written at
 * once as the person's truth, never on *Send* (`BO_0308_Q4`); a refusal is
 * said beside the control in the route's words.
 */

/** Where the control acts: a block, or the document when `blockId` is empty. */
interface Place {
  readonly documentId: string;
  readonly blockId: string;
}

const base = (place: Place): string =>
  `/api/x/structures/documents/${encodeURIComponent(place.documentId)}${place.blockId === "" ? "" : `/blocks/${encodeURIComponent(place.blockId)}`}`;

/** What stands at the place: its structures and what it may take. */
function standingOf(state: StructuresState, place: Place): { structures: readonly TakenStructure[]; takeable: readonly string[]; chain: readonly (readonly string[])[] } {
  const view = state.view;
  if (view === null) return { structures: [], takeable: [], chain: [] };
  const own = (structures: readonly TakenStructure[]) => structures.filter((structure) => structure.proposed !== "structure").map((structure) => structure.id);
  // What stands above the document when it is a block's focused work counts
  // as above it, and above its blocks.
  const inherited = (view.inherited ?? []).map((structure) => structure.id);
  if (place.blockId === "") return { structures: view.structures, takeable: view.takeable, chain: [inherited] };
  const block = view.blocks.find((candidate) => candidate.blockId === place.blockId);
  if (block === undefined) return { structures: [], takeable: [], chain: [] };
  const parent = block.parentId === null ? undefined : view.blocks.find((candidate) => candidate.blockId === block.parentId);
  return {
    structures: block.structures,
    takeable: block.takeable,
    chain: [...(parent === undefined ? [] : [own(parent.structures)]), own(view.structures), inherited],
  };
}

/** The words a suggestion reads: the block's own, or the title's and the
 * document's first words for the document. Read from the page at the press,
 * which is what the person sees. */
function wordsAt(place: Place, host: Element | undefined): string {
  if (host === undefined) return "";
  // The page the control stands in, from its topmost element: the document's
  // root in a browser.
  let page: Element = host;
  while (page.parentElement !== null) page = page.parentElement;
  if (place.blockId !== "")
    return (
      Array.from(page.querySelectorAll("[data-block-id]")).find((element) => element.getAttribute("data-block-id") === place.blockId)
        ?.textContent ?? ""
    );
  const title = page.querySelector("[data-document-title]")?.textContent ?? "";
  const first = page.querySelector("[data-block-id]")?.textContent ?? "";
  return `${title} ${first}`;
}

/** The page a control stands on: where a write's answer is announced. */
const windowOf = (host: Element | undefined): EventTarget | null => host?.ownerDocument ?? null;

/** How long a child's words run in its field: enough to tell one from another. */
const CHILD_WORDS = 60;

/** A block a field holds, by its first words; a block with none says so. */
export const firstWords = (words: string): string => {
  const flat = words.replace(/\s+/gu, " ").trim();
  if (flat === "") return "A block with no words";
  return flat.length > CHILD_WORDS ? `${flat.slice(0, CHILD_WORDS - 1).trimEnd()}…` : flat;
};

/** How far the sheet's handle is swiped down before the sheet closes. */
const SHEET_CLOSES = 80;

/** The shell's phone width, where the popover is a sheet (`structures.css`). */
const PHONE = "(max-width: 640px)";

/** The popover's width where the view has room for it. */
const POPOVER_REM = 22;

/** The part of the view the control stands in that is visible: its nearest
 * scrolling ancestor, cut to the window. */
function frameOf(control: Element, view: Window): Box {
  const whole: Box = { top: 0, left: 0, right: view.innerWidth, bottom: view.innerHeight };
  for (let at = control.parentElement; at !== null; at = at.parentElement) {
    const overflow = view.getComputedStyle(at).overflowY;
    if (overflow !== "auto" && overflow !== "scroll") continue;
    const box = at.getBoundingClientRect();
    return {
      top: Math.max(box.top, whole.top),
      left: Math.max(box.left, whole.left),
      right: Math.min(box.right, whole.right),
      bottom: Math.min(box.bottom, whole.bottom),
    };
  }
  return whole;
}

const byName = (catalogue: readonly StructureView[]) => new Map(catalogue.map((structure) => [structure.id, structure] as const));

/** A value as a suggestion source reads it, or nothing for one not held. */
const asWords = (value: FieldValue | undefined): string | null =>
  typeof value === "string" ? (value === "" ? null : value) : typeof value === "number" || typeof value === "boolean" ? String(value) : null;

/**
 * The values a field's source is asked with (`BO_0336_010`): those of the
 * structures offering this one, then the structure's own over them, so a block leaving
 * a value empty is read as the document holds it.
 */
export function contextOf(structure: TakenStructure, offering: readonly TakenStructure[]): Record<string, string> {
  const context: Record<string, string> = {};
  for (const one of [...offering, structure])
    for (const [key, value] of Object.entries(one.values)) {
      const words = asWords(value);
      if (words !== null) context[key] = words;
    }
  return context;
}

/** Uploads a file through `documents`' blob route and answers the value it
 * becomes, or the refusal in words. */
async function upload(file: File): Promise<FileValue | string> {
  const response = await fetch("/api/x/documents/blobs", {
    method: "POST",
    headers: { "content-type": file.type || "application/octet-stream", "x-calliopa-filename": encodeURIComponent(file.name) },
    body: file,
  }).catch(() => null);
  if (response === null) return "The server could not be reached.";
  const answer = (await response.json().catch(() => ({}))) as {
    outcome?: string;
    result?: { reference?: { hash: string; mediaType: string; size: number; filename?: string } };
    failures?: readonly { detail: string }[];
  };
  const reference = answer.result?.reference;
  if (!response.ok || reference === undefined)
    return answer.failures?.map((failure) => failure.detail).join(" ") ?? `The upload was refused: ${response.status}.`;
  return { hash: reference.hash, filename: reference.filename ?? file.name, mediaType: reference.mediaType, size: reference.size };
}

/** A suggestion as the list draws it. */
interface Offered {
  readonly value: string;
  readonly label?: string;
}

/** The query a source is asked with: the values the subject holds, one
 * parameter per field key. */
const queryOf = (context: Readonly<Record<string, string>>): string => new URLSearchParams(context).toString();

/** What a field's source suggests for these values, through the frame
 * (`calliopa-bootstrap`'s `BO_0336_052`), or why there is nothing. */
async function sourceSuggestions(source: string, context: Readonly<Record<string, string>>): Promise<{ offered: Offered[]; note: string }> {
  const [extension = "", name = ""] = source.split(":");
  const response = await fetch(`/api/suggestions/${encodeURIComponent(extension)}/${encodeURIComponent(name)}?${queryOf(context)}`).catch(() => null);
  if (response === null) return { offered: [], note: "Suggestions could not be read." };
  if (response.status === 404) return { offered: [], note: "Nothing on this instance suggests values here." };
  const answer = (await response.json().catch(() => ({}))) as { suggestions?: readonly Offered[]; note?: string };
  return { offered: [...(answer.suggestions ?? [])], note: answer.note ?? (response.ok ? "" : "Suggestions could not be read.") };
}

/** The suggestions shown for what is typed: the source's, then the field's
 * own words, narrowed by the words typed, none twice. */
export function narrowed(offered: readonly Offered[], typed: string, limit = 8): readonly Offered[] {
  const words = typed.trim().toLowerCase();
  const seen = new Set<string>();
  return offered
    .filter((one) => {
      if (seen.has(one.value)) return false;
      seen.add(one.value);
      return words === "" || one.value.toLowerCase().includes(words) || (one.label ?? "").toLowerCase().includes(words);
    })
    .slice(0, limit);
}

/**
 * A text field that suggests values without limiting them (`BO_0336_010`):
 * focused, it opens what its source answers for the subject's values and the
 * words the field lists, as the structures chip's typeahead does; a press fills
 * one in, and anything typed is kept as typed. A source that does not answer
 * says so in the list, and the field stays typeable.
 */
const SuggestingInput = component$<{
  field: FieldDeclaration;
  value: FieldValue | undefined;
  context: Readonly<Record<string, string>>;
  common: Record<string, unknown>;
  onValue$: (value: FieldValue) => void;
}>(({ field, value, context, common, onValue$ }) => {
  const local = useStore({ open: false, typed: typeof value === "string" ? value : "", offered: [] as Offered[], note: "", reading: false });
  useTask$(({ track }) => {
    const held = track(() => value);
    local.typed = typeof held === "string" ? held : "";
  });
  const open$ = $(async () => {
    local.open = true;
    local.reading = true;
    const own = (field.suggestions ?? []).map((word) => ({ value: word }));
    const answered = field.suggest === undefined ? { offered: [], note: "" } : await sourceSuggestions(field.suggest, context);
    local.offered = [...answered.offered, ...own];
    local.note = answered.note;
    local.reading = false;
  });
  const shown = narrowed(local.offered, local.typed);
  return (
    <span class="structure-control__suggesting" data-field-suggesting={field.key}>
      <input
        {...common}
        type="text"
        autoComplete="off"
        value={local.typed}
        aria-expanded={local.open ? "true" : "false"}
        onFocus$={open$}
        onInput$={(_, element) => {
          local.typed = element.value;
        }}
        onChange$={(_, element) => onValue$(element.value)}
        onBlur$={() => {
          local.open = false;
        }}
        onKeyDown$={(event) => {
          if (event.key === "Escape") local.open = false;
        }}
      />
      {local.open && (
        <ul class="structure-control__offered" data-field-suggestions={field.key}>
          {shown.map((one) => (
            <li key={one.value}>
              <button
                type="button"
                class="structure-control__match"
                data-suggestion={one.value}
                preventdefault:mousedown
                onClick$={async () => {
                  local.typed = one.value;
                  local.open = false;
                  await onValue$(one.value);
                }}
              >
                {one.label ?? one.value}
                {one.label !== undefined && one.label !== one.value && <span class="structure-control__builtin">{one.value}</span>}
              </button>
            </li>
          ))}
          {!local.reading && shown.length === 0 && local.note === "" && (
            <li class="structure-control__empty" data-suggestions-empty>
              {local.offered.length === 0 ? "Nothing to suggest; type a value." : "Nothing suggested matches; what you type is kept."}
            </li>
          )}
          {local.note !== "" && (
            <li class="structure-control__empty" data-suggestions-note>
              {local.note}
            </li>
          )}
        </ul>
      )}
    </span>
  );
});

/** A document a reference may name, by title. */
interface Carrier {
  readonly id: string;
  readonly title: string;
}

/**
 * A reference limited to documents carrying a structure (`BO_0336_011`): chosen
 * by title from the documents carrying it, never typed as an id. Clearing
 * the words clears the value.
 */
const CarryingReference = component$<{
  field: FieldDeclaration & { readonly carrying: string };
  value: FieldValue | undefined;
  title: string;
  common: Record<string, unknown>;
  onValue$: (value: FieldValue) => void;
}>(({ field, value, title, common, onValue$ }) => {
  const local = useStore({ open: false, typed: title, carriers: [] as Carrier[], note: "", reading: false });
  useTask$(({ track }) => {
    track(() => value);
    local.typed = track(() => title);
  });
  const open$ = $(async () => {
    local.open = true;
    local.reading = true;
    const response = await fetch(`/api/x/structures/structures/${encodeURIComponent(field.carrying)}/documents`).catch(() => null);
    const answer = (await response?.json().catch(() => ({})) ?? {}) as { outcome?: string; result?: readonly Carrier[] };
    local.carriers = answer.outcome === "success" ? [...(answer.result ?? [])] : [];
    local.note = response === null || answer.outcome !== "success" ? "The documents could not be read." : local.carriers.length === 0 ? "No document uses that structure yet." : "";
    local.reading = false;
  });
  const words = local.typed.trim().toLowerCase();
  const shown = local.carriers.filter((one) => words === "" || one.title.toLowerCase().includes(words) || one.id === value).slice(0, 8);
  return (
    <span class="structure-control__suggesting" data-field-carrying={field.key}>
      <input
        {...common}
        type="text"
        autoComplete="off"
        placeholder="Choose by title"
        value={local.typed}
        aria-expanded={local.open ? "true" : "false"}
        onFocus$={open$}
        onInput$={(_, element) => {
          local.typed = element.value;
        }}
        onChange$={async (_, element) => {
          if (element.value.trim() === "") await onValue$(null);
        }}
        onBlur$={() => {
          local.open = false;
          local.typed = title;
        }}
        onKeyDown$={(event) => {
          if (event.key === "Escape") local.open = false;
        }}
      />
      {local.open && (
        <ul class="structure-control__offered" data-field-choices={field.key}>
          {shown.map((one) => (
            <li key={one.id}>
              <button
                type="button"
                class="structure-control__match"
                data-choice={one.id}
                data-chosen={one.id === value ? "true" : undefined}
                preventdefault:mousedown
                onClick$={async () => {
                  local.typed = one.title;
                  local.open = false;
                  await onValue$(one.id);
                }}
              >
                {one.title === "" ? "Untitled" : one.title}
              </button>
            </li>
          ))}
          {local.note !== "" && (
            <li class="structure-control__empty" data-choices-note>
              {local.note}
            </li>
          )}
        </ul>
      )}
    </span>
  );
});

/**
 * A reference holding several (`RO_0005_Q3`): each chosen document a pill
 * with its own ×, and the documents carrying the structure chosen by title,
 * the ones chosen left out. Each change posts the whole list.
 */
const CarryingReferences = component$<{
  field: FieldDeclaration & { readonly carrying: string };
  value: readonly string[];
  titles: Readonly<Record<string, string>>;
  common: Record<string, unknown>;
  onValue$: (value: FieldValue) => void;
}>(({ field, value, titles, common, onValue$ }) => {
  const local = useStore({ open: false, typed: "", carriers: [] as Carrier[], note: "" });
  const open$ = $(async () => {
    local.open = true;
    const response = await fetch(`/api/x/structures/structures/${encodeURIComponent(field.carrying)}/documents`).catch(() => null);
    const answer = (await response?.json().catch(() => ({})) ?? {}) as { outcome?: string; result?: readonly Carrier[] };
    local.carriers = answer.outcome === "success" ? [...(answer.result ?? [])] : [];
    local.note = response === null || answer.outcome !== "success" ? "The documents could not be read." : local.carriers.length === 0 ? "No document uses that structure yet." : "";
  });
  const named = (id: string): string => titles[id] ?? local.carriers.find((one) => one.id === id)?.title ?? id;
  const words = local.typed.trim().toLowerCase();
  const shown = local.carriers
    .filter((one) => !value.includes(one.id) && (words === "" || one.title.toLowerCase().includes(words)))
    .slice(0, 8);
  return (
    <span class="structure-control__suggesting structure-control__several" data-field-carrying={field.key} data-field-several>
      {value.length > 0 && (
        <span class="structure-control__chosen">
          {value.map((id) => (
            <span key={id} class="structure-control__chosen-one" data-field-chosen={id}>
              {named(id)}
              <button
                type="button"
                class="structure-control__unchoose"
                aria-label={`Remove ${named(id)}`}
                preventdefault:mousedown
                disabled={common["disabled"] === true}
                onClick$={() => onValue$(value.filter((one) => one !== id))}
              >
                <Icon name="x" />
              </button>
            </span>
          ))}
        </span>
      )}
      <input
        {...common}
        type="text"
        autoComplete="off"
        placeholder="Add by title"
        value={local.typed}
        aria-expanded={local.open ? "true" : "false"}
        onFocus$={open$}
        onInput$={(_, element) => {
          local.typed = element.value;
        }}
        onBlur$={() => {
          local.open = false;
          local.typed = "";
        }}
        onKeyDown$={(event) => {
          if (event.key === "Escape") local.open = false;
        }}
      />
      {local.open && (
        <ul class="structure-control__offered" data-field-choices={field.key}>
          {shown.map((one) => (
            <li key={one.id}>
              <button
                type="button"
                class="structure-control__match"
                data-choice={one.id}
                preventdefault:mousedown
                onClick$={async () => {
                  local.typed = "";
                  await onValue$([...value, one.id]);
                }}
              >
                {one.title === "" ? "Untitled" : one.title}
              </button>
            </li>
          ))}
          {local.note !== "" && (
            <li class="structure-control__empty" data-choices-note>
              {local.note}
            </li>
          )}
        </ul>
      )}
    </span>
  );
});

/** One field's input, by its type; a value is posted on commit. */
const FieldInput = component$<{
  field: FieldDeclaration;
  value: FieldValue | undefined;
  missing: boolean;
  disabled: boolean;
  /** The values a suggestion source is asked with: the subject's, over those
   * of the document structure offering this one. BO_0336_010 */
  context?: Readonly<Record<string, string>>;
  /** What a reference value is called. BO_0336_011 */
  title?: string;
  /** What every node a reference names is called, for a reference holding
   * several (RO_0005_Q3). */
  titles?: Readonly<Record<string, string>>;
  onValue$: (value: FieldValue) => void;
  onRefusal$: (refusal: string) => void;
}>(({ field, value, missing, disabled, context, title, titles, onValue$, onRefusal$ }) => {
  const id = `structure-field-${field.key}`;
  const label = (
    <label class="structure-control__field-label" for={id}>
      {field.name}
      {field.required && (
        <span class="structure-control__required" title="Required">
          {" "}
          *
        </span>
      )}
    </label>
  );
  const common = {
    id,
    class: "structure-control__input",
    disabled,
    "data-structure-field": field.key,
    "data-field-type": field.type,
    "data-missing": missing ? "true" : undefined,
  };
  let input;
  switch (field.type) {
    case "longText":
      input = <textarea {...common} rows={3} value={typeof value === "string" ? value : ""} onChange$={(_, element) => onValue$(element.value)} />;
      break;
    case "number":
      input = (
        <input
          {...common}
          type="number"
          value={typeof value === "number" ? String(value) : ""}
          onChange$={(_, element) => onValue$(element.value.trim() === "" ? null : Number(element.value))}
        />
      );
      break;
    case "date":
      input = <input {...common} type="date" value={typeof value === "string" ? value : ""} onChange$={(_, element) => onValue$(element.value === "" ? null : element.value)} />;
      break;
    case "boolean":
      input = <input {...common} type="checkbox" checked={value === true} onChange$={(_, element) => onValue$(element.checked)} />;
      break;
    case "choice":
      input = (
        <select {...common} onChange$={(_, element) => onValue$(element.value === "" ? null : element.value)}>
          <option value="" selected={typeof value !== "string"}>
            —
          </option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option} selected={value === option}>
              {option}
            </option>
          ))}
        </select>
      );
      break;
    case "reference":
      input = field.many === true && field.carrying !== undefined ? (
        <CarryingReferences
          field={{ ...field, carrying: field.carrying }}
          value={Array.isArray(value) ? (value as readonly string[]) : []}
          titles={titles ?? {}}
          common={common}
          onValue$={onValue$}
        />
      ) : field.carrying !== undefined ? (
        <CarryingReference field={{ ...field, carrying: field.carrying }} value={value} title={title ?? (typeof value === "string" ? value : "")} common={common} onValue$={onValue$} />
      ) : (
        <input
          {...common}
          type="text"
          placeholder="A document's or a block's id"
          value={typeof value === "string" ? value : ""}
          onChange$={(_, element) => onValue$(element.value.trim() === "" ? null : element.value.trim())}
        />
      );
      break;
    case "file":
      input = (
        <span class="structure-control__file">
          {isFile(value) && <span data-structure-file>{value.filename}</span>}
          <input
            {...common}
            type="file"
            onChange$={async (_, element) => {
              const file = element.files?.[0];
              if (file === undefined) return;
              const uploaded = await upload(file);
              if (typeof uploaded === "string") await onRefusal$(uploaded);
              else await onValue$(uploaded);
              element.value = "";
            }}
          />
        </span>
      );
      break;
    default:
      input =
        field.suggest !== undefined || (field.suggestions ?? []).length > 0 ? (
          <SuggestingInput field={field} value={value} context={context ?? {}} common={common} onValue$={onValue$} />
        ) : (
          <input {...common} type="text" value={typeof value === "string" ? value : ""} onChange$={(_, element) => onValue$(element.value)} />
        );
  }
  return (
    <div class="structure-control__field" data-field-row={field.key} title={FIELD_TYPE_LABELS[field.type]}>
      {label}
      {input}
    </div>
  );
});

/** The control itself, for a block or for the document. */
export const StructureControl = component$<{ place: Place; editing: boolean }>(({ place, editing }) => {
  const state = useContext(StructuresContext);
  const bridge = useContext(ViewBridgeContext, null);
  const surface = useContext(EditorSurfaceContext, null);
  const local = useStore({ open: false, expanded: "", query: "", refusal: "", suggested: [] as string[], from: -1, drag: 0 });
  const sheet = useSignal<HTMLElement>();
  const host = useSignal<Element>();
  const subject = place.blockId === "" ? "" : place.blockId;

  const openAt$ = $((structure: string) => {
    local.open = true;
    local.expanded = structure;
    local.refusal = "";
    const standing = standingOf(state, place);
    local.suggested = [
      ...suggestStructures({
        structures: state.catalogue,
        takeable: standing.takeable,
        distance: offerDistance(state.catalogue, standing.chain),
        words: wordsAt(place, host.value),
        taken: standing.structures.map((taken) => taken.id),
      }),
    ];
  });

  // A pill pressed while reading asks the chip standing under the block, once
  // it stands, to open at that structure.
  useTask$(({ track }) => {
    const opening = track(() => state.opening);
    const shown = track(() => editing);
    if (opening === null || !shown || opening.subject !== subject) return;
    state.opening = null;
    void openAt$(opening.structure);
  });

  const take$ = $(async (structure: string, taken: boolean) => {
    const refusal = await postStructures(state, `${base(place)}/structures`, { structure, taken }, windowOf(host.value));
    local.refusal = refusal ?? "";
    if (refusal === null && taken) {
      local.query = "";
      local.expanded = structure;
      local.suggested = local.suggested.filter((id) => id !== structure);
    }
  });

  const value$ = $(async (structure: string, key: string, value: FieldValue) => {
    const refusal = await postStructures(state, `${base(place)}/structures/${encodeURIComponent(structure)}/fields`, { values: { [key]: value } }, windowOf(host.value));
    local.refusal = refusal ?? "";
  });

  const refuse$ = $((refusal: string) => {
    local.refusal = refusal;
  });

  // A field's child opens in its focused work's tab, landing on it, the
  // route the parent's with the block the field stands on — the route an
  // open tab of the child takes too. BO_0349_024 CA_0084_001
  const openChild$ = $(async (itemId: string, title: string, blockId: string) => {
    if (bridge === null || surface === null || itemId === "") return;
    const route = routeOf(surface.tab);
    const parent = route[route.length - 1];
    if (parent !== undefined && place.blockId !== "") route[route.length - 1] = { ...parent, blockId: place.blockId };
    route.push({ itemId, title });
    await bridge.openAlongRoute$({ itemId, title, route, focus: blockId, fromBlock: true });
  });

  // A block taken out of a field stays where it is, in the focused work. BO_0349_021
  const takeChild$ = $(async (structure: string, key: string, child: string) => {
    const refusal = await postStructures(state, `${base(place)}/structures/${encodeURIComponent(structure)}/fields`, { field: key, child, put: false }, windowOf(host.value));
    local.refusal = refusal ?? "";
  });

  // On a phone the popover is a sheet from the bottom of the screen
  // (`structures.css`). It rides above the keyboard: the part of the page the
  // keyboard leaves visible is followed while the sheet is open, and the
  // sheet's bottom and height are set from it. Nothing to follow where the
  // browser has no visual viewport.
  // eslint-disable-next-line qwik/no-use-visible-task -- the visual viewport exists only in the browser
  useVisibleTask$(({ track, cleanup }) => {
    const open = track(() => local.open);
    const element = sheet.value;
    const view = element?.ownerDocument?.defaultView;
    const visible = view?.visualViewport;
    if (!open || element === undefined || view === undefined || view === null || visible === undefined || visible === null) return;
    if (typeof visible.addEventListener !== "function") return;
    const follow = () => {
      const below = Math.max(0, view.innerHeight - visible.height - visible.offsetTop);
      element.style.setProperty("--structures-sheet-bottom", `${below}px`);
      element.style.setProperty("--structures-sheet-room", `${visible.height}px`);
    };
    follow();
    visible.addEventListener("resize", follow);
    visible.addEventListener("scroll", follow);
    cleanup(() => {
      visible.removeEventListener("resize", follow);
      visible.removeEventListener("scroll", follow);
    });
  });

  // Above the phone width the popover is fixed where `placePopover` says
  // (`RO_0004_001`): measured against the chip and the part of the view
  // that is visible, on opening and again as anything scrolls or the window
  // resizes, so it stands inside the view and never lengthens the page. The
  // place is written on the control, which the popover inherits it from, and
  // the popover is hidden until it is. While it is open a press outside it and
  // its chip closes it and still acts where it lands (`RO_0004_006`); a
  // field's pending value is committed first. At the phone width the sheet
  // and its dimmed page do both instead.
  // eslint-disable-next-line qwik/no-use-visible-task -- measured and listened for only in the browser
  useVisibleTask$(({ track, cleanup }) => {
    const open = track(() => local.open);
    const control = host.value as HTMLElement | undefined;
    const doc = control?.ownerDocument;
    const view = doc?.defaultView;
    if (!open || control === undefined || doc === undefined || view === undefined || view === null) return;
    const phone = () => typeof view.matchMedia === "function" && view.matchMedia(PHONE).matches;
    const place = () => {
      // Nothing to measure in a page with no layout.
      if (phone() || typeof control.getBoundingClientRect !== "function" || typeof view.getComputedStyle !== "function") return;
      const chip = control.getBoundingClientRect();
      const rem = Number.parseFloat(view.getComputedStyle(doc.documentElement).fontSize) || 16;
      const placement = placePopover({
        chip,
        frame: frameOf(control, view),
        width: POPOVER_REM * rem,
        // A block's chip stands at the right of its row, the title's at the
        // start of the header's structures line. DO_0030_004
        align: subject === "" ? "start" : "end",
        viewportHeight: view.innerHeight,
      });
      // The control's own style holds nothing else, so the place is written
      // as the whole of it.
      control.setAttribute(
        "style",
        [
          `--structures-top: ${placement.top === null ? "auto" : `${placement.top}px`}`,
          `--structures-bottom: ${placement.bottom === null ? "auto" : `${placement.bottom}px`}`,
          `--structures-left: ${placement.left}px`,
          `--structures-width: ${placement.width}px`,
          `--structures-room: ${placement.maxHeight}px`,
        ].join("; "),
      );
      control.setAttribute("data-structures-side", placement.side);
    };
    const press = (event: Event) => {
      if (phone()) return;
      const target = event.target as Node | null;
      if (target !== null && control.contains(target)) return;
      const active = doc.activeElement as HTMLElement | null;
      if (active !== null && control.contains(active)) active.blur();
      local.open = false;
    };
    // The dimmed page, then the popover, raised into the top layer where the
    // browser has one, so no bar of the shell stands over either (the walk
    // of RO_0004_005). Where it has none they stay where the page draws them.
    for (const selector of ["[data-structures-backdrop]", "[data-structures-popover]"]) {
      const layer = control.querySelector(selector) as (HTMLElement & { showPopover?: () => void }) | null;
      if (layer === null || typeof layer.showPopover !== "function") continue;
      try {
        layer.showPopover();
      } catch {
        // Already shown.
      }
    }
    place();
    view.addEventListener("resize", place);
    doc.addEventListener("scroll", place, { capture: true, passive: true });
    doc.addEventListener("pointerdown", press, true);
    cleanup(() => {
      view.removeEventListener("resize", place);
      doc.removeEventListener("scroll", place, { capture: true });
      doc.removeEventListener("pointerdown", press, true);
      control.removeAttribute("data-structures-side");
      control.removeAttribute("style");
    });
  });

  if (!state.loaded || !state.reachable || state.view === null) return null;
  const standing = standingOf(state, place);
  const catalogue = byName(state.catalogue);
  const takenIds = standing.structures.map((structure) => structure.id);
  const query = local.query.trim().toLowerCase();
  const matches = standing.takeable
    .filter((id) => !takenIds.includes(id))
    .map((id) => catalogue.get(id))
    .filter((structure): structure is StructureView => structure !== undefined && (query === "" || structure.name.toLowerCase().includes(query)))
    .slice(0, 8);
  const suggestions = local.suggested
    .filter((id) => !takenIds.includes(id) && standing.takeable.includes(id))
    .map((id) => catalogue.get(id))
    .filter((structure): structure is StructureView => structure !== undefined);
  const what = place.blockId === "" ? "this document" : "this block";
  /** The document's structures offering a block's structure: a *Variation* block reads
   * its format's values for what it leaves empty. BO_0336_010 */
  const offeringStructures = (structureId: string): readonly TakenStructure[] =>
    (state.view?.structures ?? []).filter((taken) => catalogue.get(taken.id)?.offers.includes(structureId) === true);
  const referenceTitle = (held: FieldValue | undefined): string | undefined =>
    typeof held === "string" ? state.view?.referenceTitles?.[held] : undefined;
  return (
    <span ref={host} class="structure-control" data-structure-control={subject === "" ? "document" : subject} data-structure-form="pills" data-open={local.open ? "true" : undefined} stoppropagation:click>
      {/* The structures at rest, each a pill opening its fields, then a `+`
          opening the typeahead and the suggestions; a second press on what is
          open closes it. Each keeps the caret where it is. */}
      {standing.structures.map((structure) => {
        const note = pillNote(structure);
        const opened = local.open && local.expanded === structure.id;
        return (
          <button
            key={structure.id}
            type="button"
            class="block-structure structure-control__chip-structure"
            data-chip-structure={structure.id}
            data-structure-state={note ?? undefined}
            data-structure-missing={structure.missing.length > 0 ? "true" : undefined}
            aria-expanded={opened ? "true" : "false"}
            aria-label={pillTitle(structure)}
            title={pillTitle(structure)}
            preventdefault:mousedown
            onClick$={() => (opened ? (local.open = false) : openAt$(structure.id))}
          >
            <span class="block-structure__name">{structure.name}</span>
            {structure.missing.length > 0 && (
              <span class="block-structure__missing" aria-hidden="true">
                !
              </span>
            )}
            {note !== null && <span class="block-structure__state">{note}</span>}
          </button>
        );
      })}
      <button
        type="button"
        class="structure-control__add"
        aria-label={`Add a structure to ${what}`}
        title={`Add a structure to ${what}`}
        aria-expanded={local.open && local.expanded === "" ? "true" : "false"}
        data-structures-add
        preventdefault:mousedown
        onClick$={() => (local.open && local.expanded === "" ? (local.open = false) : openAt$(""))}
      >
        <Icon name="plus" />
      </button>
      {local.open && (
        // On a phone, the page above the sheet, dimmed: a tap there closes
        // it, and keeps the caret where it was. Hidden on a wider screen. In
        // the top layer, as the popover is, so it dims the shell's bars too.
        <div
          class="structure-control__backdrop"
          data-structures-backdrop
          popover="manual"
          aria-hidden="true"
          preventdefault:mousedown
          stoppropagation:touchstart
          stoppropagation:touchmove
          onClick$={() => {
            local.open = false;
          }}
        />
      )}
      {local.open && (
        <div
          ref={sheet}
          class="structure-control__popover"
          popover="manual"
          role="dialog"
          aria-label={`Structures of ${what}`}
          data-structures-popover
          data-dragging={local.from >= 0 ? "true" : undefined}
          style={local.drag > 0 ? { "--structures-sheet-drag": `${local.drag}px` } : undefined}
          stoppropagation:keydown
          stoppropagation:input
          stoppropagation:touchstart
          stoppropagation:touchmove
          stoppropagation:touchend
        >
          {/* The sheet's handle, on a phone: swiped down far enough, the sheet
              closes; let go sooner, it settles back. */}
          <div
            class="structure-control__handle"
            data-structures-handle
            aria-hidden="true"
            onTouchStart$={(event) => {
              const touch = event.touches?.[0];
              if (touch === undefined) return;
              local.from = touch.clientY;
              local.drag = 0;
            }}
            onTouchMove$={(event) => {
              const touch = event.touches?.[0];
              if (touch === undefined || local.from < 0) return;
              local.drag = Math.max(0, touch.clientY - local.from);
            }}
            onTouchEnd$={() => {
              if (local.drag > SHEET_CLOSES) local.open = false;
              local.from = -1;
              local.drag = 0;
            }}
            onTouchCancel$={() => {
              local.from = -1;
              local.drag = 0;
            }}
          />
          {standing.structures.length > 0 && (
            <ul class="structure-control__taken" data-structures-taken>
              {standing.structures.map((structure) => {
                const expanded = local.expanded === structure.id;
                const note = structure.proposed === "structure" ? "proposed" : structureState(structure);
                return (
                  <li key={structure.id} class="structure-control__structure" data-taken-structure={structure.id} data-expanded={expanded ? "true" : undefined}>
                    <span class="structure-control__pill">
                      <button
                        type="button"
                        class="structure-control__expand"
                        aria-expanded={expanded ? "true" : "false"}
                        aria-label={`${expanded ? "Fold" : "Unfold"} the fields of ${structure.name}`}
                        preventdefault:mousedown
                        disabled={structure.fields.length === 0}
                        onClick$={() => {
                          local.expanded = expanded ? "" : structure.id;
                        }}
                      >
                        <Icon name={expanded ? "caret-down" : "caret-right"} />
                        <span class="structure-control__name">{structure.name}</span>
                        {structure.missing.length > 0 && <span class="structure-control__missing" title="A required value is missing">!</span>}
                        {note !== null && <span class="structure-control__note">{note}</span>}
                      </button>
                      {/* A structure stays one: Structure carries no ×
                          (RO_0005_Q9). */}
                      {structure.proposed !== "structure" && structure.id !== STRUCTURE_STRUCTURE && (
                        <button
                          type="button"
                          class="structure-control__clear"
                          aria-label={`Remove ${structure.name}`}
                          title={`Remove ${structure.name}`}
                          data-clear-structure={structure.id}
                          preventdefault:mousedown
                          disabled={state.busy}
                          onClick$={() => take$(structure.id, false)}
                        >
                          <Icon name="x" />
                        </button>
                      )}
                    </span>
                    {expanded && structure.fields.length > 0 && structure.proposed !== "structure" && (
                      <div class="structure-control__fields" data-structure-fields={structure.id}>
                        {structure.fields.map((field) => {
                          const children = structure.children?.[field.key] ?? [];
                          // A field holding blocks reads as them; a text field
                          // is edited in them, so it draws no input while they
                          // stand, and a value typed before returns once the
                          // last is taken out (BO_0349_021).
                          const list = children.length === 0 ? null : (
                            <ul key={`${field.key}:children`} class="structure-control__children" data-field-children={field.key} aria-label={`${field.name}: the blocks it holds`}>
                              {children.map((child) => (
                                <li key={child.blockId} class="structure-control__child" data-field-child={child.blockId}>
                                  {child.documentId === undefined ? (
                                    <span class="structure-control__child-words">{firstWords(child.words)}</span>
                                  ) : (
                                    // A child opens its focused work at itself, in a
                                    // tab of its own along the route. BO_0349_024
                                    <button
                                      type="button"
                                      class="structure-control__child-words structure-control__child-open"
                                      data-open-child={child.blockId}
                                      title={`Open ${child.documentTitle ?? "its focused work"} at this block`}
                                      preventdefault:mousedown
                                      onClick$={() => openChild$(child.documentId ?? "", child.documentTitle ?? "", child.blockId)}
                                    >
                                      {firstWords(child.words)}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    class="structure-control__clear"
                                    aria-label={`Take it out of ${field.name}`}
                                    title={`Take it out of ${field.name}`}
                                    data-take-child={child.blockId}
                                    preventdefault:mousedown
                                    disabled={state.busy}
                                    onClick$={() => takeChild$(structure.id, field.key, child.blockId)}
                                  >
                                    <Icon name="x" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          );
                          if (list !== null && !startsRun(field))
                            return (
                              <div key={field.key} class="structure-control__field-children">
                                <span class="structure-control__heading">{field.name}</span>
                                {list}
                              </div>
                            );
                          return [
                          <FieldInput
                            key={field.key}
                            field={field}
                            value={structure.values[field.key]}
                            missing={structure.missing.includes(field.key)}
                            disabled={state.busy}
                            context={contextOf(structure, place.blockId === "" ? [] : offeringStructures(structure.id))}
                            {...(referenceTitle(structure.values[field.key]) === undefined ? {} : { title: referenceTitle(structure.values[field.key]) as string })}
                            titles={state.view?.referenceTitles ?? {}}
                            onValue$={(value) => value$(structure.id, field.key, value)}
                            onRefusal$={refuse$}
                          />,
                          list,
                          ];
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {suggestions.length > 0 && (
            <div class="structure-control__suggestions" data-structure-suggestions>
              <span class="structure-control__heading">
                <Icon name="sparkle" /> Suggested
              </span>
              {suggestions.map((structure) => (
                <button
                  key={structure.id}
                  type="button"
                  class="structure-control__suggestion"
                  data-suggested-structure={structure.id}
                  preventdefault:mousedown
                  disabled={state.busy}
                  onClick$={() => take$(structure.id, true)}
                >
                  <Icon name="plus" /> {structure.name}
                </button>
              ))}
            </div>
          )}
          <label class="structure-control__search">
            <span class="visually-hidden">Find a structure to add</span>
            <input
              type="text"
              class="structure-control__query"
              placeholder="Add a structure…"
              value={local.query}
              data-structure-query
              onInput$={(_, element) => {
                local.query = element.value;
              }}
              onKeyDown$={(event) => {
                if (event.key === "Enter" && matches[0] !== undefined) void take$(matches[0].id, true);
                if (event.key === "Escape") local.open = false;
              }}
            />
          </label>
          {matches.length > 0 ? (
            <ul class="structure-control__matches" data-structure-matches>
              {matches.map((structure) => (
                <li key={structure.id}>
                  <button
                    type="button"
                    class="structure-control__match"
                    data-take-structure={structure.id}
                    title={structure.description === "" ? structure.name : structure.description}
                    preventdefault:mousedown
                    disabled={state.busy}
                    onClick$={() => take$(structure.id, true)}
                  >
                    {structure.name}
                    {structure.builtin && <span class="structure-control__builtin">built in</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p class="structure-control__empty" data-structure-matches-empty>
              {query === "" ? `No more structures can be used on ${what}.` : `No structure here matches “${local.query.trim()}”.`}
            </p>
          )}
          {local.refusal !== "" && (
            <p class="structure-control__refusal" role="alert" data-structure-refusal>
              {local.refusal}
            </p>
          )}
        </div>
      )}
    </span>
  );
});

/** The control in the structures chip below a block's command chip. RO_0002_004 */
export const BlockStructureControl = component$<BlockDecorationProps>(({ documentId, blockId, active }) => (
  <StructureControl place={{ documentId, blockId }} editing={active} />
));

/** How wide the *+N* pill is taken to be when the compact line counts
 * what does not fit, in CSS px. */
const MORE_WIDTH = 34;

/**
 * How many of the pills fit a line `room` wide, `gap` apart, the rest
 * counted by a *+N* pill `more` wide (`DO_0030_004`): every pill when all
 * fit, else as many as leave room for the count. Pure.
 */
export function fittingPills(widths: readonly number[], gap: number, room: number, more = MORE_WIDTH): number {
  const span = (count: number) => widths.slice(0, count).reduce((sum, width) => sum + width, 0) + gap * Math.max(0, count - 1);
  if (span(widths.length) <= room) return widths.length;
  let count = widths.length - 1;
  while (count > 0 && span(count) + gap + more > room) count -= 1;
  return count;
}

/** A pill in the compact line: a name, muted when it comes from above. */
interface CompactPill {
  readonly key: string;
  readonly name: string;
  readonly fromAbove: boolean;
}

/**
 * The document's structures in the one-line header that stays under the bar
 * (`DO_0030_004`): the pills alone, as words, no `+` and no popover — a press
 * on the line is the header's — on one line, and where they do not fit a
 * last *+N* counting the rest. The widths are measured once all are drawn and
 * the count follows the line's width from them.
 */
const CompactStructures = component$<{ pills: readonly CompactPill[] }>(({ pills }) => {
  const line = useSignal<HTMLElement>();
  const fit = useStore({ shown: -1, widths: [] as number[] });

  // eslint-disable-next-line qwik/no-use-visible-task -- measures what the browser drew
  useVisibleTask$(({ track, cleanup }) => {
    track(() => pills.map((pill) => pill.key).join("|"));
    fit.shown = -1;
    fit.widths = [];
    const element = line.value;
    const view = element?.ownerDocument?.defaultView;
    if (element === undefined || view === undefined || view === null || typeof view.requestAnimationFrame !== "function") return;
    const recount = () => {
      if (fit.widths.length === 0) return;
      const gap = Number.parseFloat(view.getComputedStyle(element).columnGap) || 0;
      const count = fittingPills(fit.widths, gap, element.clientWidth);
      fit.shown = count === fit.widths.length ? -1 : count;
    };
    const frame = view.requestAnimationFrame(() => {
      fit.widths = Array.from(element.querySelectorAll<HTMLElement>("[data-compact-structure]")).map((pill) => pill.offsetWidth);
      recount();
    });
    const Observer = (view as typeof globalThis).ResizeObserver;
    const watching = typeof Observer === "function" ? new Observer(recount) : null;
    watching?.observe(element);
    cleanup(() => {
      view.cancelAnimationFrame(frame);
      watching?.disconnect();
    });
  });

  if (pills.length === 0) return null;
  const shown = fit.shown < 0 ? pills : pills.slice(0, fit.shown);
  const rest = pills.length - shown.length;
  return (
    <span ref={line} class="title-structures title-structures--compact" data-title-structures="compact">
      {shown.map((pill) => (
        <span key={pill.key} class="block-structure" data-compact-structure={pill.key} data-structure-state={pill.fromAbove ? "from above" : undefined}>
          <span class="block-structure__name">{pill.name}</span>
        </span>
      ))}
      {rest > 0 && (
        <span class="block-structure" data-structures-more aria-label={`${rest} more ${rest === 1 ? "structure" : "structures"}`}>
          +{rest}
        </span>
      )}
    </span>
  );
});

/**
 * The values line under the structures line (`DO_0030_005`): per own structure holding
 * a filled value, its name and the values as a person reads them, entries
 * apart by *·*. Nothing when no value is filled. It reads the state the
 * title's control holds, so a value committed in the popover shows at once.
 */
export const ValuesLine = component$<{ structures: readonly TakenStructure[]; titles: Readonly<Record<string, string>> }>(({ structures, titles }) => {
  const entries = valuesLine(structures, titles);
  if (entries.length === 0) return null;
  return (
    <p class="title-values" data-structure-values>
      {entries.map((entry, index) => (
        <span key={entry.structure} class="title-values__entry" data-structure-values-of={entry.structure}>
          {index > 0 && (
            <span class="title-values__apart" aria-hidden="true">
              {" · "}
            </span>
          )}
          <span class="title-values__structure">{entry.name}:</span> {entry.values.join(", ")}
        </span>
      ))}
    </p>
  );
});

/**
 * The document's rows in its header (`BO_0309_030`, `BO_0309_031`, reshaped
 * by `DO_0030_004` and `DO_0030_005`): the structures line — the structures from above
 * first, muted and never removable here, then the document's own pills and a
 * `+`, always drawn — and the values line under it. In the compact header the
 * pills alone. The title stands outside the document's decoration provider,
 * so this place holds its own state, read when it is first shown, and keeps
 * it and the provider's current through the announced answer of every write.
 */
export const TitleStructureControl = component$<DocumentPlaceProps>(({ documentId, form, dataRevision }) => {
  const state = useStore<StructuresState>({
    loaded: false,
    reachable: false,
    catalogue: [],
    view: null,
    busy: false,
    opening: null,
  });
  useContextProvider(StructuresContext, state);

  // eslint-disable-next-line qwik/no-use-visible-task -- read in the browser with the person's session, once the line is shown
  useVisibleTask$(async ({ track }) => {
    const id = track(() => documentId);
    // Read again as the document changes, and open on a structure a drop on
    // the header just used. BO_0349_037
    track(() => dataRevision);
    await readStructures(state, id);
    const opening = takeOpening(id, true);
    if (opening !== null) state.opening = opening;
  });

  useOnDocument(
    STRUCTURES_CHANGED,
    $((event: Event) => adopt(state, documentId, event)),
  );

  const inherited = state.view?.inherited ?? [];
  const own = state.view?.structures ?? [];
  const thisStructure = state.catalogue.find((structure) => structure.id === documentId);
  if (form === "compact")
    return (
      <CompactStructures
        pills={[
          ...inherited.map((structure) => ({ key: `${structure.on}:${structure.id}`, name: structure.name, fromAbove: true })),
          ...own.map((structure) => ({ key: structure.id, name: structure.name, fromAbove: false })),
        ]}
      />
    );
  return (
    <div class="title-structures" data-title-structures="full">
      <div class="title-structures__line">
        {inherited.length > 0 && (
          <span class="block-structures" data-inherited-structures>
            {inherited.map((structure) => (
              <span
                key={`${structure.on}:${structure.id}`}
                class="block-structure"
                data-inherited-structure={structure.id}
                data-structure-state="from above"
                title={`${structure.name}, from the block this was opened from${structure.description === "" ? "" : `: ${structure.description}`}`}
              >
                <span class="block-structure__name">{structure.name}</span>
                <span class="block-structure__state">from above</span>
              </span>
            ))}
          </span>
        )}
        <StructureControl place={{ documentId, blockId: "" }} editing={true} />
      </div>
      <ValuesLine structures={own} titles={state.view?.referenceTitles ?? {}} />
      {/* A structure's document carries its acts beside its lines (RO_0005_004). */}
      {own.some((structure) => structure.id === STRUCTURE_STRUCTURE) && thisStructure !== undefined && (
        <StructureActs structure={thisStructure} state={state} documentId={documentId} />
      )}
    </div>
  );
});
