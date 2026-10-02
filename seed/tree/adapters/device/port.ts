import {
  CapacitorHttp,
  Cell,
  PROTOCOL,
  type CellRequest,
  type CellResponse,
} from "#host";

import type {
  ConfigFiles,
  Port,
  PortEnvName,
  Scope,
} from "../../src/server/port/port";

/**
 * The port in the apps' WebView (`docs/system/foundation/device.md`, The
 * Device Build): the graph gateway's and the kernel's routes are requests to
 * the device cell over the native bridge, their paths unchanged and with no
 * address; the platform's Web Crypto answers the clock's neighbours; outbound
 * HTTP goes through Capacitor's native HTTP, which a page's cross-origin rules
 * do not bind. `#host` is the host's own definitions (`calliopa-bootstrap`'s
 * `mobile/host/src/`), resolved when `build:device` runs. CA_0076_001
 */

/**
 * What the two addresses read as: the bridge is where both are, so the
 * frame's "is the gateway configured" reads yes, and no request ever carries
 * an address.
 */
const BRIDGE = "cell:";

const text = new TextDecoder("utf-8", { fatal: true });

function utf8(bytes: Uint8Array): string | null {
  try {
    return text.decode(bytes);
  } catch {
    return null;
  }
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function unbase64(encoded: string): Uint8Array {
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/** The call as the cell reads it: a JSON body as JSON, any other as base64. */
async function cellRequest(
  path: string,
  init: RequestInit | undefined,
): Promise<CellRequest> {
  const request = new Request(new URL(path, "https://cell.invalid"), init);
  const header: Record<string, string> = {};
  request.headers.forEach((value, name) => {
    header[name] = value;
  });
  const bytes = new Uint8Array(await request.arrayBuffer());
  const call: CellRequest = {
    protocol: PROTOCOL,
    method: request.method,
    path,
    header,
  };
  if (bytes.length === 0) return call;
  const body = utf8(bytes);
  if (
    body !== null &&
    /\bjson\b/u.test(request.headers.get("content-type") ?? "")
  ) {
    try {
      return { ...call, body: JSON.parse(body) as unknown };
    } catch {
      // Not JSON after all: carried as the bytes it is.
    }
  }
  return { ...call, bodyBase64: base64(bytes) };
}

const bodiless = new Set([101, 204, 205, 304]);

/** The cell's answer as the response an HTTP client would have read. */
function response(answer: CellResponse): Response {
  const headers = new Headers(answer.header ?? {});
  let body: BodyInit | null = null;
  if (answer.bodyBase64 !== undefined)
    body = unbase64(answer.bodyBase64).slice().buffer as ArrayBuffer;
  else if (typeof answer.body === "string") body = answer.body;
  else if (answer.body !== undefined) body = JSON.stringify(answer.body);
  return new Response(bodiless.has(answer.status) ? null : body, {
    status: answer.status,
    headers,
  });
}

/** One route of the cell; a refusal by the routes is a response, and only the bridge's own error rejects. */
async function bridged(path: string, init?: RequestInit): Promise<Response> {
  const request = await cellRequest(path, init);
  const signal = init?.signal ?? undefined;
  signal?.throwIfAborted();
  const call = Cell.call({ request }).then(({ response: answer }) =>
    response(answer),
  );
  if (signal === undefined) return call;
  // The bridge cannot take a call back; an aborted caller stops waiting.
  return Promise.race([
    call,
    new Promise<never>((_, reject) =>
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      }),
    ),
  ]);
}

/** Outbound HTTP through the platform, out of the page's cross-origin rules. */
async function outbound(url: string, init?: RequestInit): Promise<Response> {
  const request = new Request(url, init);
  const headers: Record<string, string> = {};
  request.headers.forEach((value, name) => {
    headers[name] = value;
  });
  const bytes = new Uint8Array(await request.arrayBuffer());
  const data = bytes.length === 0 ? undefined : utf8(bytes);
  if (data === null) {
    throw new Error(
      "a request from the device carries a text body; this one is binary",
    );
  }
  const answer = await CapacitorHttp.request({
    url: request.url,
    method: request.method,
    headers,
    ...(data === undefined ? {} : { data }),
    responseType: "arraybuffer",
  });
  const answered = new Headers(answer.headers);
  // A JSON answer comes back parsed and any other failure as text; a success
  // that is neither comes back as the base64 of its bytes, as asked.
  const type = answered.get("content-type") ?? "";
  let body: BodyInit | null;
  if (typeof answer.data !== "string") body = JSON.stringify(answer.data);
  else if (
    answer.status >= 200 &&
    answer.status < 300 &&
    !type.includes("json")
  ) {
    body = unbase64(answer.data).slice().buffer as ArrayBuffer;
  } else body = answer.data;
  return new Response(bodiless.has(answer.status) ? null : body, {
    status: answer.status,
    headers: answered,
  });
}

/**
 * A scope in a page, which has no async-local storage: the device's in-page
 * server answers one request at a time (`entry.ts`), so a value set around a
 * call is the request's for as long as the call runs, and a run restores the
 * value it replaced when its call settles. Two runs of one scope racing inside
 * one request are not carried apart.
 */
function scope<T>(): Scope<T> {
  let current: T | undefined;
  return {
    run: async (value, call) => {
      const previous = current;
      current = value;
      try {
        return await call();
      } finally {
        current = previous;
      }
    },
    current: () => current,
  };
}

/** No directory is shared with a service on a device: subscriptions and media sign-in are an instance's. */
const absent: ConfigFiles = {
  read: async () => null,
  exists: async () => false,
  replace: async () => {
    throw new Error(
      "On this device nothing signs in to a subscription or a media service: that is done on a Calliopa instance, and the app uses an API key.",
    );
  },
};

export const port: Port = {
  where: "device",
  online: () => navigator.onLine,
  env: (name: PortEnvName) =>
    name === "CALLIOPA_CCGW_URL" || name === "CALLIOPA_KERNEL_URL"
      ? BRIDGE
      : undefined,
  now: () => new Date(),
  uuid: () => crypto.randomUUID(),
  randomBytes: (size) => crypto.getRandomValues(new Uint8Array(size)),
  sameSecret: (presented, secret) => {
    const left = new TextEncoder().encode(presented);
    const right = new TextEncoder().encode(secret);
    let difference = left.length ^ right.length;
    for (
      let index = 0;
      index < Math.max(left.length, right.length);
      index += 1
    ) {
      difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
    }
    return difference === 0;
  },
  scope,
  config: () => absent,
  gateway: bridged,
  kernel: bridged,
  fetch: outbound,
};
