import { component$ } from "@builder.io/qwik";

import type { OutputBlockView, OutputItem } from "../server/assemble";
import { FigureCaption, type SetFigure } from "./figure-caption";
import { stripEscapes, tracebackSegments } from "../lib/traceback";

/**
 * What an execution produced (`BO_0289_018`), drawn as it streamed: each
 * stream as text, an error with its traceback, a display or a result as its
 * plain text or its picture from the blob route, a cut said in words, and
 * every file the code wrote as a name that downloads. HTML a kernel answered
 * is shown as text rather than rendered: the code that made it may be a
 * run's, and the reader's page is not where it executes.
 */

const OUTCOME_WORDS: Readonly<Record<string, string>> = {
  ok: "ran",
  error: "ended with an error",
  interrupted: "was interrupted",
  "timed out": "timed out",
  "output cap": "was cut at the output cap",
};

export const OutputBlock = component$<{
  block: OutputBlockView;
  /** Its figure number when the document numbers it, from the read's map
   * rather than the block, so a figure numbered above it relabels this one. BO_0295_014 */
  number?: number | undefined;
  caption$?: SetFigure | undefined;
}>(({ block, number, caption$ }) => {
  const item = (entry: OutputItem, index: number) => {
    switch (entry.kind) {
      case "stream":
        return (
          <pre key={index} class={`output-block__stream output-block__stream--${entry.name}`} data-output-stream={entry.name}>
            {entry.text}
          </pre>
        );
      case "error": {
        // The traceback in colour — the exception's name, each frame's file,
        // line and function — found by the lines' shape once the escapes are
        // stripped, every character kept. BO_0296_019
        const said = entry.traceback.length > 0 ? entry.traceback.map(stripEscapes).join("\n") : `${entry.name}: ${entry.value}`;
        return (
          <pre key={index} class="output-block__error" data-output-error={entry.name}>
            {tracebackSegments(said).map((segment, at) =>
              segment.kind === "text" ? (
                segment.text
              ) : (
                <span key={at} class={`output-block__error-${segment.kind}`} data-error-token={segment.kind}>
                  {segment.text}
                </span>
              ),
            )}
          </pre>
        );
      }
      case "display":
      case "result": {
        const picture = entry.picture !== undefined ? block.pictures[entry.picture] : undefined;
        return (
          <div key={index} class={`output-block__${entry.kind}`} data-output-item={entry.kind}>
            {picture !== undefined ? (
              <img
                class="output-block__picture"
                data-output-picture={picture.objectId}
                src={`/api/blobs/${encodeURIComponent(picture.objectId)}`}
                alt={entry.text ?? picture.filename}
              />
            ) : entry.text !== undefined ? (
              <pre class="output-block__text" data-output-text>
                {entry.text}
              </pre>
            ) : entry.html !== undefined ? (
              <pre class="output-block__text output-block__text--html" data-output-html>
                {entry.html}
              </pre>
            ) : null}
          </div>
        );
      }
      case "cut":
        return (
          <p key={index} class="output-block__cut" data-output-cut={entry.reason}>
            The output was cut: {entry.reason}.
          </p>
        );
      default:
        return null;
    }
  };

  return (
    <figure class="output-block" data-output-block={block.blockId} data-output-of={block.of} data-output-outcome={block.outcome}>
      <div class="output-block__head">
        <span class="output-block__outcome">
          {OUTCOME_WORDS[block.outcome] ?? block.outcome}
          {block.elapsed !== undefined ? ` in ${block.elapsed.toFixed(block.elapsed < 10 ? 2 : 0)} s` : ""}
          {block.executionCount !== undefined ? ` · [${block.executionCount}]` : ""}
        </span>
      </div>
      {block.items.map(item)}
      {block.files.length > 0 && (
        <ul class="output-block__files" data-output-files>
          {block.files.map((file) => (
            <li key={file.objectId}>
              <a
                class="output-block__file"
                data-output-file={file.filename}
                href={`/api/blobs/${encodeURIComponent(file.objectId)}`}
                download={file.filename}
              >
                {file.filename}
              </a>
              <span class="output-block__file-size"> {file.mediaType}, {file.size} bytes</span>
            </li>
          ))}
        </ul>
      )}
      {/* An output that showed a picture is a figure once a person numbers
          it; its caption is theirs, set after accepting it. BO_0295_010 */}
      {block.pictures.length > 0 && (
        <FigureCaption blockId={block.blockId} number={number} numbered={block.numbered} caption={block.caption} caption$={caption$} />
      )}
    </figure>
  );
});
