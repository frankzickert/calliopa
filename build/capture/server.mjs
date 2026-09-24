// The page capture service: `POST /v1/captures` renders a public page and
// answers the record; the PDF and the screenshot are fetched once each from
// their own routes and kept for a bounded time. Everything but `/health` is
// refused without the bearer. `docs/system/page-capture-service.md`. BO_0277_002
import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { createCapturer } from "./lib/capture.mjs";
import { capturePage } from "./lib/page.mjs";
import { plainCapture } from "./lib/plain.mjs";

const MAX_BODY = 64 * 1024;

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("the request body is larger than 64 KiB"));
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

// A bounded queue in front of the browser: `concurrency` captures at once and
// `queue` waiting; more than that is answered busy rather than piled up.
function createGate({ concurrency = 2, queue = 8 } = {}) {
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
        const busy = new Error("busy: too many captures are waiting");
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

// `pager` captures a page both ways and compares (`lib/page.mjs`); built from
// the capturer and the plain way unless a test hands one in. BO_0284_001
export function createServer({ bearer, capturer, pager, keepMs = 10 * 60_000, gate = createGate(), health = () => ({}) }) {
  const pages = pager ?? ((target) => capturePage({ target, capturer, plain: (url) => plainCapture(url) }));
  const token = Buffer.from(bearer);
  const kept = new Map();

  const authorized = (request) => {
    const header = request.headers.authorization || "";
    const presented = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
    return presented.length === token.length && timingSafeEqual(presented, token);
  };

  const keep = (files) => {
    const id = randomBytes(12).toString("hex");
    const entry = { files, timer: setTimeout(() => kept.delete(id), keepMs) };
    entry.timer.unref();
    kept.set(id, entry);
    return id;
  };

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://capture");
    if (request.method === "GET" && url.pathname === "/health") {
      answer(response, 200, { status: "ok", ...health() });
      return;
    }
    if (!authorized(request)) {
      words(response, 401, "the capture bearer is required");
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/captures") {
      let target;
      try {
        const body = JSON.parse((await readBody(request)).toString("utf8") || "{}");
        target = body.url;
      } catch (error) {
        words(response, 400, `the body must be JSON with a url: ${error.message}`);
        return;
      }
      if (typeof target !== "string" || target.trim() === "") {
        words(response, 400, "the body must carry a url");
        return;
      }
      try {
        const record = await gate.run(() => capturer.capture(target.trim()));
        const files = {};
        const sizes = {};
        for (const [name, file] of Object.entries(record.files)) {
          if (file.bytes) {
            files[name] = file.bytes;
            sizes[name] = { bytes: file.bytes.length };
          } else {
            sizes[name] = { dropped: file.dropped };
          }
        }
        const id = keep(files);
        const { files: _omit, ...rest } = record;
        answer(response, 200, { id, ...rest, files: sizes, keptMs: keepMs });
      } catch (error) {
        if (error.refused) words(response, 400, `refused: ${error.message}`);
        else if (error.unreachable) words(response, 502, `the page could not be reached: ${error.message}`);
        else if (error.busy) words(response, 503, error.message);
        else words(response, 500, `the capture failed: ${error.message}`);
      }
      return;
    }
    // Both ways and the comparison in one answer; the files are kept and
    // served once each under the same file routes. A page no way could
    // capture is still a record, with both refusals and no files; only the
    // address rule and the queue refuse the call itself. BO_0284_001
    if (request.method === "POST" && url.pathname === "/v1/pages") {
      let target;
      try {
        const body = JSON.parse((await readBody(request)).toString("utf8") || "{}");
        target = body.url;
      } catch (error) {
        words(response, 400, `the body must be JSON with a url: ${error.message}`);
        return;
      }
      if (typeof target !== "string" || target.trim() === "") {
        words(response, 400, "the body must carry a url");
        return;
      }
      try {
        const record = await gate.run(() => pages(target.trim()));
        const files = {};
        const sizes = {};
        for (const [name, file] of Object.entries(record.files)) {
          if (file.bytes) {
            files[name] = file.bytes;
            sizes[name] = { bytes: file.bytes.length };
          } else {
            sizes[name] = { dropped: file.dropped };
          }
        }
        const id = Object.keys(files).length > 0 ? keep(files) : null;
        const { files: _omit, ...rest } = record;
        answer(response, 200, { id, ...rest, files: sizes, keptMs: keepMs });
      } catch (error) {
        if (error.busy) words(response, 503, error.message);
        else words(response, 500, `the capture failed: ${error.message}`);
      }
      return;
    }
    const file = url.pathname.match(/^\/v1\/captures\/([0-9a-f]+)\/(pdf|screenshot)$/);
    if (request.method === "GET" && file) {
      const entry = kept.get(file[1]);
      const bytes = entry && entry.files[file[2]];
      if (!bytes) {
        words(response, 404, "no such capture file: it was never made, was already fetched, or its time is up");
        return;
      }
      delete entry.files[file[2]];
      if (Object.keys(entry.files).length === 0) {
        clearTimeout(entry.timer);
        kept.delete(file[1]);
      }
      answer(response, 200, bytes, file[2] === "pdf" ? "application/pdf" : "image/png");
      return;
    }
    words(response, 404, "no such route");
  });

  return {
    listen: (port, host = "0.0.0.0") =>
      new Promise((resolve) => server.listen(port, host, () => resolve(server.address()))),
    close: () => new Promise((resolve) => server.close(() => resolve())),
    kept,
  };
}

async function main() {
  const bearerFile = process.env.CALLIOPA_CAPTURE_BEARER_FILE || "/run/secrets/calliopa/capture_bearer";
  const bearer = readFileSync(bearerFile, "utf8").trim();
  if (!bearer) {
    console.error(`capture: the bearer at ${bearerFile} is empty`);
    process.exit(1);
  }
  const port = Number(process.env.CALLIOPA_CAPTURE_PORT) || 8096;
  const caps = {
    loadMs: Number(process.env.CALLIOPA_CAPTURE_LOAD_MS) || undefined,
    renderMs: Number(process.env.CALLIOPA_CAPTURE_RENDER_MS) || undefined,
    maxBytes: Number(process.env.CALLIOPA_CAPTURE_MAX_BYTES) || undefined,
  };
  const browser = await chromium.launch();
  const capturer = createCapturer({ browser, caps });
  const service = createServer({
    bearer,
    capturer,
    keepMs: Number(process.env.CALLIOPA_CAPTURE_KEEP_MS) || undefined,
    health: () => ({ browser: browser.isConnected() ? "connected" : "gone", version: browser.version() }),
  });
  const address = await service.listen(port);
  console.log(`capture: serving on ${address.port} with ${browser.version()}, load cap ${capturer.limits.loadMs} ms`);
  browser.on("disconnected", () => {
    console.error("capture: the browser is gone; ending so the stack restarts a clean one");
    process.exit(1);
  });
  const stop = async () => {
    await service.close();
    await browser.close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(`capture: ${error.message}`);
    process.exit(1);
  });
}
