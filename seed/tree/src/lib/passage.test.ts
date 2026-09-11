import { describe, expect, it } from "vitest";

import {
  anchorAt,
  CONTEXT_CHARS,
  MAX_PASSAGE_QUOTE,
  quotable,
  quoteLength,
  resolvePassage,
} from "./passage";

const text = "The storm arrives before the lights go out, and nobody notices.";

describe("anchoring a passage", () => {
  it("Given a range, Then the anchor keeps its exact words and the context either side", () => {
    const start = text.indexOf("before");
    const anchor = anchorAt(text, start, start + "before the lights".length);
    expect(anchor.quote).toBe("before the lights");
    expect(anchor.prefix).toBe("The storm arrives ");
    expect(anchor.suffix.startsWith(" go out")).toBe(true);
    expect(anchor.suffix.length).toBeLessThanOrEqual(CONTEXT_CHARS);
    expect(anchor.hint).toBe(start);
  });

  it("Given astral characters before the words, Then offsets count code points as the editor does", () => {
    const astral = "🌩️ storm: 𝒶 clause here.";
    const characters = [...astral];
    const start = characters.indexOf("c");
    const anchor = anchorAt(astral, start, start + "clause".length);
    expect(anchor.quote).toBe("clause");
    expect(resolvePassage(anchor, astral)).toEqual({ start, end: start + 6 });
  });
});

describe("resolving a passage later", () => {
  it("Given the words still standing, Then it resolves where they are, even after text before them changed", () => {
    const start = text.indexOf("before");
    const anchor = anchorAt(text, start, start + "before the lights".length);
    const edited =
      "A storm arrived. The storm arrives before the lights go out, and nobody notices.";
    const range = resolvePassage(anchor, edited);
    expect(range).not.toBeNull();
    expect([...edited].slice(range!.start, range!.end).join("")).toBe(
      "before the lights",
    );
  });

  it("Given the words gone, Then it is stale and nothing is guessed", () => {
    const start = text.indexOf("before");
    const anchor = anchorAt(text, start, start + "before the lights".length);
    expect(
      resolvePassage(anchor, "The storm arrives after the lights go out."),
    ).toBeNull();
  });

  it("Given the same words twice, Then the context decides which occurrence, not the position", () => {
    const repeated =
      "Say it once. Then say it once more, and say it once again.";
    const second = repeated.indexOf("say it once", 14);
    const anchor = anchorAt(repeated, second, second + "say it once".length);
    // Text inserted up front moves every position; the context still finds the
    // occurrence the reader pointed at.
    const edited = `Prelude. ${repeated}`;
    const range = resolvePassage(anchor, edited);
    expect(range?.start).toBe(edited.indexOf("say it once more"));
  });

  it("Given a newline inside the words, Then it is a character like any other", () => {
    const lined = "First line\nsecond line";
    const anchor = anchorAt(lined, 6, 17);
    expect(anchor.quote).toBe("line\nsecond");
    expect(resolvePassage(anchor, lined)).toEqual({ start: 6, end: 17 });
  });

  it("Given an empty quote, Then it resolves nowhere", () => {
    expect(
      resolvePassage({ quote: "", prefix: "", suffix: "", hint: 0 }, text),
    ).toBeNull();
  });
});

describe("what can be a passage", () => {
  it("Given no words or more than the bound, Then it cannot, counting code points", () => {
    expect(quotable("")).toBe(false);
    expect(quotable("é".repeat(MAX_PASSAGE_QUOTE))).toBe(true);
    expect(quotable("é".repeat(MAX_PASSAGE_QUOTE + 1))).toBe(false);
    expect(quoteLength("🌩️x")).toBe(3);
  });
});
