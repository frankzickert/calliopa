import type { Run } from "~/lib/runs";
import { runsText } from "~/lib/runs";

import type { BlockView, DocumentView } from "../server/assemble";

/**
 * What the `#` list offers (`BO_0300_005`, user decisions 2026-09-25): every
 * block of the reading order a sentence can refer to, in reading order, the
 * block being edited left out — a numbered figure, table or equation as its
 * label and the opening of its caption or source, a heading by its words, a
 * paragraph or a quote by its first words — filtered by what was typed after
 * the `#`; a numbered code block as *Listing 2* with the opening of its
 * caption, or of its first source line when it has none (`BO_0303_013`). A
 * block nothing can print a name for — an abstract, an unnumbered float,
 * equation or code block, an output, a video, a divider — is not offered.
 * Pure, so the list is a case of the test beside it.
 */
export interface ReferenceChoice {
  readonly blockId: string;
  /** What the reference will be drawn as. */
  readonly label: string;
  /** The opening words of what is referred to, beside the label. */
  readonly glimpse: string;
  readonly icon: "text-h-two" | "article-ny-times" | "image" | "table" | "equals" | "code";
}

const GLIMPSE = 40;

const glimpseOf = (words: string): string => {
  const trimmed = words.trim().replace(/\s+/gu, " ");
  return trimmed.length > GLIMPSE ? `${trimmed.slice(0, GLIMPSE)}…` : trimmed;
};

const inReadingOrder = (block: BlockView): boolean => !("standing" in block) || (block.standing !== "discarded" && block.standing !== "prompt");

/** The blocks a sentence in `editing` may refer to. */
export function referenceChoices(document: Pick<DocumentView, "blocks" | "referenceLabels" | "equationNumbers">, editing: string | null): ReferenceChoice[] {
  const labels = document.referenceLabels ?? {};
  const choices: ReferenceChoice[] = [];
  for (const block of document.blocks) {
    if (block.blockId === editing || !inReadingOrder(block)) continue;
    switch (block.kind) {
      case "text": {
        if (block.role === "h1" || block.role === "h2" || block.role === "h3") {
          const words = runsText(block.runs as readonly Run[]).trim();
          if (words !== "") choices.push({ blockId: block.blockId, label: words, glimpse: "", icon: "text-h-two" });
        } else if (block.role === "paragraph" || block.role === "quote") {
          const words = glimpseOf(runsText(block.runs as readonly Run[]));
          if (words !== "") choices.push({ blockId: block.blockId, label: labels[block.blockId] ?? "Paragraph", glimpse: words, icon: "article-ny-times" });
        }
        break;
      }
      case "image":
      case "output":
        if (labels[block.blockId] !== undefined || block.numbered === true) {
          choices.push({ blockId: block.blockId, label: labels[block.blockId] ?? `Figure ${block.number ?? ""}`.trim(), glimpse: glimpseOf(block.caption ?? ""), icon: "image" });
        }
        break;
      case "table":
        if (labels[block.blockId] !== undefined || block.numbered === true) {
          choices.push({ blockId: block.blockId, label: labels[block.blockId] ?? `Table ${block.number ?? ""}`.trim(), glimpse: glimpseOf(block.caption ?? ""), icon: "table" });
        }
        break;
      case "equation": {
        const number = document.equationNumbers?.[block.blockId];
        if (number !== undefined) choices.push({ blockId: block.blockId, label: `(${number})`, glimpse: glimpseOf(block.tex), icon: "equals" });
        break;
      }
      case "sourcecode":
        if (labels[block.blockId] !== undefined || block.numbered === true) {
          const caption = block.caption ?? "";
          const glimpse = caption.trim() !== "" ? caption : (block.source.split("\n").find((line) => line.trim() !== "") ?? "");
          choices.push({ blockId: block.blockId, label: labels[block.blockId] ?? `Listing ${block.number ?? ""}`.trim(), glimpse: glimpseOf(glimpse), icon: "code" });
        }
        break;
      default:
        break;
    }
  }
  return choices;
}

/** The choices whose label or glimpse holds every word typed after the `#`. */
export function matchingChoices(choices: readonly ReferenceChoice[], typed: string): ReferenceChoice[] {
  const words = typed.trim().toLowerCase().split(/[\s_-]+/u).filter((word) => word !== "");
  if (words.length === 0) return [...choices];
  return choices.filter((choice) => {
    const haystack = `${choice.label} ${choice.glimpse}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
