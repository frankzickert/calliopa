// The front, offline: the engine is a server the test runs itself, so what
// reaches it and what comes back are both seen. Nothing here touches the
// network; the rule's resolver is handed in. BO_0291_001
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createGate, createServer, MAX_ANSWER_BYTES } from "../front.mjs";

const resolve = async (host) => ({ "public.test": ["203.0.113.7"], "private.test": ["10.0.0.5"] })[host] ?? [];

function listen(server) {
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done(`http://127.0.0.1:${server.address().port}`)));
}

// A stand-in engine: records what it was asked and answers by path.
function engine(seen) {
  return http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf8");
    seen.push({ method: request.method, url: request.url, type: request.headers["content-type"], body });
    switch (request.url.split("?")[0]) {
      case "/search":
        response.writeHead(200, { "content-type": "application/json" });
        if (body === "large") return response.end(Buffer.alloc(MAX_ANSWER_BYTES + 1, 0x20));
        return response.end(JSON.stringify([{ itemType: "journalArticle", title: `for ${body}` }]));
      case "/web":
        response.writeHead(300, { "content-type": "application/json" });
        return response.end(JSON.stringify({ url: body, session: "s1", items: { "1": "One", "2": "Two" } }));
      case "/export":
        response.writeHead(200, { "content-type": "application/vnd.citationstyles.csl+json" });
        return response.end("[]");
      case "/":
        response.writeHead(404);
        return response.end("Not Found");
      default:
        response.writeHead(500);
        return response.end("unexpected");
    }
  });
}

async function withFront(fn, options = {}) {
  const seen = [];
  const upstreamServer = engine(seen);
  const upstream = await listen(upstreamServer);
  const front = createServer({ bearer: "the-bearer", upstream, resolve, ...options });
  const base = await listen(front);
  const call = (path, { method = "POST", body, headers = {} } = {}) =>
    fetch(base + path, { method, body, headers: { authorization: "Bearer the-bearer", "content-type": "text/plain", ...headers } });
  try {
    await fn({ call, base, seen });
  } finally {
    front.close();
    upstreamServer.close();
  }
}

test("health is open and says the engine answers", async () => {
  await withFront(async ({ base }) => {
    const answered = await fetch(`${base}/health`);
    assert.equal(answered.status, 200);
    assert.deepEqual(await answered.json(), { status: "ok", engine: "zotero-translation-server" });
  });
});

test("health says the engine is not answering when it is not there", async () => {
  const front = createServer({ bearer: "b", upstream: "http://127.0.0.1:1", resolve });
  const base = await listen(front);
  try {
    const answered = await fetch(`${base}/health`);
    assert.equal(answered.status, 503);
    assert.match((await answered.json()).error, /not answering/);
  } finally {
    front.close();
  }
});

test("without the bearer nothing but health answers, and nothing reaches the engine", async () => {
  await withFront(async ({ base, seen }) => {
    for (const authorization of [undefined, "Bearer wrong", "Basic x"]) {
      const answered = await fetch(`${base}/search`, { method: "POST", body: "10.1000/x", headers: authorization ? { authorization } : {} });
      assert.equal(answered.status, 401);
      assert.match((await answered.json()).error, /bearer/);
    }
    assert.deepEqual(seen, []);
  });
});

test("an identifier reaches /search as it came and the engine's answer comes back verbatim", async () => {
  await withFront(async ({ call, seen }) => {
    const answered = await call("/search", { body: "10.1234/abcd" });
    assert.equal(answered.status, 200);
    assert.equal(answered.headers.get("content-type"), "application/json");
    assert.deepEqual(await answered.json(), [{ itemType: "journalArticle", title: "for 10.1234/abcd" }]);
    assert.deepEqual(seen, [{ method: "POST", url: "/search", type: "text/plain", body: "10.1234/abcd" }]);
  });
});

test("a public address reaches /web and a 300 with the candidates comes back as the engine answered it", async () => {
  await withFront(async ({ call }) => {
    const answered = await call("/web", { body: "https://public.test/paper" });
    assert.equal(answered.status, 300);
    assert.deepEqual(await answered.json(), { url: "https://public.test/paper", session: "s1", items: { "1": "One", "2": "Two" } });
  });
});

test("a selection posted back to /web is JSON, not an address, and passes to the engine", async () => {
  await withFront(async ({ call, seen }) => {
    const selection = JSON.stringify({ url: "https://public.test/paper", session: "s1", items: { "1": "One" } });
    const answered = await call("/web", { body: selection, headers: { "content-type": "application/json" } });
    assert.equal(answered.status, 300);
    assert.equal(seen[0].type, "application/json");
    assert.equal(seen[0].body, selection);
  });
});

test("a refused address is answered in words at the entry and never reaches the engine", async () => {
  await withFront(async ({ call, seen }) => {
    for (const [target, why] of [
      ["http://private.test/", /private address/],
      ["http://127.0.0.1:8080/", /loopback/],
      ["http://app:8080/", /no domain/],
      ["ftp://public.test/", /http or https/],
      ["not an address", /not an address/],
    ]) {
      const answered = await call("/web", { body: target });
      assert.equal(answered.status, 400, target);
      assert.match((await answered.json()).error, why);
    }
    assert.deepEqual(seen, []);
  });
});

test("the export format travels in the query", async () => {
  await withFront(async ({ call, seen }) => {
    const answered = await call("/export?format=csljson", { body: "[]", headers: { "content-type": "application/json" } });
    assert.equal(answered.status, 200);
    assert.equal(answered.headers.get("content-type"), "application/vnd.citationstyles.csl+json");
    assert.equal(seen[0].url, "/export?format=csljson");
  });
});

test("only the four routes pass, and only by POST", async () => {
  await withFront(async ({ call, seen }) => {
    const other = await call("/large", { body: "x" });
    assert.equal(other.status, 404);
    assert.match((await other.json()).error, /\/web, \/search, \/export and \/import/);
    const get = await call("/search", { method: "GET" });
    assert.equal(get.status, 405);
    assert.deepEqual(seen, []);
  });
});

test("an answer larger than the front carries is refused in words", async () => {
  await withFront(async ({ call }) => {
    const answered = await call("/search", { body: "large" });
    assert.equal(answered.status, 502);
    assert.match((await answered.json()).error, /more than the front carries/);
  });
});

test("more translations than the gate holds are answered busy rather than piled up", async () => {
  const gate = createGate({ concurrency: 1, queue: 0 });
  let release;
  const held = new Promise((done) => {
    release = done;
  });
  const first = gate.run(() => held);
  await assert.rejects(gate.run(async () => "second"), /busy/);
  release("first");
  assert.equal(await first, "first");
});
