import { isAtom, type Run } from "~/lib/runs";

/**
 * The matcher (`BO_0301_013`), pure: the keywords' names against one block's
 * runs, answering the mentions as character ranges with the keyword and the
 * rule that matched. English, in three rules in order (`BO_0301_Q3`):
 *
 * 1. the title in every inflection wins — the plural and the possessive, so
 *    *quantum computers* reaches *Quantum computer* and *quantum computing*
 *    never does, because *computing* and *computer* are different words;
 * 2. the aliases, in every inflection, the same way (`BO_0301_Q4`);
 * 3. only where the first two reach nothing, the full stem of each word.
 *
 * Words match at word boundaries, case-insensitively. A word already inside
 * a mention starts no second one. Among the matches at one place the higher
 * rule wins over the same words, and the longest span wins among what
 * remains. Where the stem rule alone reaches several keywords with the same
 * words, nothing is connected: a guess is not a connection. A keyword's own
 * names in its own document are not mentions. Words under the `code` mark,
 * inside an atom — an inline equation, a citation, a reference — are never
 * matched.
 *
 * Offsets are character offsets over the run list, an atom one character
 * wide, the same offsets every run operation deals in.
 */

export type MatchRule = "inflection" | "alias" | "stem";

/** A keyword's names: its identity, its title and its aliases. */
export interface KeywordNames {
  readonly keyword: string;
  readonly title: string;
  readonly aliases: readonly string[];
}

/** A mention: the characters it covers, the keyword and the rule. */
export interface Mention {
  readonly start: number;
  readonly end: number;
  readonly keyword: string;
  readonly rule: MatchRule;
}

/** The stem of one lowercased word — the Snowball English stemmer on the
 * server; a test may hand in any function. */
export type Stemmer = (word: string) => string;

interface Token {
  readonly start: number;
  readonly end: number;
  readonly word: string;
}

const APOSTROPHES = /[’ʼ`]/gu;
const WORD_CHAR = /[\p{L}\p{N}\p{M}]/u;

/** A word lowercased with its apostrophes unified, and its possessive
 * — `'s`, or a bare `'` after an `s` — taken off. */
export function baseOf(word: string): string {
  const lowered = word.toLocaleLowerCase("en").replace(APOSTROPHES, "'");
  if (lowered.endsWith("'s")) return lowered.slice(0, -2);
  if (lowered.endsWith("s'")) return lowered.slice(0, -1);
  return lowered.replace(/^'+|'+$/gu, "");
}

/** The English plural forms a base may take, by rule: `-s`, `-es`, `-ies`. */
function plurals(base: string): string[] {
  const forms = [`${base}s`, `${base}es`];
  if (base.endsWith("y")) forms.push(`${base.slice(0, -1)}ies`);
  return forms;
}

/** Whether two words are one word in two inflections. */
export function inflects(left: string, right: string): boolean {
  const a = baseOf(left);
  const b = baseOf(right);
  if (a === "" || b === "") return false;
  return a === b || plurals(b).includes(a) || plurals(a).includes(b);
}

/** The words of a string, each with its character range. Letters, digits
 * and marks make a word, an apostrophe inside one belongs to it, and
 * everything else separates. */
function tokenize(chars: readonly { readonly ch: string; readonly matchable: boolean }[]): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  while (at < chars.length) {
    const entry = chars[at] as { ch: string; matchable: boolean };
    const isWord = entry.matchable && WORD_CHAR.test(entry.ch);
    if (!isWord) {
      at += 1;
      continue;
    }
    const start = at;
    let word = "";
    while (at < chars.length) {
      const current = chars[at] as { ch: string; matchable: boolean };
      if (!current.matchable) break;
      if (WORD_CHAR.test(current.ch)) {
        word += current.ch;
        at += 1;
        continue;
      }
      const next = chars[at + 1];
      const apostrophe = current.ch === "'" || /[’ʼ`]/u.test(current.ch);
      if (apostrophe && next !== undefined && next.matchable && (WORD_CHAR.test(next.ch) || next.ch === "'")) {
        word += current.ch;
        at += 1;
        continue;
      }
      if (apostrophe) {
        // A trailing apostrophe is the plural possessive — computers' — and
        // stays with its word.
        word += current.ch;
        at += 1;
      }
      break;
    }
    tokens.push({ start, end: at, word });
  }
  return tokens;
}

