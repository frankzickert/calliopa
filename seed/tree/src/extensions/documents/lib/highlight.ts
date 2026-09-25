import hljs from "highlight.js/lib/common";

/**
 * Colouring code, once, for both sites that draw it (`BO_0296_011`).
 *
 * The server colours every code block as it reads the document and the
 * markup travels with the block; the browser colours the one being written,
 * from a lazy import of this same module, so reading a document fetches no
 * grammar (`highlight-boundary.test.ts`). One module because two engines that
 * could disagree is the bug where a block looks one way while it is read and
 * another while it is written — the same reason the equations have one.
 *
 * The engine is `highlight.js`, taken as its *common* bundle: the languages a
 * document is likely to hold, every one the formatter lays out among them,
 * rather than all one hundred and ninety. It emits class names and no colour,
 * which is what lets every colour be a theme token; it colours a source that
 * does not parse as far as its grammar reaches rather than refusing it, since
 * a document is full of code that does not compile; and it guesses a
 * language, which no other candidate does.
 */

/** A language word as the block carries it, matched to what the engine knows:
 * trimmed, case-free, an alias (`py`, `ts`, `sh`) resolved to its language.
 * Null for an empty word and for one the engine does not know. */
export function knownLanguage(word: string | undefined): string | null {
  const trimmed = (word ?? "").trim().toLowerCase();
  if (trimmed === "") return null;
  return hljs.getLanguage(trimmed) === undefined ? null : trimmed;
}

/**
 * The block's source in its language's colours, as HTML holding only
 * `<span class="hljs-…">` elements and escaped text — so the text inside is
 * the source character for character, which is what the writing view's
 * overlay depends on. Null when the language is unnamed or unknown: the block
 * then draws its plain characters.
 */
export function highlightSource(source: string, language: string | undefined): string | null {
  const known = knownLanguage(language);
  if (known === null) return null;
  try {
    return hljs.highlight(source, { language: known, ignoreIllegals: true }).value;
  } catch {
    return null;
  }
}

/**
 * The languages a guess is made among — the ones a person is likely to paste
 * into a document, the formatter's among them — and, for each, the shape of
 * source that corroborates the engine's choice. The engine's own relevance
 * is a count of keyword hits, which ties a Python program with C++ and reads
 * a Markdown paragraph as shell; a guess is answered only when the winner's
 * own shape is in the source too.
 */
const GUESSED_AMONG: readonly (readonly [string, RegExp])[] = [
  ["python", /^\s*(?:def|class)\s+\w+|^\s*import\s+\w+|^\s*from\s+[\w.]+\s+import\s|\bprint\(|^\s*if __name__|^\s*for\s+\w+\s+in\s.*:/mu],
  ["typescript", /\binterface\s+\w+|:\s*(?:number|string|boolean|void)\b|\w+<\w+>|\bas\s+const\b/u],
  ["javascript", /\b(?:const|let|var|function)\s|=>|\bexport\s|\brequire\(/u],
  ["go", /^\s*package\s+\w+|\bfunc\s+\w*\(|:=/mu],
  ["bash", /^#!.*\bsh\b|\becho\b|^\s*(?:fi|done|esac)\s*$|\$\{?\w/mu],
  ["sql", /^\s*(?:select|insert|update|delete|create|alter|with)\b/imu],
  ["json", /^\s*[[{][\s\S]*[\]}]\s*$/u],
  ["yaml", /^[\w-]+:\s*(?:\S.*)?$/mu],
  ["java", /\bpublic\s+(?:class|static)\b|System\.out\./u],
  ["rust", /\bfn\s+\w+\(|\blet\s+mut\b|\bimpl\b/u],
  ["c", /^\s*#include\s*[<"]/mu],
  ["cpp", /^\s*#include\s*[<"]|\bstd::/mu],
  ["ruby", /^\s*(?:def|class|module)\s.*\n[\s\S]*^\s*end\s*$|\bputs\b/mu],
];

/**
 * The engine's guess at a source's language, made once where a block is
 * created (`BO_0296_017`). The engine ranks the candidates; the first of its
 * two best whose relevance means something — two hits, which is what one
 * pasted line of Python scores — and whose own shape is in the source is the
 * guess, and null is answered otherwise: an empty field is better than a
 * wrong word a person then has to notice and correct.
 */
export function guessLanguage(source: string): string | null {
  if (source.trim() === "") return null;
  const ranked = hljs.highlightAuto(source, GUESSED_AMONG.map(([language]) => language));
  const candidates = [ranked, ranked.secondBest].flatMap((choice) =>
    choice?.language !== undefined && choice.relevance >= 2 ? [choice.language] : [],
  );
  for (const language of candidates) {
    const shape = GUESSED_AMONG.find(([name]) => name === language)?.[1];
    if (shape !== undefined && shape.test(source)) return language;
  }
  return null;
}

/** Every language the engine knows, by its name, for the language field to
 * offer (`BO_0296_019`). Aliases are not listed: `py` is typed, not chosen. */
export const KNOWN_LANGUAGES: readonly string[] = hljs.listLanguages().sort();
