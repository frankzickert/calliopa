// Carried verbatim from `infra/capture/lib/proxy.mjs`: the forward proxy is capture's, and the
// bibliography service holds the same copy because each service image is
// built from its own directory. A change to one is a change to both. BO_0291_001
// A forward proxy the browser is made to use for every connection, so the
// address rule is one check at one place: the navigation, every redirect and
// every request the page makes all pass here, and the connection is made to
// the address the rule resolved rather than to whatever the browser would
// resolve a moment later. One proxy per capture, on the loopback address, on
// an ephemeral port, closed when the capture ends. BO_0277_002
import http from "node:http";
import net from "node:net";
import { refusal } from "./address.mjs";

const HOP_BY_HOP = new Set([
  "proxy-connection",
  "proxy-authorization",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
]);

// `resolve` decides names (see address.mjs); `dial(address, port)` opens the
// TCP connection to an address the rule allowed, `net.connect` unless a test
// hands in one that reaches the pages it serves itself.
export function startProxy({ resolve, dial = (address, port) => net.connect({ host: address, port }) } = {}) {
  const refusals = [];
  const refuse = (target, reason) => {
    refusals.push({ target, reason });
  };

  // A plain request that is refused, or whose host nobody answers, is not
  // answered with an error page: the browser would render that page and a
  // capture of the proxy's own words would look like a capture of the site.
  // The connection is dropped instead, so a navigation fails and a
  // subresource is simply missing, and the refusal is recorded here.
  const server = http.createServer(async (request, response) => {
    const decision = await refusal(request.url, { resolve });
    if (!decision.ok) {
      refuse(request.url, decision.reason);
      request.socket.destroy();
      return;
    }
    const url = new URL(request.url);
    const headers = {};
    for (const [name, value] of Object.entries(request.headers)) {
      if (!HOP_BY_HOP.has(name)) headers[name] = value;
    }
    const upstream = http.request(
      {
        method: request.method,
        path: url.pathname + url.search,
        headers,
        createConnection: () => dial(decision.addresses[0], decision.port),
      },
      (answer) => {
        response.writeHead(answer.statusCode, answer.headers);
        answer.pipe(response);
      },
    );
    upstream.on("error", () => {
      request.socket.destroy();
    });
    request.pipe(upstream);
  });

  server.on("connect", async (request, socket, head) => {
    const decision = await refusal(`https://${request.url}`, { resolve });
    if (!decision.ok) {
      refuse(request.url, decision.reason);
      socket.end(`HTTP/1.1 403 Forbidden\r\ncontent-type: text/plain\r\n\r\nrefused: ${decision.reason}`);
      return;
    }
    const upstream = dial(decision.addresses[0], decision.port);
    upstream.on("connect", () => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head && head.length) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on("error", () => socket.end("HTTP/1.1 502 Bad Gateway\r\n\r\n"));
    socket.on("error", () => upstream.destroy());
  });

  return new Promise((resolveStart) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolveStart({
        port,
        server: `http://127.0.0.1:${port}`,
        refusals,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
