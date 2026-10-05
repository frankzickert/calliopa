import { $, component$, useSignal, useStore, useVisibleTask$, type QRL } from "@builder.io/qwik";

import { erasesAt, learnedOn, NOTHING_LEARNED, readLearned, type LearnedRead } from "~/lib/learned";
import type { Layout } from "~/lib/layout";
import { sectionState } from "~/lib/layout";
import { SectionHeader } from "./panel";

/**
 * *What Hermes learned* (`BO_0350_023`): a category of the right panel, after
 * *Execution*, on every tab and with nothing open, listing what Hermes keeps
 * of the reader — one row for each thing learned, its words and the day it
 * was learned, newest first. A row is erased by a left swipe, or by Delete on
 * the row turned to: no button. The memory is the reader's own, and the
 * kernel answers nobody else's (`calliopa-bootstrap`'s `BO_0350_062`).
 */
export const LEARNED_SECTION = "ui.shell:learned";

export const LearnedSection = component$<{
  layout: Layout;
  onToggle$: QRL<() => void>;
}>(({ layout, onToggle$ }) => {
  const read = useSignal<LearnedRead>(NOTHING_LEARNED);
  const status = useStore({ loaded: false, error: null as string | null });
  const collapsed = sectionState(layout, LEARNED_SECTION) === "collapsed";

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    try {
      const response = await fetch("/api/hermes/learned");
      read.value = readLearned(response.ok ? await response.json() : null);
    } catch {
      read.value = NOTHING_LEARNED;
    }
    status.loaded = true;
  });

  const erase$ = $(async (id: string) => {
    const response = await fetch(`/api/hermes/learned/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    if (response === null || (response.status !== 204 && response.status !== 404)) {
      status.error = "Hermes did not answer, so nothing was erased.";
      return;
    }
    status.error = null;
    read.value = { ...read.value, learned: read.value.learned.filter((row) => row.id !== id) };
  });

  return (
    <section class="learned library-category" data-learned aria-labelledby="learned-heading">
      <SectionHeader
        layout={layout}
        sectionKey={LEARNED_SECTION}
        name="learned"
        elementId="learned-heading"
        title="What Hermes learned"
        collapsible={true}
        onToggle$={onToggle$}
        onCreate$={$(() => undefined)}
      />
      <div id="learned-heading-list" class="library-category__body" hidden={collapsed}>
        {status.error !== null && (
          <p class="learned__notice" role="status" data-learned-error>
            {status.error}
          </p>
        )}
        {status.loaded && read.value.memory === "off" && read.value.learned.length === 0 ? (
          <p class="learned__notice" data-learned-off>
            Hermes keeps no memory on this instance
          </p>
        ) : status.loaded && read.value.learned.length === 0 ? (
          <p class="learned__notice" data-learned-empty>
            Nothing learned yet
          </p>
        ) : (
          <ul class="learned__list" aria-label="What Hermes learned about you">
            {read.value.learned.map((row) => (
              <li
                key={row.id}
                class="learned__row"
                data-learned-row={row.id}
                tabIndex={0}
                aria-label={`${row.words}${learnedOn(row.at) === "" ? "" : `, learned ${learnedOn(row.at)}`}. Delete erases it.`}
                onKeyDown$={(event: KeyboardEvent) => {
                  if (event.key === "Delete" || event.key === "Backspace") void erase$(row.id);
                }}
                onPointerDown$={(event: PointerEvent, element: HTMLElement) => {
                  element.dataset["swipeFrom"] = String(event.clientX);
                }}
                onPointerMove$={(event: PointerEvent, element: HTMLElement) => {
                  const from = Number(element.dataset["swipeFrom"] ?? "NaN");
                  if (Number.isNaN(from)) return;
                  const dx = Math.min(0, event.clientX - from);
                  element.style.transform = dx === 0 ? "" : `translateX(${dx}px)`;
                }}
                onPointerUp$={(event: PointerEvent, element: HTMLElement) => {
                  const from = Number(element.dataset["swipeFrom"] ?? "NaN");
                  delete element.dataset["swipeFrom"];
                  element.style.transform = "";
                  if (!Number.isNaN(from) && erasesAt(event.clientX - from, element.getBoundingClientRect().width)) void erase$(row.id);
                }}
                onPointerCancel$={(_: PointerEvent, element: HTMLElement) => {
                  delete element.dataset["swipeFrom"];
                  element.style.transform = "";
                }}
              >
                <span class="learned__words">{row.words}</span>
                {learnedOn(row.at) !== "" && <span class="learned__day">{learnedOn(row.at)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
});