/** The characters of a run list, each saying whether it may be matched:
 * an atom is one unmatchable character, and a `code` run's characters are
 * unmatchable, so neither ever forms a word. */
function charsOf(runs: readonly Run[]): { ch: string; matchable: boolean }[] {
  const chars: { ch: string; matchable: boolean }[] = [];
  for (const run of runs) {
    if (isAtom(run)) {
      chars.push({ ch: "\u0000", matchable: false });
      continue;
    }
    const matchable = !(run.marks ?? []).includes("code");
    for (const ch of run.text) chars.push({ ch, matchable });
  }
  return chars;
}

/** The words of a name, as the matcher compares them. */
export function nameWords(name: string): string[] {
  return tokenize([...name].map((ch) => ({ ch, matchable: true }))).map((token) => token.word);
}

interface Name {
  readonly keyword: string;
  readonly words: readonly string[];
  readonly bases: readonly string[];
  readonly isTitle: boolean;
}

const RANK: Readonly<Record<MatchRule, number>> = { inflection: 0, alias: 1, stem: 2 };

/**
 * The mentions in one block's runs, in reading order and never overlapping.
 * `self` names the keyword whose document this block belongs to, so that its
 * own names are left alone.
 */
export function findMentions(
  runs: readonly Run[],
  keywords: readonly KeywordNames[],
  stem: Stemmer,
  self: string | null = null,
): Mention[] {
  const names: Name[] = [];
  for (const keyword of keywords) {
    if (keyword.keyword === self) continue;
    const add = (name: string, isTitle: boolean) => {
      const words = nameWords(name);
      if (words.length === 0) return;
      names.push({ keyword: keyword.keyword, words, bases: words.map(baseOf), isTitle });
    };
    add(keyword.title, true);
    for (const alias of keyword.aliases) add(alias, false);
  }
  if (names.length === 0) return [];

  const tokens = tokenize(charsOf(runs));
  const stems = new Map<string, string>();
  const stemOf = (word: string): string => {
    const base = baseOf(word);
    let stemmed = stems.get(base);
    if (stemmed === undefined) {
      stemmed = stem(base);
      stems.set(base, stemmed);
    }
    return stemmed;
  };

  const mentions: Mention[] = [];
  let at = 0;
  while (at < tokens.length) {
    // Every name matching here, with the rule it matched by.
    const candidates: { keyword: string; span: number; rule: MatchRule }[] = [];
    for (const name of names) {
      const span = name.words.length;
      if (at + span > tokens.length) continue;
      let byInflection = true;
      let byStem = true;
      for (let index = 0; index < span && byStem; index += 1) {
        const token = tokens[at + index] as Token;
        const word = name.words[index] as string;
        if (inflects(token.word, word)) continue;
        byInflection = false;
        if (stemOf(token.word) !== stemOf(word)) byStem = false;
      }
      if (byInflection) candidates.push({ keyword: name.keyword, span, rule: name.isTitle ? "inflection" : "alias" });
      else if (byStem) candidates.push({ keyword: name.keyword, span, rule: "stem" });
    }
    if (candidates.length === 0) {
      at += 1;
      continue;
    }
    // Over the same words the higher rule wins; several keywords left at the
    // winning rule is a guess, and a guess connects nothing.
    const bySpan = new Map<number, { keyword: string; rule: MatchRule }>();
    const spans = [...new Set(candidates.map((candidate) => candidate.span))];
    for (const span of spans) {
      const here = candidates.filter((candidate) => candidate.span === span);
      const best = Math.min(...here.map((candidate) => RANK[candidate.rule]));
      const winners = here.filter((candidate) => RANK[candidate.rule] === best);
      const distinct = new Set(winners.map((candidate) => candidate.keyword));
      if (distinct.size !== 1) continue;
      const winner = winners[0] as { keyword: string; rule: MatchRule };
      bySpan.set(span, { keyword: winner.keyword, rule: winner.rule });
    }
    const longest = Math.max(-1, ...bySpan.keys());
    const chosen = longest < 0 ? undefined : bySpan.get(longest);
    if (chosen === undefined) {
      at += 1;
      continue;
    }
    const first = tokens[at] as Token;
    const last = tokens[at + longest - 1] as Token;
    mentions.push({ start: first.start, end: last.end, keyword: chosen.keyword, rule: chosen.rule });
    at += longest;
  }
  return mentions;
}
