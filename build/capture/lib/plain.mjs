// The plain way: the page fetched as a plain HTTP client would, its text
// pulled out of the HTML. The address rule is applied to the address asked
// for and to every redirect before the next hop is followed, and the
// connection is made to the address the rule resolved through the same
// `dial` the proxy uses, so a test serves its pages on the loopback address
// while the rule still refuses loopback. Moved here from `calliopa-refine`'s
// `server/fetch.ts` (BO_0284_001).
//
// The caps: thirty seconds for the page to answer, five megabytes of body
// read before the rest is dropped and the text marked a part, five redirect
// hops. A page that is not HTML is this way's refusal, *not a page* — the
// renderer may still have something to say about it — and never the
// capture's.
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { refusal } from "./address.mjs";
import { extractPage } from "./page.mjs";

export const PLAIN_LOAD_MS = 30_000;
export const PLAIN_MAX_BYTES = 5 * 1024 * 1024;
const MAX_HOPS = 5;

const refused = (why) => ({ ok: false, way: "fetch", refusal: why });

function request(url, { dial, address, port, timeoutMs, maxBytes }) {
  return new Promise((resolve, reject) => {
    const secure = url.protocol === "https:";
    const client = secure ? https : http;
    const req = client.request(
      {
        method: "GET",
        host: url.hostname,
        path: url.pathname + url.search,
        headers: {
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "accept-language": "en, *;q=0.5",
          "user-agent": "Calliopa (investigation; +https://calliopa.ai)",
        },
        createConnection: () => {
          const socket = dial(address, port);
          return secure ? tls.connect({ socket, servername: url.hostname }) : socket;
        },
      },
      (response) => {
        const chunks = [];
        let size = 0;
        let whole = true;
        response.on("data", (chunk) => {
          if (!whole) return;
          if (size + chunk.length > maxBytes) {
            chunks.push(chunk.subarray(0, maxBytes - size));
            whole = false;
            response.destroy();
            return;
          }
          chunks.push(chunk);
          size += chunk.length;
        });
        const done = () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks), whole });
        response.on("end", done);
        response.on("close", done);
        response.on("error", reject);
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`the page did not answer within ${timeoutMs} ms`)));
    req.on("error", reject);
    req.end();
  });
}

export async function plainCapture(target, { resolve, dial = (address, port) => net.connect({ host: address, port }), loadMs = PLAIN_LOAD_MS, maxBytes = PLAIN_MAX_BYTES } = {}) {
  const started = Date.now();
  let current = String(target);
  for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
    const decision = await refusal(current, { resolve });
    if (!decision.ok) return refused(decision.reason);
    // The rule answers the host, the port and the addresses it resolved; the
    // address itself is parsed here, and it parses, since the rule passed it.
    const url = new URL(current);
    const remaining = loadMs - (Date.now() - started);
    if (remaining <= 0) return refused(`the page did not answer within ${loadMs} ms`);
    let response;
    try {
      response = await request(url, { dial, address: decision.addresses[0], port: decision.port, timeoutMs: remaining, maxBytes });
    } catch (error) {
      if (/did not answer within/u.test(error.message)) return refused(`the page did not answer within ${loadMs} ms`);
      return refused(`the page could not be reached: ${error.message}`);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.location;
      if (location === undefined || location === "") return refused(`the page answered ${response.status} with nowhere to go`);
      try {
        current = new URL(location, url).href;
      } catch {
        return refused("the page redirected to something that is not an address");
      }
      continue;
    }
    if (response.status < 200 || response.status >= 300) return refused(`the page answered ${response.status}`);
    const type = String(response.headers["content-type"] ?? "").toLowerCase();
    if (!type.includes("text/html") && !type.includes("application/xhtml")) {
      return refused(`not a page: the address answers ${type === "" ? "no content type" : type.split(";")[0]}`);
    }
    const extracted = extractPage(response.body.toString("utf8"));
    return { ok: true, capture: { way: "fetch", finalUrl: url.href, ...extracted, whole: response.whole && extracted.whole } };
  }
  return refused(`the page redirected more than ${MAX_HOPS} times`);
}
