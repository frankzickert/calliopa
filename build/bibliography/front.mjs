// The bibliography service's front: the bearer and the address rule in front
// of the Zotero translation server.
//
// The engine answers anyone who can reach its port and fetches whatever
// address it is handed, so it never faces the compose network: it is bound to
// the loopback address, and this front is the one listener. `GET /health` is
// open and honest about the engine behind it; everything else needs the
// bearer the bootstrap one-shot wrote, and only the engine's four routes pass
// — `/web`, `/search`, `/export`, `/import` — with the body as it came and the
// answer as it came, so the extension reads the engine's own JSON, `300`
// included.
//
// The address rule is applied twice, as capture applies it: at the entry, so
// a refused address is answered in words before the engine is asked, and at a
// forward proxy the engine is pointed at through `HTTP_PROXY`/`HTTPS_PROXY`,
// so every request the engine makes — the address handed in, each redirect,
// each request a translator issues — is checked at the moment it is made.
//
// The front also owns the engine's process: it starts `node src/server.js`
// and ends when that process ends, so compose sees one container die and
// restarts a clean one. Standard library only. BO_0291_001
import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { refusal } from "./lib/address.mjs";
import { startProxy } from "./lib/proxy.mjs";

// A record is kilobytes; a page the engine reads can be megabytes, but what
// it answers is the record. Four megabytes is far above any answer and far
// below anything that would hurt the caller.
export const MAX_ANSWER_BYTES = 4 * 1024 * 1024;
// An identifier or an address is a line; an import is a file, and a BibTeX
// library of a few thousand entries is a few megabytes.
export const MAX_BODY_BYTES = 8 * 1024 * 1024;
// The engine's own fetch has a timeout of its own per request; a translation
// that has not answered in a minute is a site that has hung.
export const UPSTREAM_TIMEOUT_MS = 60_000;

const ROUTES = new Set(["/web", "/search", "/export", "/import"]);

function readBody(request, max = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > max) {
        reject(new Error(`the request body is larger than ${max} bytes`));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function answer(response, status, body, type = "application/json") {
  const bytes = type === "application/json" ? Buffer.from(JSON.stringify(body)) : body;
  response.writeHead(status, { "content-type": type, "content-length": bytes.length });
  response.end(bytes);
}

function words(response, status, message) {
  answer(response, status, { error: message });
}

// The engine's answer, as it came: its status, its type and its bytes.
function verbatim(response, { status, type, body }) {
  response.writeHead(status, { "content-type": type, "content-length": body.length });
  response.end(body);
}

// A bounded queue in front of the engine: `concurrency` translations at once
// and `queue` waiting; more than that is answered busy rather than piled up.
export function createGate({ concurrency = 4, queue = 16 } = {}) {
  let running = 0;
  const waiting = [];
  const next = () => {
    if (running < concurrency && waiting.length) {
      running += 1;
      waiting.shift()();
    }
  };
  return {
    async run(work) {
      if (running >= concurrency && waiting.length >= queue) {
        const busy = new Error("busy: too many translations are waiting");
        busy.busy = true;
        throw busy;
      }
      await new Promise((start) => {
        waiting.push(start);
        next();
      });
      try {
        return await work();
      } finally {
        running -= 1;
        next();
      }
    },
  };
}

// One request to the engine; answers {status, type, body} or throws when the
// engine is not there or answered more than the front carries.
function forward(upstream, { method, path, headers, body, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const target = new URL(path, upstream);
    const request = http.request(
      { method, host: target.hostname, port: target.port, path: target.pathname + target.search, headers },
      (response) => {
        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > MAX_ANSWER_BYTES) {
            response.destroy();
            const large = new Error("the engine answered more than the front carries");
            large.large = true;
            reject(large);
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => resolve({ status: response.statusCode, type: response.headers["content-type"] || "application/octet-stream", body: Buffer.concat(chunks) }));
        response.on("error", reject);
      },
    );
    request.setTimeout(timeoutMs, () => request.destroy(new Error(`the engine did not answer within ${timeoutMs} ms`)));
    request.on("error", reject);
    request.end(body);
  });
}

