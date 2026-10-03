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

import { Capture, Cell, HARNESS_PATH, PROTOCOL } from "#host";

import render from "../../src/entry.ssr";
import { KERNEL_CALLBACK_HEADER } from "../../src/server/kernel-callback";

import { lockOnReturn, unlock } from "./lock";
import { callbackSecret, port } from "./port";

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
    const url = new URL(request.url);
    if (!ours(url, files)) return pageFetch(input, init);
    // What the page asks the kernel itself — a code block's run, which
    // streams and so goes to the kernel directly, as on an instance — is the
    // cell's, which presents the owner's credential. BO_0319_046
    if (url.pathname.startsWith("/__kernel/")) {
      const bodiless = request.method === "GET" || request.method === "HEAD";
      return port.kernel(url.pathname + url.search, {
        method: request.method,
        headers: request.headers,
        ...(bodiless ? {} : { body: await request.arrayBuffer() }),
      });
    }
    return (await serve(request)) ?? pageFetch(input, init);
  };
}

interface PendingMigration {
  readonly id: string;
  readonly extension: string;
  readonly route: string;
  readonly pin: number;
  readonly settings?: Readonly<Record<string, unknown>>;
}

/**
 * The extensions' migrations this device has not applied, run before the
 * shell is rendered, as an instance runs them before it serves a pin: the
 * cell lists them in order, each route is answered here in the page as the
 * kernel's callback — the server half runs here — and the statement it
 * answers goes back to the cell, which writes it as the owner's truth
 * (`calliopa-bootstrap`'s BO_0319_053). Answers why it stopped, or null.
 */
async function migrate(): Promise<string | null> {
  const listed = await port.kernel("/__kernel/migrations");
  if (listed.status === 401) return null;
  if (!listed.ok)
    return `the migrations could not be read: ${listed.status} ${await listed.text()}`;
  const { pending } = (await listed.json()) as {
    pending: readonly PendingMigration[];
  };
  for (const migration of pending) {
    const answered = await serve(
      new Request(
        `${location.origin}/api/x/${migration.extension}/${migration.route}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            [KERNEL_CALLBACK_HEADER]: callbackSecret,
          },
          body: JSON.stringify({
            pin: migration.pin,
            migration: migration.id,
            ...(migration.settings === undefined
              ? {}
              : { settings: migration.settings }),
          }),
        },
      ),
    );
    if (answered === null || !answered.ok) {
      const said =
        answered === null
          ? "nothing"
          : `${answered.status} ${await answered.text()}`;
      return `the ${migration.extension} migration ${migration.id} answered ${said}`;
    }
    const { statement, parameters } = (await answered.json()) as {
      statement?: string;
      parameters?: Record<string, unknown>;
    };
    const applied = await port.kernel("/__kernel/migrations/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: migration.id,
        statement: statement ?? "",
        parameters: parameters ?? {},
      }),
    });
    if (!applied.ok)
      return `the ${migration.extension} migration ${migration.id} was refused: ${await applied.text()}`;
  }
  return null;
}

/** Whether the owner has the app lock on, read in the page; never asks the person. BO_0319_048 */
async function locked(): Promise<boolean> {
  const answer = await serve(new Request(`${location.origin}/api/x/settings/lock/on`)).catch(() => null);
  if (answer === null || !answer.ok) return false;
  return ((await answer.json()) as { on?: boolean }).on === true;
}

/**
 * An element's own load — an image's `src` — is no fetch of the page's, so
 * it would go to the network, where nothing answers the tree's routes on a
 * device. Every image naming one of them is served here instead, as an
 * object URL of what the route answered, each address once. Registered
 * after the shell is written: the document it observes is the one written.
 * CA_0076_002 BO_0319_050
 */
function serveImages(files: ReadonlySet<string>): void {
  const served = new Map<string, Promise<string | null>>();
  const load = (image: HTMLImageElement) => {
    const named = image.getAttribute("src");
    if (named === null || named.startsWith("blob:")) return;
    const url = new URL(named, location.href);
    if (!ours(url, files)) return;
    let answer = served.get(url.href);
    if (answer === undefined) {
      answer = serve(new Request(url.href)).then(async (response) =>
        response !== null && response.ok ? URL.createObjectURL(await response.blob()) : null,
      );
      served.set(url.href, answer);
    }
    void answer.then((object) => {
      if (object === null || image.getAttribute("src") !== named) return;
      image.setAttribute("src", object);
    });
  };
  const sweep = (root: ParentNode) => root.querySelectorAll("img[src]").forEach((image) => load(image as HTMLImageElement));
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes" && record.target instanceof HTMLImageElement) load(record.target);
      for (const node of record.addedNodes) {
        if (node instanceof HTMLImageElement) load(node);
        else if (node instanceof Element) sweep(node);
      }
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["src"] });
  sweep(document);
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
  // Something shared into the app while the page runs is the shell's to
  // take: it is told, and asks (`ui.shell`'s capture/shared). The shell
  // also asks at its start, so a share that opened the app waits for it. A
  // host that cannot share tells nothing. BO_0319_050
  try {
    void Capture.addListener("shared", () => {
      window.dispatchEvent(new Event("calliopa:shared"));
    }).catch(() => undefined);
  } catch {
    // No capture plugin on this host.
  }
  // A migration that fails stays pending and is tried again at the next
  // start; the shell is served meanwhile, as an instance serves its pin.
  const stopped = await migrate();
  if (stopped !== null) console.error(`Calliopa: ${stopped}`);
  // With the lock on, nothing of the shell shows before the person is
  // confirmed. BO_0319_048
  if (await locked()) await unlock();
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
    serveImages(files);
    lockOnReturn(locked);
    return;
  }
  refuse("The shell redirected too often to open.");
}
