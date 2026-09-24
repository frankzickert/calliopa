// The proxy every browser connection passes: an allowed request is forwarded to
// the address the rule resolved, a refused one is answered 403 in words and
// recorded, and a tunnel is opened only for an allowed host. The pages are
// served by the test itself and reached through the injected dialer, so no
// network is touched. BO_0277_002
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { startProxy } from "../lib/proxy.mjs";

const resolve = async (host) => ({ "public.test": ["203.0.113.7"], "private.test": ["10.0.0.5"] })[host] ?? [];

function listen(server) {
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done(server.address().port)));
}

function rawRequest(port, text) {
  return new Promise((done, fail) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => socket.write(text));
    let got = "";
    socket.on("data", (chunk) => {
      got += chunk;
    });
    socket.on("end", () => done(got));
    socket.on("error", fail);
    setTimeout(() => socket.end(), 500);
  });
}

test("an allowed plain request is forwarded to the resolved address with its path, query and headers", async () => {
  const seen = [];
  const pages = http.createServer((request, response) => {
    seen.push({ url: request.url, host: request.headers.host, marker: request.headers["x-marker"] });
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("served");
  });
  const pagesPort = await listen(pages);
  const dial = (address, port) => {
    assert.equal(address, "203.0.113.7");
    assert.equal(port, 80);
    return net.connect({ host: "127.0.0.1", port: pagesPort });
  };
  const proxy = await startProxy({ resolve, dial });
  try {
    const got = await rawRequest(
      proxy.port,
      "GET http://public.test/a/b?c=1 HTTP/1.1\r\nHost: public.test\r\nX-Marker: yes\r\nProxy-Connection: keep-alive\r\nConnection: close\r\n\r\n",
    );
    assert.match(got, /HTTP\/1\.1 200/);
    assert.match(got, /served/);
    assert.deepEqual(seen, [{ url: "/a/b?c=1", host: "public.test", marker: "yes" }]);
    assert.deepEqual(proxy.refusals, []);
  } finally {
    await proxy.close();
    pages.close();
  }
});

test("a refused plain request gets no answer at all — the connection is dropped — and is recorded, never dialled", async () => {
  let dialled = 0;
  const proxy = await startProxy({
    resolve,
    dial: () => {
      dialled += 1;
      return net.connect({ host: "127.0.0.1", port: 1 });
    },
  });
  try {
    const got = await rawRequest(proxy.port, "GET http://private.test/x HTTP/1.1\r\nHost: private.test\r\nConnection: close\r\n\r\n");
    assert.equal(got, "", "an error page would be rendered by the browser as if it were the site");
    assert.equal(dialled, 0);
    assert.equal(proxy.refusals.length, 1);
    assert.match(proxy.refusals[0].reason, /private\.test resolves to 10\.0\.0\.5, a private address/);
  } finally {
    await proxy.close();
  }
});

test("a tunnel is established for an allowed host and bytes flow both ways", async () => {
  const echo = net.createServer((socket) => socket.on("data", (d) => socket.write(`echo:${d}`)));
  const echoPort = await listen(echo);
  const proxy = await startProxy({ resolve, dial: () => net.connect({ host: "127.0.0.1", port: echoPort }) });
  try {
    const got = await new Promise((done, fail) => {
      const socket = net.connect({ host: "127.0.0.1", port: proxy.port }, () =>
        socket.write("CONNECT public.test:443 HTTP/1.1\r\nHost: public.test:443\r\n\r\n"),
      );
      let text = "";
      socket.on("data", (chunk) => {
        text += chunk;
        if (text.includes("200 Connection Established") && !text.includes("echo:")) socket.write("ping");
        if (text.includes("echo:ping")) {
          socket.end();
          done(text);
        }
      });
      socket.on("error", fail);
    });
    assert.match(got, /200 Connection Established/);
    assert.match(got, /echo:ping/);
  } finally {
    await proxy.close();
    echo.close();
  }
});

test("a tunnel to a refused host is refused 403 and recorded", async () => {
  const proxy = await startProxy({ resolve, dial: () => net.connect({ host: "127.0.0.1", port: 1 }) });
  try {
    const got = await rawRequest(proxy.port, "CONNECT 10.0.0.5:443 HTTP/1.1\r\nHost: 10.0.0.5:443\r\n\r\n");
    assert.match(got, /HTTP\/1\.1 403/);
    assert.match(got, /a private address/);
    assert.equal(proxy.refusals.length, 1);
  } finally {
    await proxy.close();
  }
});

test("an allowed host nobody answers drops the connection rather than hanging or answering a page", async () => {
  const closed = net.createServer();
  const closedPort = await listen(closed);
  await new Promise((done) => closed.close(done));
  const proxy = await startProxy({ resolve, dial: () => net.connect({ host: "127.0.0.1", port: closedPort }) });
  try {
    const got = await rawRequest(proxy.port, "GET http://public.test/ HTTP/1.1\r\nHost: public.test\r\nConnection: close\r\n\r\n");
    assert.equal(got, "");
    assert.deepEqual(proxy.refusals, [], "unreachable is not a refusal");
  } finally {
    await proxy.close();
  }
});
