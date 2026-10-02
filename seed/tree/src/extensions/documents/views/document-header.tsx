import { component$, useSignal, useStore, useVisibleTask$, type Signal } from "@builder.io/qwik";

import { DocumentDecorations } from "./decorations";

/**
 * The one-line header that stays under the bar once the document's header has
 * scrolled away (`DO_0030_003`): the title, cut, and the `title`
 * contributions in their compact form — the role pills — and a press on it
 * scrolls the document back to the full header. It hangs from a sticky anchor
 * of no height at the top of the scrolling surface, so its appearing moves no
 * content.
 */

/** What the observer reports of the header against the surface's visible
 * area, the part under the bar left out. */
export interface HeaderSighting {
  readonly isIntersecting: boolean;
  readonly boundingClientRect: { readonly top: number };
  readonly rootBounds: { readonly top: number } | null;
}

/** Whether the header has scrolled away above the visible area — not merely
 * out of view below it. Pure. */
export const headerHasLeft = (sighting: HeaderSighting): boolean =>
  !sighting.isIntersecting && sighting.rootBounds !== null && sighting.boundingClientRect.top < sighting.rootBounds.top;

/** The line itself, drawn while the header is away. */
export const CompactLine = component$<{ title: string; documentId: string; dataRevision?: number | undefined }>(
  ({ title, documentId, dataRevision }) => (
    <button
      type="button"
      class="document-header-compact"
      data-document-header-compact
      aria-label={`${title === "" ? "This document" : title}: back to the top`}
      onClick$={(_, element) => {
        // The surface scrolls, not the page: back to the full header.
        const surface = element.closest(".block-surface") as HTMLElement | null;
        if (surface !== null && typeof surface.scrollTo === "function") surface.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      <span class="document-header-compact__title">{title}</span>
      <span class="document-header-compact__places">
        <DocumentDecorations at="title" form="compact" documentId={documentId} dataRevision={dataRevision} />
      </span>
    </button>
  ),
);

/**
 * The anchor and the observer: the header is watched against the surface's
 * visible area below the bar, and the line drawn once it has left. With no
 * observer (the render harness), nothing is drawn.
 */
export const CompactHeader = component$<{
  header: Signal<HTMLElement | undefined>;
  title: string;
  documentId: string;
  dataRevision?: number | undefined;
}>(({ header, title, documentId, dataRevision }) => {
  const sight = useStore({ left: false });
  const anchor = useSignal<HTMLElement>();

  // eslint-disable-next-line qwik/no-use-visible-task -- the observer exists only in the browser
  useVisibleTask$(({ track, cleanup }) => {
    const watched = track(() => header.value);
    const surface = anchor.value?.closest(".block-surface") as HTMLElement | null | undefined;
    const view = watched?.ownerDocument?.defaultView;
    const Observer = (view as typeof globalThis | null | undefined)?.IntersectionObserver;
    if (watched === undefined || surface === null || surface === undefined || view === null || view === undefined || typeof Observer !== "function") return;
    // The bar covers the top of the surface by its padding, so the header has
    // left once it is wholly under the bar.
    const covered = Number.parseFloat(view.getComputedStyle(surface).paddingTop) || 0;
    const observer = new Observer(
      (entries) => {
        const last = entries[entries.length - 1];
        if (last !== undefined) sight.left = headerHasLeft(last);
      },
      { root: surface, rootMargin: `-${Math.round(covered)}px 0px 0px 0px`, threshold: 0 },
    );
    observer.observe(watched);
    cleanup(() => observer.disconnect());
  });

  return (
    <div ref={anchor} class="document-header-anchor" data-document-header-anchor>
      {sight.left && <CompactLine title={title} documentId={documentId} dataRevision={dataRevision} />}
    </div>
  );
});
