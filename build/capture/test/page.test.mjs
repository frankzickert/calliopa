// The page module and the plain way, offline: the extraction, the score, the
// comparison, and the plain fetch against pages the test serves on the
// loopback address through the injected dialer. No browser here; the route
// that joins both ways runs in service.test.mjs with it. BO_0284_001
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { capturePage, chooseCapture, extractPage, promiseScore } from "../lib/page.mjs";
import { plainCapture } from "../lib/plain.mjs";

test("extractPage pulls the readable text, the title and the stated facts out of HTML", () => {
  const html = `<!doctype html><html><head><title>A &amp; B: the headline</title>
    <meta name="author" content="Alice"><meta property="og:site_name" content="The Site">
    <meta property="article:published_time" content="2026-09-01T10:00:00Z">
    <style>p{}</style><script>var x = 1;</script></head>
    <body><nav>Menu</nav><h1>The headline</h1><p>First&nbsp;paragraph.</p><p>Second   paragraph.</p><!-- hidden --></body></html>`;
  const page = extractPage(html);
  assert.equal(page.title, "A & B: the headline");
  assert.equal(page.author, "Alice");
  assert.equal(page.publisher, "The Site");
  assert.equal(page.publishedAt, "2026-09-01T10:00:00Z");
  assert.match(page.text, /The headline\n\nFirst paragraph\.\n\nSecond paragraph\./);
  assert.doesNotMatch(page.text, /var x|hidden|p\{\}/);
  assert.equal(page.whole, true);
  const cut = extractPage(html, { maxChars: 10 });
  assert.equal(cut.text.length, 10);
  assert.equal(cut.whole, false);
});

