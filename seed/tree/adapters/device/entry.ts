import {
  _deserializeData,
  _serializeData,
  _verifySerializable,
} from "@builder.io/qwik";
import { setServerPlatform } from "@builder.io/qwik/server";
import {
  _TextEncoderStream_polyfill,
  mergeHeadersCookies,
  requestHandler,
  type ServerRequestEvent,
} from "@builder.io/qwik-city/middleware/request-handler";
import qwikCityPlan from "@qwik-city-plan";
import { manifest } from "@qwik-client-manifest";

import { Cell, HARNESS_PATH, PROTOCOL } from "#host";

import render from "../../src/entry.ssr";

/**
 * The shell with no server: the same tree's server half runs in the page, and
 * every request the page makes to its own routes — a page's loaders, an
 * action, `/api/…` — is answered here by the same handlers an instance runs,
 * through Qwik City's request handler, with the port answered over the native
 * bridge (`./port.ts`). The page's files are the host's. CA_0076_002
 */

try {
  new globalThis.TextEncoderStream();
} catch {
  globalThis.TextEncoderStream =
    _TextEncoderStream_polyfill as unknown as typeof TextEncoderStream;
}
setServerPlatform(manifest);
const serializer = { _deserializeData, _serializeData, _verifySerializable };
const pageFetch = globalThis.fetch.bind(globalThis);

/** One request at a time, so a scope's value is the request's (`./port.ts`). */
let queue: Promise<unknown> = Promise.resolve();

function serialized<T>(call: () => Promise<T>): Promise<T> {
  const run = queue.then(call, call);
  queue = run.catch(() => undefined);
  return run;
}

/** Answers one request in the page, or null when no route of the tree takes it. */
export function serve(request: Request): Promise<Response | null> {
  return serialized(async () => {
    const url = new URL(request.url);
    const event: ServerRequestEvent<Response> = {
      mode: "server",
      locale: undefined,
      url,
      request,
      env: { get: () => undefined },
      platform: {},
      getClientConn: () => ({}),
      getWritableStream: (status, headers, cookies, resolve) => {
        const { readable, writable } = new TransformStream<Uint8Array>();
        resolve(
          new Response(readable, {
            status,
            headers: mergeHeadersCookies(headers, cookies),
          }),
        );
        return writable;
      },
    };
    const handled = await requestHandler(
      event,
      { render, qwikCityPlan, manifest, checkOrigin: false },
      serializer,
    );
    if (handled === null) return null;
    void handled.completion.then((error) => {
      if (error) console.error(error);
    });
    // An event stream answers at once and keeps writing; the next request
    // waits only for this one's answer.
    return (await handled.response) ?? null;
  });
}

/** The host's files, which build:device lists beside the bundle; the tree answers every other path. */
const FILES = "/device/files.json";

/** Whether the page's own fetch is one the tree answers rather than one of the host's files or the harness. */
function ours(url: URL, files: ReadonlySet<string>): boolean {
  if (url.origin !== location.origin) return false;
  if (url.pathname.startsWith(HARNESS_PATH)) return false;
  return !files.has(url.pathname);
}

function intercept(files: ReadonlySet<string>): void {
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    if (!ours(new URL(request.url), files)) return pageFetch(input, init);
    return (await serve(request)) ?? pageFetch(input, init);
  };
}

/** The cell's refusal, in its words, in place of the shell. */
function refuse(reason: string): void {
  document.open();
  document.write(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Calliopa</title><main style="font: 16px/1.5 system-ui; padding: 24px"><h1>Calliopa cannot open</h1><p></p></main>',
  );
  document.close();
  const paragraph = document.querySelector("p");
  if (paragraph !== null) paragraph.textContent = reason;
}

/**
 * Opens the cell, asks it which bridge protocol it speaks, then renders the
 * address the app was opened at and hands the page to the shell. A mismatch is
 * the cell's refusal, shown as it is.
 */
export async function boot(): Promise<void> {
  try {
    await Cell.open();
    await Cell.call({
      request: { protocol: PROTOCOL, method: "GET", path: "/__cell/owner" },
    });
  } catch (error) {
    refuse(error instanceof Error ? error.message : String(error));
    return;
  }
  const files = new Set((await (await pageFetch(FILES)).json()) as string[]);
  intercept(files);
  let address = location.href;
  for (let hops = 0; hops < 5; hops += 1) {
    const answer = await serve(new Request(address));
    if (answer === null) {
      refuse(`The shell has no page at ${new URL(address).pathname}.`);
      return;
    }
    const next = answer.headers.get("location");
    if (answer.status >= 300 && answer.status < 400 && next !== null) {
      address = new URL(next, address).href;
      history.replaceState(null, "", address);
      continue;
    }
    const html = await answer.text();
    document.open();
    document.write(html);
    document.close();
    return;
  }
  refuse("The shell redirected too often to open.");
}
