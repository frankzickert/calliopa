import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";

import type { MediaBlockView } from "../server/assemble";
import { FigureCaption, type SetFigure } from "./figure-caption";

/**
 * A picture or a moving picture in a document (`BO_0273_011`).
 *
 * Two things decide the shape. **Retrieval serves every object as
 * `application/octet-stream`** by the mirror rule, which an `<img>` sniffs its
 * own way past but a media element will not — so a video is fetched and
 * retyped from the reference's own `mediaType` into an object URL before the
 * element is given a source, while an image streams straight from the route
 * (`calliopa-bootstrap`'s `docs/system/binary-content.md`, the lesson the
 * first uploading surface already paid for). **The route is the shell's
 * `/api/blobs/<objectId>`**, not CCGW's own `/v1/blobs`, which the app origin
 * does not forward: pointed there, a made picture drew nothing at all
 * (`BO_0273_046`). And **the box is reserved before
 * the bytes arrive**, from the block's own `width` and `height`, because the
 * blob reference carries no dimensions and nothing may move when they land.
 *
 * A block with no object is a generation not made yet: it draws its box with
 * its words and says so, and whatever offered it draws its own control there
 * through the `below` place.
 */
export const MediaBlock = component$<{
  block: MediaBlockView;
  /** A picture's number when the document numbers it, from the read's map
   * rather than the block, so a picture numbered above it relabels this one. BO_0295_014 */
  number?: number | undefined;
  caption$?: SetFigure | undefined;
}>(({ block, number, caption$ }) => {
  const source = useSignal<string | null>(null);

  // A video only. The element cannot be handed the route directly, and the
  // object URL is revoked when the block goes so a long document does not
  // keep every video it has drawn.
  useVisibleTask$(({ track, cleanup }) => {
    const objectId = track(() => block.objectId);
    const mediaType = track(() => block.mediaType);
    if (block.kind !== "video" || objectId === undefined) return;
    let url: string | null = null;
    let dropped = false;
    void fetch(`/api/blobs/${encodeURIComponent(objectId)}`)
      .then((answer) => (answer.ok ? answer.blob() : null))
      .then((bytes) => {
        if (bytes === null || dropped) return;
        url = URL.createObjectURL(
          mediaType === undefined ? bytes : new Blob([bytes], { type: mediaType }),
        );
        source.value = url;
      })
      .catch(() => undefined);
    cleanup(() => {
      dropped = true;
      if (url !== null) URL.revokeObjectURL(url);
    });
  });

  // The reserved box. Absent dimensions leave the element to its own size
  // rather than inventing one.
  const box =
    block.width !== undefined && block.height !== undefined
      ? { "--media-width": `${block.width}`, "--media-height": `${block.height}` }
      : undefined;

  // A picture's caption and number (`BO_0295_010`); a moving picture has
  // neither.
  const caption =
    block.kind === "image" ? (
      <FigureCaption blockId={block.blockId} number={number} numbered={block.numbered} caption={block.caption} caption$={caption$} />
    ) : null;

  if (block.objectId === undefined) {
    return (
      <div class="media-block__figure">
      <div
        class="media-block media-block--pending"
        data-media-pending={block.kind}
        style={box}
        role="img"
        aria-label={`${block.alt ?? (block.kind === "video" ? "A moving picture" : "A picture")}, not made yet`}
      >
        <span class="media-block__words">{block.alt ?? ""}</span>
      </div>
      {caption}
      </div>
    );
  }

  if (block.kind === "image") {
    return (
      <figure class="media-block__figure">
      <img
        class="media-block media-block__image"
        data-media-image={block.objectId}
        src={`/api/blobs/${encodeURIComponent(block.objectId)}`}
        alt={block.alt ?? ""}
        width={block.width}
        height={block.height}
        style={box}
      />
      {caption}
      </figure>
    );
  }

  return (
    <video
      class="media-block media-block__video"
      data-media-video={block.objectId}
      controls
      preload="metadata"
      aria-label={block.alt ?? "A moving picture"}
      width={block.width}
      height={block.height}
      style={box}
      {...(source.value !== null ? { src: source.value } : {})}
    />
  );
});