test("promiseScore counts the headline's significant words in the text, held down while the text is short", () => {
  assert.equal(promiseScore("Anything", "").value, 0);
  const long = "x".repeat(400) + " revenue doubled after the merger";
  const scored = promiseScore("Revenue doubled after merger", long);
  assert.equal(scored.value, 1);
  assert.match(scored.reason, /4 of the headline's 4 significant words/);
  const partial = promiseScore("Revenue doubled after merger", "x".repeat(400) + " revenue fell");
  assert.ok(partial.value > 0 && partial.value < 1);
  const short = promiseScore("Revenue doubled after merger", "revenue doubled after the merger");
  assert.ok(short.value < 0.2, "a short text is held down");
});

const way = (kind, text, extra = {}) => ({ ok: true, capture: { way: kind, finalUrl: `http://x/${kind}`, title: "T", text, whole: true, ...extra } });

test("chooseCapture keeps the longer text, the renderer's on a tie, and carries the other way's stated facts", () => {
  const longer = chooseCapture([way("fetch", "short", { author: "Alice" }), way("render", "a much longer text")]);
  assert.equal(longer.kept, "render");
  assert.equal(longer.author, "Alice", "the fetched way's stated facts ride along");
  assert.equal(longer.finalUrl, "http://x/render");
  const tie = chooseCapture([way("fetch", "same"), way("render", "same")]);
  assert.equal(tie.kept, "render");
  const one = chooseCapture([{ ok: false, way: "fetch", refusal: "not a page" }, way("render", "words")]);
  assert.equal(one.kept, "render");
  assert.deepEqual(one.ways[0], { way: "fetch", ok: false, chars: 0, refusal: "not a page" });
  const none = chooseCapture([{ ok: false, way: "fetch", refusal: "a" }, { ok: false, way: "render", refusal: "b" }]);
  assert.equal(none.kept, null);
  assert.equal(none.score.value, 0);
});

test("capturePage runs both ways at once, keeps the renderer's files whatever text won, and answers a record for a page nobody could capture", async () => {
  const capturer = {
    capture: async () => ({ url: "http://p/", finalUrl: "http://p/", title: "Rendered", text: "few", textTruncated: false, settled: true, blocked: [{ target: "x", reason: "y" }], files: { pdf: { bytes: Buffer.from("%PDF") }, screenshot: { dropped: "too big" } } }),
  };
  const plain = async () => way("fetch", "the plain way answered a good deal more text than the renderer did", { author: "Bob" });
  const record = await capturePage({ target: "http://p/", capturer, plain });
  assert.equal(record.kept, "fetch");
  assert.equal(record.author, "Bob");
  assert.equal(record.settled, true);
  assert.equal(record.files.pdf.bytes.toString(), "%PDF");
  assert.equal(record.files.screenshot.dropped, "too big");
  assert.equal(record.blocked.length, 1);

  const refusing = { capture: async () => { const e = new Error("a private address"); e.refused = true; throw e; } };
  const nothing = await capturePage({ target: "http://p/", capturer: refusing, plain: async () => ({ ok: false, way: "fetch", refusal: "a private address" }) });
  assert.equal(nothing.kept, null);
  assert.deepEqual(nothing.files, {});
  assert.match(nothing.ways[1].refusal, /refused: a private address/);
});

// The plain way against pages the test serves.
const pages = http.createServer((request, response) => {
  switch (request.url) {
    case "/page":
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return response.end(`<html><head><title>Plain</title><meta name="author" content="Ann"></head><body><p>Plain words here.</p></body></html>`);
    case "/redirect":
      response.writeHead(302, { location: "http://public.test/page" });
      return response.end();
    case "/redirect-private":
      response.writeHead(302, { location: "http://private.test/" });
      return response.end();
    case "/loop":
      response.writeHead(302, { location: "http://public.test/loop" });
      return response.end();
    case "/bytes":
      response.writeHead(200, { "content-type": "application/pdf" });
      return response.end("%PDF");
    case "/big":
      response.writeHead(200, { "content-type": "text/html" });
      return response.end(`<html><body>${"word ".repeat(2000)}</body></html>`);
    default:
      response.writeHead(404);
      return response.end();
  }
});
let pagesPort;
const resolve = async (host) => ({ "public.test": ["203.0.113.7"], "private.test": ["10.0.0.5"] })[host] ?? [];
const dial = () => net.connect({ host: "127.0.0.1", port: pagesPort });

test.before(async () => {
  pagesPort = await new Promise((done) => pages.listen(0, "127.0.0.1", () => done(pages.address().port)));
});
test.after(async () => {
  pages.closeAllConnections();
  await new Promise((done) => pages.close(() => done()));
});

test("plainCapture fetches through the rule and the dialer, follows an allowed redirect and refuses a refused one before fetching", async () => {
  const ok = await plainCapture("http://public.test/page", { resolve, dial });
  assert.equal(ok.ok, true);
  assert.equal(ok.capture.title, "Plain");
  assert.equal(ok.capture.author, "Ann");
  assert.match(ok.capture.text, /Plain words here\./);
  assert.equal(ok.capture.way, "fetch");

  const followed = await plainCapture("http://public.test/redirect", { resolve, dial });
  assert.equal(followed.capture.finalUrl, "http://public.test/page");

  let dialed = 0;
  const counting = (address, port) => { dialed += 1; return dial(address, port); };
  const refused = await plainCapture("http://public.test/redirect-private", { resolve, dial: counting });
  assert.equal(refused.ok, false);
  assert.match(refused.refusal, /a private address/);
  assert.equal(dialed, 1, "the refused hop was never dialed");

  const asked = await plainCapture("http://private.test/", { resolve, dial: counting });
  assert.equal(asked.ok, false);
  assert.equal(dialed, 1, "a refused address is refused before fetching");
});

test("plainCapture refuses what is not a page, too many redirects, a cut body says it is a part, and nobody answering is said", async () => {
  const bytes = await plainCapture("http://public.test/bytes", { resolve, dial });
  assert.match(bytes.refusal, /not a page: the address answers application\/pdf/);
  const loop = await plainCapture("http://public.test/loop", { resolve, dial });
  assert.match(loop.refusal, /redirected more than 5 times/);
  const cut = await plainCapture("http://public.test/big", { resolve, dial, maxBytes: 500 });
  assert.equal(cut.ok, true);
  assert.equal(cut.capture.whole, false);
  const gone = await plainCapture("http://public.test/page", { resolve, dial: () => net.connect({ host: "127.0.0.1", port: 1 }) });
  assert.match(gone.refusal, /could not be reached/);
});
