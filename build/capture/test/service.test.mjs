// The service with the real browser, offline: the pages are served by the test
// itself on the loopback address and reached through the injected dialer, so
// the address rule can refuse loopback while the browser still has something
// to render. Runs inside the image, where the browser is. BO_0277_002
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { chromium } from "playwright";
import { createCapturer } from "../lib/capture.mjs";
import { capturePage } from "../lib/page.mjs";
import { plainCapture } from "../lib/plain.mjs";
import { createServer } from "../server.mjs";

const resolve = async (host) => ({ "public.test": ["203.0.113.7"], "private.test": ["10.0.0.5"] })[host] ?? [];

const pages = http.createServer((request, response) => {
  const path = request.url.split("?")[0];
  const html = (body, title = "A Page") =>
    response.end(`<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`);
  switch (path) {
    case "/page":
      response.writeHead(200, { "content-type": "text/html" });
      return html(
        `<h1>The heading</h1><p>Some words the reader can inspect.</p><img src="http://private.test/pixel.png" alt="">`,
      );
    case "/redirect-private":
      response.writeHead(302, { location: "http://private.test/" });
      return response.end();
    case "/redirect-public":
      response.writeHead(302, { location: "http://public.test/page" });
      return response.end();
    case "/slow":
      response.writeHead(200, { "content-type": "text/html" });
      return html(`<p>partly here</p><script src="/hang"></script>`, "Slow");
    case "/hang":
      return; // never answers, so the page never settles
    case "/download":
      response.writeHead(200, { "content-type": "application/octet-stream", "content-disposition": "attachment; filename=x.bin" });
      return response.end("bytes");
    case "/dialog":
      response.writeHead(200, { "content-type": "text/html" });
      return html(`<p>after the dialog</p><script>alert("hello")</script>`, "Dialog");
    default:
      response.writeHead(404);
      return response.end();
  }
});

let pagesPort;
let browser;
const dial = () => net.connect({ host: "127.0.0.1", port: pagesPort });

test.before(async () => {
  pagesPort = await new Promise((done) => pages.listen(0, "127.0.0.1", () => done(pages.address().port)));
  browser = await chromium.launch();
});

test.after(async () => {
  await browser.close();
  // The `/hang` request holds its connection open on purpose; closing the
  // server alone would wait for it forever.
  pages.closeAllConnections();
  await new Promise((done) => pages.close(() => done()));
});

const capturer = () => createCapturer({ browser, resolve, dial, caps: { loadMs: 4000, renderMs: 15000 } });

test("a page is answered with its text, title, final address, PDF and screenshot, and its private subresource blocked", async () => {
  const record = await capturer().capture("http://public.test/page");
  assert.equal(record.title, "A Page");
  assert.equal(record.finalUrl, "http://public.test/page");
  assert.match(record.text, /The heading/);
  assert.match(record.text, /Some words the reader can inspect/);
  assert.equal(record.settled, true);
  assert.ok(record.files.pdf.bytes.subarray(0, 4).toString() === "%PDF", "a PDF");
  assert.equal(record.files.screenshot.bytes[1], 0x50, "a PNG");
  assert.equal(record.blocked.length, 1);
  assert.match(record.blocked[0].reason, /private\.test resolves to 10\.0\.0\.5, a private address/);
});

test("a redirect onto a refused address ends the capture with the refusal", async () => {
  await assert.rejects(capturer().capture("http://public.test/redirect-private"), (error) => {
    assert.equal(error.refused, true);
    assert.match(error.message, /a private address/);
    return true;
  });
});

test("a redirect onto an allowed address is followed and the final address is the page's", async () => {
  const record = await capturer().capture("http://public.test/redirect-public");
  assert.equal(record.finalUrl, "http://public.test/page");
});

test("a page that does not settle within the cap is answered as far as it got and says so", async () => {
  const record = await capturer().capture("http://public.test/slow");
  assert.equal(record.settled, false);
  assert.match(record.text, /partly here/);
  assert.ok(record.files.pdf.bytes, "the PDF of what loaded");
});

test("a download is not followed", async () => {
  await assert.rejects(capturer().capture("http://public.test/download"), (error) => {
    assert.equal(error.refused, true);
    assert.match(error.message, /download/);
    return true;
  });
});

test("a dialog is dismissed and the capture completes", async () => {
  const record = await capturer().capture("http://public.test/dialog");
  assert.match(record.text, /after the dialog/);
});

test("a file above the byte cap is dropped and the record says so", async () => {
  const small = createCapturer({ browser, resolve, dial, caps: { loadMs: 4000, maxBytes: 10 } });
  const record = await small.capture("http://public.test/page");
  assert.match(record.files.pdf.dropped, /larger than the cap/);
  assert.match(record.files.screenshot.dropped, /larger than the cap/);
});

test("the address asked for is refused before any browser work", async () => {
  await assert.rejects(capturer().capture("http://10.0.0.5/"), /a private address/);
  await assert.rejects(capturer().capture("http://app:8080/v1/head"), /a name with no domain/);
});

test("an allowed address nobody answers is unreachable, not refused", async () => {
  const nobody = createCapturer({
    browser,
    resolve,
    dial: () => net.connect({ host: "127.0.0.1", port: 1 }),
    caps: { loadMs: 4000 },
  });
  await assert.rejects(nobody.capture("http://public.test/page"), (error) => {
    assert.equal(error.unreachable, true);
    return true;
  });
});

