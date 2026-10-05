import { component$ } from "@builder.io/qwik";

import type { BlockDecorationProps } from "~/contract";

import { BlockStandingPill } from "./standing";
import { ToolHeadline } from "./tools";

/** What `instructions` says on a block's headline: a code block's tool, and
 * the instruction standing on the block (`BO_0349_032`). */
export const HeadlineMarks = component$<BlockDecorationProps>((props) => (
  <>
    <ToolHeadline {...props} />
    <BlockStandingPill {...props} />
  </>
));
