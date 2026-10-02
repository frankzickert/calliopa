import { component$, useContext } from "@builder.io/qwik";

import type { DocumentPlaceProps } from "~/contract";

import { OUTCOME_WORDS, type RenditionView } from "../lib/rendition";
import { RenditionsContext } from "./provider";
import "./manuscripts.css";

/**
 * What a document carrying *Format* was produced as (`calliopa-bootstrap`'s
 * `BO_0312_022`, `BO_0332_031`): its renditions newest first, each when and by
 * whom, the outcome, what was left out, what the typesetting said, and each
 * file as a link — the PDF opened inline, the source and its references
 * downloaded. Drawn at the document's end. A rendition never changes, so this
 * only reads.
 */
const RenditionList = component$<{ renditions: readonly RenditionView[] }>(({ renditions }) => (
  <ul class="renditions" data-renditions>
    {renditions.map((rendition) => {
      const href = (name: string) => `/api/x/manuscripts/renditions/${encodeURIComponent(rendition.renditionId)}/files/${encodeURIComponent(name)}`;
      return (
        <li key={rendition.renditionId} class="renditions__item" data-rendition={rendition.renditionId}>
          <p class="renditions__facts">
            <span data-rendition-outcome={rendition.outcome}>{OUTCOME_WORDS[rendition.outcome]}</span>
            {rendition.venue !== "" && ` · ${rendition.venue}`} · <time dateTime={rendition.made}>{rendition.made.slice(0, 16).replace("T", " ")}</time>
            {rendition.by !== "" && ` · ${rendition.by}`} · revision {rendition.revision}
          </p>
          <ul class="renditions__files">
            {rendition.files.map((file) => (
              <li key={file.filename}>
                {/* Two links rather than one with conditional attributes,
                    which the strict types and the optimizer both refuse. */}
                {file.mediaType === "application/pdf" ? (
                  <a href={href(file.filename)} data-rendition-file={file.filename} target="_blank" rel="noopener">
                    {file.filename}
                  </a>
                ) : (
                  <a href={href(file.filename)} data-rendition-file={file.filename} download={file.filename}>
                    {file.filename}
                  </a>
                )}
              </li>
            ))}
          </ul>
          {rendition.omitted.length > 0 && (
            <details class="renditions__more">
              <summary>Left out</summary>
              <ul data-rendition-omitted>
                {rendition.omitted.map((line, at) => (
                  <li key={at}>{line}</li>
                ))}
              </ul>
            </details>
          )}
          {rendition.log.length > 0 && (
            <details class="renditions__more">
              <summary>What the typesetting said</summary>
              <ul class="renditions__log" data-rendition-log>
                {rendition.log.map((line, at) => (
                  <li key={at}>{line}</li>
                ))}
              </ul>
            </details>
          )}
        </li>
      );
    })}
  </ul>
));

/** Every rendition of the document, at its end: those kept on the document,
 * and those kept on one of its blocks before *Format* became the document's
 * alone, which no block draws any more (`BO_0332_031`). */
export const DocumentRenditions = component$<DocumentPlaceProps>(({ documentId }) => {
  const state = useContext(RenditionsContext);
  const own = state.renditions.filter((rendition) => rendition.document === documentId);
  if (own.length === 0) return null;
  return <RenditionList renditions={own} />;
});
