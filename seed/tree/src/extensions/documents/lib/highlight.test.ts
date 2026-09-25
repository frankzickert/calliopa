import { describe, expect, it } from "vitest";

import { guessLanguage, highlightSource, knownLanguage, KNOWN_LANGUAGES } from "./highlight";

/** The text a markup holds once its elements are stripped and its entities read. */
const textOf = (markup: string): string =>
  markup
    .replace(/<[^>]+>/gu, "")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#x27;/gu, "'")
    .replace(/&amp;/gu, "&");

describe("colouring a code block", () => {
  it("colours a Python block by its tokens and no colour of its own", () => {
    const markup = highlightSource("def f(x):\n    return x  # one\n", "python");
    expect(markup).not.toBeNull();
    expect(markup).toContain('<span class="hljs-keyword">def</span>');
    expect(markup).toContain('<span class="hljs-comment"># one</span>');
    expect(markup).not.toMatch(/#[0-9a-f]{6}|style=/iu);
  });

  it("keeps the text character for character, which the writing overlay depends on", () => {
    const source = 'if a < b && c > "d":\n\tprint(\'e\' & f)\n';
    const markup = highlightSource(source, "python");
    expect(markup).not.toBeNull();
    expect(textOf(markup as string)).toBe(source);
  });

  it("answers no markup for a block without a language or with one it does not know", () => {
    expect(highlightSource("x = 1", undefined)).toBeNull();
    expect(highlightSource("x = 1", "")).toBeNull();
    expect(highlightSource("x = 1", "klingon")).toBeNull();
  });

  it("resolves an alias and ignores case and spaces around the word", () => {
    expect(knownLanguage(" Py ")).toBe("py");
    expect(knownLanguage("TS")).toBe("ts");
    expect(knownLanguage("klingon")).toBeNull();
    expect(highlightSource("x = 1", "PY")).toContain("hljs-");
  });

  it("colours a source that is not valid in its language as far as the grammar reaches", () => {
    const markup = highlightSource("def broken(:\n    return }\n", "python");
    expect(markup).not.toBeNull();
    expect(markup).toContain('<span class="hljs-keyword">def</span>');
  });
});

describe("guessing a language", () => {
  it("names Python for a Python program and nothing for an empty source", () => {
    expect(guessLanguage("import os\n\ndef main():\n    for name in os.listdir('.'):\n        print(name)\n\nif __name__ == '__main__':\n    main()\n")).toBe("python");
    expect(guessLanguage("")).toBeNull();
    expect(guessLanguage("   \n")).toBeNull();
  });

  it("names Python for one pasted line of it, which is what Turn into Code most often gets", () => {
    expect(guessLanguage('print("hello world")')).toBe("python");
    expect(guessLanguage("import numpy as np")).toBe("python");
    expect(guessLanguage("for i in range(10): print(i)")).toBe("python");
    expect(guessLanguage("x = [1, 2, 3]\nprint(sum(x))")).toBe("python");
  });

  it("names the language of a Go, a shell, a JSON and a SQL source", () => {
    expect(guessLanguage('package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("hi")\n}\n')).toBe("go");
    expect(guessLanguage('#!/bin/sh\nset -eu\nfor f in *.txt; do\n  echo "$f"\ndone\n')).toBe("bash");
    expect(guessLanguage('{"a": [1, 2, {"b": null}], "c": true}\n')).toBe("json");
    expect(guessLanguage("SELECT id, name FROM people WHERE age > 3 ORDER BY name;\n")).toBe("sql");
  });

  it("declines to guess when nothing is clear, rather than naming a wrong language", () => {
    expect(guessLanguage("x = 1")).toBeNull();
    expect(guessLanguage("The quick brown fox jumps over the lazy dog.\nIt was the best of times.\n")).toBeNull();
    expect(guessLanguage("We print the results and return home.")).toBeNull();
    expect(guessLanguage("from here on we walk")).toBeNull();
    // The engine's count reads a Markdown paragraph as shell; the shape does not.
    expect(guessLanguage("# Title\n\nSome words with *emphasis* and a [link](http://x).\n")).toBeNull();
  });
});

describe("the languages the field offers", () => {
  it("are the engine's names, sorted, the formatter's among them", () => {
    for (const language of ["python", "javascript", "typescript", "go", "bash", "json", "yaml", "css", "markdown"]) {
      expect(KNOWN_LANGUAGES).toContain(language);
    }
    expect([...KNOWN_LANGUAGES].sort()).toEqual(KNOWN_LANGUAGES);
  });
});
