import { component$ } from "@builder.io/qwik";

import type { Mark, TextRole } from "~/lib/runs";

/**
 * How a text block's words are drawn, shared by the block editor's rows and
 * the proposed changes drawn as blocks beside them (`BO_0233_004`), so a
 * proposal reads in the typography of the block it would become. Moved out of
 * `block-editor.tsx` with `BO_0233`.
 */

/**
 * Reading and editing use the same element, so the role decides the tag once.
 *
 * Levels start at `h3` because the page's `h1` is the application and this
 * view's own title is the `h2` beneath it: a document's headings are real
 * headings, sitting below the title that names them rather than competing with
 * it, and the outline skips no level on the way down.
 */
export type BlockTag = "p" | "h3" | "h4" | "h5" | "blockquote";

export const ROLE_TAG: Readonly<Record<TextRole, BlockTag>> = {
  paragraph: "p",
  h1: "h3",
  h2: "h4",
  h3: "h5",
  quote: "blockquote",
};

/**
 * A run's marks as real elements, peeled one at a time.
 *
 * Nesting rather than one span with classes: `strong` and `em` mean something
 * to a screen reader that a styled span does not, and the reading presentation
 * is the one a reader actually reads.
 */
export const Marked = component$<{
  text: string;
  marks: readonly Mark[];
  link?: string | undefined;
}>(({ text, marks, link }) => {
  if (link !== undefined) {
    return (
      <a href={link} class="run-link">
        <Marked text={text} marks={marks} />
      </a>
    );
  }
  const [first, ...rest] = marks;
  if (first === undefined) return <span class="run">{text}</span>;
  if (first === "bold") {
    return (
      <strong>
        <Marked text={text} marks={rest} />
      </strong>
    );
  }
  if (first === "italic") {
    return (
      <em>
        <Marked text={text} marks={rest} />
      </em>
    );
  }
  if (first === "strikethrough") {
    return (
      <s>
        <Marked text={text} marks={rest} />
      </s>
    );
  }
  return (
    <code>
      <Marked text={text} marks={rest} />
    </code>
  );
});