// `upstream` is the engine's address; `resolve` the name resolver the entry
// check uses (the proxy takes its own); `engineAlive` says whether the engine
// answers, for `/health`.
export function createServer({ bearer, upstream, resolve, gate = createGate(), engineAlive, timeoutMs = UPSTREAM_TIMEOUT_MS }) {
  const token = Buffer.from(bearer);
  const authorized = (request) => {
    const header = request.headers.authorization || "";
    const presented = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
    return presented.length === token.length && timingSafeEqual(presented, token);
  };
  const alive = engineAlive ?? (() => forward(upstream, { method: "GET", path: "/", headers: {}, body: undefined, timeoutMs: 4_000 }).then(() => true, () => false));

  return http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://bibliography");
    if (request.method === "GET" && url.pathname === "/health") {
      // Open, and honest about the engine behind it: the container is
      // healthy only while the engine itself answers.
      if (!(await alive())) {
        words(response, 503, "the engine is not answering");
        return;
      }
      answer(response, 200, { status: "ok", engine: "zotero-translation-server" });
      return;
    }
    if (!authorized(request)) {
      words(response, 401, "the bibliography bearer is required");
      return;
    }
    if (!ROUTES.has(url.pathname)) {
      words(response, 404, "the bibliography service answers /web, /search, /export and /import");
      return;
    }
    if (request.method !== "POST") {
      words(response, 405, "the bibliography service answers POST alone");
      return;
    }
    let body;
    try {
      body = await readBody(request);
    } catch (error) {
      words(response, 413, error.message);
      return;
    }
    if (url.pathname === "/web") {
      // The entry check: a refused address is answered here in words, before
      // the engine is asked. A selection posted back is JSON, not an address,
      // and passes to the engine, whose own fetches the proxy checks.
      const text = body.toString("utf8").trim();
      if (!text.startsWith("{")) {
        const decision = await refusal(text, resolve ? { resolve } : {});
        if (!decision.ok) {
          words(response, 400, `refused: ${decision.reason}`);
          return;
        }
      }
    }
    const headers = { "content-type": request.headers["content-type"] || "text/plain" };
    try {
      const answered = await gate.run(() =>
        forward(upstream, { method: "POST", path: url.pathname + url.search, headers, body, timeoutMs }),
      );
      verbatim(response, answered);
    } catch (error) {
      if (error.busy) words(response, 503, error.message);
      else if (error.large) words(response, 502, error.message);
      else if (/did not answer within/u.test(error.message)) words(response, 504, error.message);
      else words(response, 502, "the engine is not answering");
    }
  });
}

function readBearer(path) {
  let bearer = "";
  try {
    bearer = readFileSync(path, "utf8").trim();
  } catch {
    bearer = "";
  }
  if (!bearer) {
    console.error(`bibliography: no bearer at ${path}; the stack's bootstrap writes it`);
    process.exit(1);
  }
  return bearer;
}

async function main() {
  const bearer = readBearer(process.env.CALLIOPA_BIBLIOGRAPHY_BEARER_FILE || "/run/secrets/calliopa/bibliography_bearer");
  const port = Number(process.env.CALLIOPA_BIBLIOGRAPHY_PORT || 8099);
  const enginePort = Number(process.env.CALLIOPA_BIBLIOGRAPHY_ENGINE_PORT || 1969);
  const engineDir = process.env.CALLIOPA_BIBLIOGRAPHY_ENGINE_DIR || "/app";
  const upstream = `http://127.0.0.1:${enginePort}`;

  // The proxy every request the engine makes passes through, on the loopback
  // address; the engine is told to use it for http and https alike and to
  // bypass it for nothing.
  const proxy = await startProxy();
  const engine = spawn("node", ["src/server.js"], {
    cwd: engineDir,
    stdio: ["ignore", "inherit", "inherit"],
    env: {
      ...process.env,
      HTTP_PROXY: proxy.server,
      HTTPS_PROXY: proxy.server,
      http_proxy: proxy.server,
      https_proxy: proxy.server,
      NO_PROXY: "",
      no_proxy: "",
      // The engine binds to the loopback address alone; the front is what the
      // network reaches. Its user agent stays its own — the translators are
      // written for a browser's — and everything else keeps its default.
      NODE_CONFIG: JSON.stringify({ host: "127.0.0.1", port: enginePort }),
    },
  });

  const server = createServer({ bearer, upstream });
  server.listen(port, "0.0.0.0", () => console.error(`bibliography: front on ${port}, engine on ${upstream}, proxy on ${proxy.server}`));

  const stop = async (code) => {
    server.close();
    if (engine.exitCode === null) engine.kill("SIGTERM");
    await proxy.close();
    process.exit(code);
  };
  engine.on("exit", (code) => {
    console.error(`bibliography: the engine ended with ${code}; ending with it`);
    stop(1);
  });
  process.on("SIGTERM", () => stop(0));
  process.on("SIGINT", () => stop(0));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