test("the server: health is open, everything else needs the bearer, a capture is answered with its files fetched once each", async () => {
  const service = createServer({ bearer: "secret-bearer", capturer: capturer(), keepMs: 60_000 });
  const { port } = await service.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${port}`;
  const auth = { authorization: "Bearer secret-bearer" };
  try {
    assert.equal((await fetch(`${base}/health`)).status, 200);
    assert.equal((await fetch(`${base}/v1/captures`, { method: "POST" })).status, 401);
    assert.equal((await fetch(`${base}/v1/captures`, { method: "POST", headers: { authorization: "Bearer wrong" } })).status, 401);

    const refused = await fetch(`${base}/v1/captures`, { method: "POST", headers: auth, body: JSON.stringify({ url: "http://127.0.0.1:8080/" }) });
    assert.equal(refused.status, 400);
    assert.match((await refused.json()).error, /a loopback address/);

    const empty = await fetch(`${base}/v1/captures`, { method: "POST", headers: auth, body: "{}" });
    assert.equal(empty.status, 400);

    const answered = await fetch(`${base}/v1/captures`, { method: "POST", headers: auth, body: JSON.stringify({ url: "http://public.test/page" }) });
    assert.equal(answered.status, 200);
    const record = await answered.json();
    assert.equal(record.title, "A Page");
    assert.ok(record.files.pdf.bytes > 0);
    assert.ok(record.files.screenshot.bytes > 0);
    assert.equal(record.blocked.length, 1);

    const pdf = await fetch(`${base}/v1/captures/${record.id}/pdf`, { headers: auth });
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), "%PDF");
    assert.equal((await fetch(`${base}/v1/captures/${record.id}/pdf`, { headers: auth })).status, 404, "served once");
    const png = await fetch(`${base}/v1/captures/${record.id}/screenshot`, { headers: auth });
    assert.equal(png.headers.get("content-type"), "image/png");
    assert.equal(service.kept.size, 0, "nothing kept once both files went");
    assert.equal((await fetch(`${base}/v1/captures/${record.id}/screenshot`)).status, 401);

    const unreachable = createServer({
      bearer: "secret-bearer",
      capturer: createCapturer({ browser, resolve, dial: () => net.connect({ host: "127.0.0.1", port: 1 }), caps: { loadMs: 4000 } }),
    });
    const other = await unreachable.listen(0, "127.0.0.1");
    try {
      const gone = await fetch(`http://127.0.0.1:${other.port}/v1/captures`, { method: "POST", headers: auth, body: JSON.stringify({ url: "http://public.test/page" }) });
      assert.equal(gone.status, 502);
    } finally {
      await unreachable.close();
    }
  } finally {
    await service.close();
  }
});

// Both ways in one answer: the plain way through the dialer and the browser
// through its proxy, compared, with the files kept under the file routes.
// BO_0284_001
test("the server: /v1/pages captures both ways, keeps the better text with the score, and its files are fetched once each", async () => {
  const pager = (target) => capturePage({ target, capturer: capturer(), plain: (url) => plainCapture(url, { resolve, dial }) });
  const service = createServer({ bearer: "secret-bearer", capturer: capturer(), pager, keepMs: 60_000 });
  const { port } = await service.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${port}`;
  const auth = { authorization: "Bearer secret-bearer" };
  try {
    assert.equal((await fetch(`${base}/v1/pages`, { method: "POST" })).status, 401);
    const answered = await fetch(`${base}/v1/pages`, { method: "POST", headers: auth, body: JSON.stringify({ url: "http://public.test/page" }) });
    assert.equal(answered.status, 200);
    const record = await answered.json();
    assert.equal(record.url, "http://public.test/page");
    assert.equal(record.title, "A Page");
    assert.match(record.text, /Some words the reader can inspect/);
    assert.ok(["fetch", "render"].includes(record.kept));
    assert.equal(record.ways.length, 2);
    assert.ok(record.ways.every((way) => way.ok), JSON.stringify(record.ways));
    assert.equal(record.score.by, "comparison");
    // "A Page" has one significant word the body never repeats, so the score
    // is honestly zero here; what matters is that the comparison scored it.
    assert.equal(typeof record.score.value, "number");
    assert.match(record.score.reason, /significant words/);
    assert.ok(record.files.pdf.bytes > 0);
    assert.ok(record.files.screenshot.bytes > 0);
    assert.equal(record.settled, true);
    const pdf = await fetch(`${base}/v1/captures/${record.id}/pdf`, { headers: auth });
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    assert.equal((await fetch(`${base}/v1/captures/${record.id}/pdf`, { headers: auth })).status, 404, "served once");

    // A page nobody could capture is a record with both refusals and no files.
    const none = await fetch(`${base}/v1/pages`, { method: "POST", headers: auth, body: JSON.stringify({ url: "http://private.test/" }) });
    assert.equal(none.status, 200);
    const nothing = await none.json();
    assert.equal(nothing.kept, null);
    assert.equal(nothing.id, null);
    assert.match(nothing.ways[0].refusal, /a private address/);
    assert.match(nothing.ways[1].refusal, /a private address/);
    assert.deepEqual(nothing.files, {});
  } finally {
    await service.close();
  }
});
