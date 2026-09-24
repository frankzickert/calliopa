// A page captured both ways — the plain fetch and the rendering — with the
// better text kept and scored: what `POST /v1/pages` answers. The extraction,
// the score and the comparison were `calliopa-refine`'s (`lib/investigation.ts`)
// and moved here so a press and a run's tool answer the same record
// (`docs/system/page-capture-service.md`, BO_0284_001). Pure but for the two
// ways handed in.

// How much text one page keeps: some forty pages. The renderer answers up to
// two million characters; a record that large is more than any reader of it
// carries, so the text is cut here and `whole` says so.
export const PAGE_TEXT_CHARS = 200_000;

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (whole, entity) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) return String.fromCodePoint(parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(parseInt(entity.slice(1), 10));
    return ENTITIES[entity.toLowerCase()] ?? whole;
  });
}

const escapeRe = (name) => name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

function meta(html, names) {
  for (const name of names) {
    const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${escapeRe(name)}["'][^>]*content=["']([^"']*)["']`, "iu");
    const found = html.match(pattern)?.[1];
    if (found !== undefined && found.trim() !== "") return decodeEntities(found.trim());
    const reversed = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${escapeRe(name)}["']`, "iu");
    const foundReversed = html.match(reversed)?.[1];
    if (foundReversed !== undefined && foundReversed.trim() !== "") return decodeEntities(foundReversed.trim());
  }
  return undefined;
}

// The readable text of an HTML page without a DOM: scripts, styles and the
// like removed, block boundaries kept as line breaks, tags dropped, entities
// decoded, whitespace collapsed. Deliberately plain — the renderer's text is
// the second way, and the comparison keeps the better one.
export function extractPage(html, { maxChars = PAGE_TEXT_CHARS } = {}) {
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/iu)?.[1] ?? "").replace(/\s+/gu, " ").trim();
  const author = meta(html, ["author", "article:author", "parsely-author"]);
  const publisher = meta(html, ["og:site_name", "publisher", "application-name"]);
  const publishedAt = meta(html, ["article:published_time", "date", "datePublished", "pubdate", "parsely-pub-date"]);
  let body = html.replace(/<(script|style|noscript|template|svg|iframe|head)[^>]*>[\s\S]*?<\/\1>/giu, " ");
  body = body.replace(/<!--[\s\S]*?-->/gu, " ");
  body = body.replace(
    /<\/?(p|div|br|li|ul|ol|h[1-6]|tr|td|th|section|article|header|footer|blockquote|pre|figure|figcaption|dd|dt|dl|nav|aside|main|table|hr)\b[^>]*>/giu,
    "\n",
  );
  body = body.replace(/<[^>]+>/gu, " ");
  const text = decodeEntities(body)
    .replace(/[ \t\f\v]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  const cut = text.length > maxChars;
  return { title, text: cut ? text.slice(0, maxChars) : text, whole: !cut, author, publisher, publishedAt };
}

const significantWords = (title) =>
  title
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 4);

// The comparison's own measure of how well the captured text keeps the
// promise the headline made, from zero to one: the share of the title's
// significant words the text carries, held down while the text is short. A
// caller with an evaluation model may score on top of it; the record says
// which gave the number.
export function promiseScore(title, text) {
  const words = significantWords(title);
  const lower = text.toLowerCase();
  if (text.trim() === "") return { value: 0, reason: "no text was captured" };
  const carried = words.filter((word) => lower.includes(word)).length;
  const share = words.length === 0 ? 1 : carried / words.length;
  const length = Math.min(1, text.length / 400);
  const value = Math.round(share * length * 100) / 100;
  const reason =
    words.length === 0
      ? `the headline has no significant words to check; ${text.length} characters of text`
      : `${carried} of the headline's ${words.length} significant words appear in ${text.length} characters of text`;
  return { value, reason };
}

// Keeps the way that answered more text; the renderer's on a tie, since it
// saw what a reader sees. A way is `{ok: true, capture}` or
// `{ok: false, way, refusal}`; a capture carries `way`, `finalUrl`, `title`,
// `text`, `whole` and the stated facts.
export function chooseCapture(ways) {
  const answered = ways.filter((way) => way.ok);
  const summary = ways.map((way) =>
    way.ok ? { way: way.capture.way, ok: true, chars: way.capture.text.length } : { way: way.way, ok: false, chars: 0, refusal: way.refusal },
  );
  if (answered.length === 0) {
    return {
      kept: null,
      text: "",
      title: "",
      finalUrl: "",
      whole: false,
      score: { value: 0, by: "comparison", reason: "no way could capture the page" },
      ways: summary,
    };
  }
  const best = answered.reduce((held, candidate) => {
    const longer = candidate.capture.text.length > held.capture.text.length;
    const tie = candidate.capture.text.length === held.capture.text.length && candidate.capture.way === "render";
    return longer || tie ? candidate : held;
  });
  const fetched = answered.find((way) => way.capture.way === "fetch")?.capture;
  const title = best.capture.title !== "" ? best.capture.title : (fetched?.title ?? "");
  const score = promiseScore(title, best.capture.text);
  return {
    kept: best.capture.way,
    text: best.capture.text,
    title,
    finalUrl: best.capture.finalUrl,
    whole: best.capture.whole,
    author: best.capture.author ?? fetched?.author,
    publisher: best.capture.publisher ?? fetched?.publisher,
    publishedAt: best.capture.publishedAt ?? fetched?.publishedAt,
    score: { ...score, by: "comparison" },
    ways: summary,
  };
}

// The renderer's record as one way of the comparison, its text cut to what a
// page keeps.
function renderedWay(record) {
  const cut = record.text.length > PAGE_TEXT_CHARS;
  return {
    ok: true,
    capture: {
      way: "render",
      finalUrl: record.finalUrl,
      title: record.title,
      text: cut ? record.text.slice(0, PAGE_TEXT_CHARS) : record.text,
      whole: !cut && !record.textTruncated,
      settled: record.settled,
    },
  };
}

// Both ways at once — `plain(target)` answers a way outcome, `capturer`
// renders — and the comparison over them. The renderer's files ride along
// whatever the comparison kept: the page as it looked is kept even when the
// plain text is the one read. A page no way could capture is still a
// record, with both refusals and no files, because the caller decides what
// a page nobody could read means. BO_0284_001
export async function capturePage({ target, capturer, plain }) {
  const [plainWay, rendered] = await Promise.all([
    plain(target).catch((error) => ({ ok: false, way: "fetch", refusal: `the plain fetch failed: ${error.message}` })),
    capturer
      .capture(target)
      .then((record) => ({ ok: true, record }))
      .catch((error) => ({ ok: false, refusal: error.refused ? `refused: ${error.message}` : error.unreachable ? `the page could not be reached: ${error.message}` : `the rendering failed: ${error.message}` })),
  ]);
  const renderWay = rendered.ok ? renderedWay(rendered.record) : { ok: false, way: "render", refusal: rendered.refusal };
  const compared = chooseCapture([plainWay, renderWay]);
  return {
    url: String(target),
    ...compared,
    settled: rendered.ok ? rendered.record.settled : undefined,
    blocked: rendered.ok ? rendered.record.blocked : [],
    files: rendered.ok ? rendered.record.files : {},
  };
}
