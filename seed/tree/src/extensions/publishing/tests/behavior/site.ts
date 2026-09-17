import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

/**
 * A stub website for the behaviour suite that validates what it receives
 * against the index it serves — the `ST_0050` lesson: a fake site that
 * stores bodies verbatim proves nothing. It declares and stores media,
 * refuses a document naming media it does not hold, a field of the wrong
 * type, an entry without its object, a reference to a record it does not
 * serve, and answers homepage's envelope; and it can be told to answer HTML,
 * the way a dev server mid-restart does. Its API lives under `/v1`, the way
 * homepage's does, so a path sent at the host's root is a route it does not
 * serve — and its upload path is answered host-absolute, `/v1/media/<sha>`.
 */

export const SITE_BASE = "/v1";

export const SITE_KEY = "site-key-2468";

export const SITE_INDEX = {
  version: 1,
  containers: [
    {
      key: "episodes",
      title: "Episode",
      route: "/episodes/{slug}",
      fields: [
        { key: "title", title: "Title", type: "line", required: true },
        { key: "premise", title: "Premise", type: "line" },
        { key: "home_serial", title: "Home serial", type: "reference", container: "serials" },
        { key: "card_scene", title: "Card scene", type: "entry", slot: "scene" },
      ],
    },
    { key: "serials", title: "Serial", route: "/serials/{slug}", fields: [{ key: "name", title: "Name", type: "line", required: true }] },
  ],
  slots: [
    { key: "scene", title: "Scene", class: "video", container: "episodes", fields: [{ key: "transcript", title: "Transcript", type: "text", required: true }] },
    { key: "still", title: "Still", class: "image", container: "episodes", fields: [{ key: "alt", title: "Alt", type: "line", required: true }] },
    { key: "teaser", title: "Teaser", class: "image", container: "episodes", required: true, maxCount: 1, aspects: ["16:9", "9:16"] },
    { key: "prose", title: "Prose", class: "prose", container: "episodes" },
  ],
  copy: [],
};

export interface Seen {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

export interface StubSite {
  readonly address: string;
  readonly seen: Seen[];
  readonly records: Map<string, unknown>;
  readonly media: Set<string>;
  readonly tombstones: Set<string>;
  html: boolean;
  close: () => Promise<void>;
}

const envelope = (response: ServerResponse, status: number, code: string, message: string, extra: Record<string, unknown> = {}): void => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: { code, message, ...extra } }));
};

const json = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};

function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

type Field = { key: string; type: string; required?: boolean; container?: string; slot?: string; many?: boolean };
type Slot = { key: string; class: string; container: string; required?: boolean; maxCount?: number; aspects?: string[]; fields?: Field[] };

const typeOk = (field: Field, value: unknown): boolean => {
  const one = (candidate: unknown): boolean =>
    field.type === "line" || field.type === "text" || field.type === "date" || field.type === "reference" || field.type === "entry"
      ? typeof candidate === "string"
      : field.type === "flag"
        ? typeof candidate === "boolean"
        : typeof candidate === "number" && Number.isInteger(candidate);
  return field.many ? Array.isArray(value) && value.every(one) : one(value);
};

/** Validates a container document against the index, answering the first rule broken. */
function refusalOf(site: StubSite, containerKey: string, document: unknown): { code: string; message: string; field?: string; rule?: string } | null {
  const container = SITE_INDEX.containers.find((found) => found.key === containerKey);
  if (container === undefined) return { code: "unknown", message: "no such container" };
  const record = typeof document === "object" && document !== null ? (document as { fields?: Record<string, unknown>; slots?: Record<string, unknown[]> }) : {};
  const fields = record.fields ?? {};
  const slots = record.slots ?? {};
  const slotDefs = SITE_INDEX.slots.filter((slot) => slot.container === containerKey) as Slot[];
  const entryIds = new Set<string>();
  for (const key of Object.keys(fields)) {
    if (!container.fields.some((field) => field.key === key)) return { code: "validation", message: `unknown field ${key}`, field: key };
  }
  for (const field of container.fields as Field[]) {
    const value = fields[field.key];
    if (value === undefined) {
      if (field.required) return { code: "validation", message: `${field.key} is required`, field: field.key, rule: "required" };
      continue;
    }
    if (!typeOk(field, value)) return { code: "validation", message: `${field.key} has the wrong type`, field: field.key, rule: "type" };
    if (field.type === "reference") {
      for (const address of Array.isArray(value) ? (value as string[]) : [value as string]) {
        if (!site.records.has(`/${field.container}/${address}`)) return { code: "conflict", message: `${field.container}/${address} is not published`, field: field.key, rule: `${field.container}_must_exist` };
      }
    }
  }
  for (const key of Object.keys(slots)) {
    if (!slotDefs.some((slot) => slot.key === key)) return { code: "validation", message: `unknown slot ${key}`, field: key };
  }
  for (const slot of slotDefs) {
    const entries = (slots[slot.key] ?? []) as Record<string, unknown>[];
    if (slot.required && entries.length === 0) return { code: "validation", message: `${slot.key} is required`, field: slot.key, rule: "required" };
    if (slot.maxCount !== undefined && entries.length > slot.maxCount) return { code: "validation", message: `${slot.key} takes at most ${slot.maxCount}`, field: slot.key };
    for (const entry of entries) {
      if (typeof entry["id"] !== "string") return { code: "validation", message: `${slot.key} entry without id`, field: slot.key };
      entryIds.add(entry["id"]);
      const carriers = ["media", "crops", "host", "document"].filter((key) => entry[key] !== undefined);
      if (carriers.length !== 1) return { code: "validation", message: `${slot.key} entry carries ${carriers.length} of media, crops, host, document`, field: slot.key };
      if (slot.class === "video" && carriers[0] !== "host") return { code: "validation", message: `${slot.key} takes a host id`, field: slot.key };
      if (slot.class === "prose" && carriers[0] !== "document") return { code: "validation", message: `${slot.key} takes a document`, field: slot.key };
      if (slot.class === "image" && slot.aspects !== undefined) {
        const crops = entry["crops"] as Record<string, string> | undefined;
        if (crops === undefined) return { code: "validation", message: `${slot.key} takes crops`, field: slot.key };
        for (const aspect of slot.aspects) {
          if (typeof crops[aspect] !== "string") return { code: "validation", message: `${slot.key} misses ${aspect}`, field: slot.key, rule: "crop" };
          if (!site.media.has(crops[aspect] as string)) return { code: "conflict", message: `media ${crops[aspect]} is not stored`, field: slot.key, rule: "media_must_be_stored" };
        }
      } else if (carriers[0] === "media" && !site.media.has(entry["media"] as string)) {
        return { code: "conflict", message: `media ${String(entry["media"])} is not stored`, field: slot.key, rule: "media_must_be_stored" };
      }
      const entryFields = (entry["fields"] ?? {}) as Record<string, unknown>;
      for (const field of slot.fields ?? []) {
        if (entryFields[field.key] === undefined && field.required) return { code: "validation", message: `${slot.key}.${field.key} is required`, field: `${slot.key}.${field.key}`, rule: "required" };
      }
    }
  }
  for (const field of container.fields as Field[]) {
    if (field.type === "entry" && fields[field.key] !== undefined && !entryIds.has(fields[field.key] as string)) {
      return { code: "validation", message: `${field.key} names no entry`, field: field.key, rule: "entry_must_exist" };
    }
  }
  return null;
}

export async function startSite(): Promise<StubSite> {
  const state = { html: false };
  const seen: Seen[] = [];
  const records = new Map<string, unknown>();
  const media = new Set<string>();
  const tombstones = new Set<string>();
  const server: Server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://site");
    const raw = await readBody(request);
    const authorization = String(request.headers.authorization ?? "");
    if (authorization !== `Bearer ${SITE_KEY}`) return envelope(response, 401, "unauthorized", "A valid key is required.");
    const isJson = (request.headers["content-type"] ?? "").startsWith("application/json");
    const body: unknown = isJson && raw.length > 0 ? JSON.parse(raw.toString("utf8")) : raw.length > 0 ? raw : null;
    seen.push({ method: request.method ?? "", path: url.pathname, body: Buffer.isBuffer(body) ? `<${body.length} bytes>` : body });
    if (state.html) {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<html><body>Restarting</body></html>");
      return;
    }
    if (!url.pathname.startsWith(`${SITE_BASE}/`)) return envelope(response, 404, "unknown", "no such route");
    const route = url.pathname.slice(SITE_BASE.length);
    if (request.method === "GET" && route === "/index") return json(response, 200, SITE_INDEX);
    if (request.method === "POST" && route === "/media") {
      const declared = body as { sha256?: string; mimeType?: string; bytes?: number };
      // Strict, as homepage's declaration is: unknown keys are refused, and the three known ones are required.
      const unknown = Object.keys(declared).filter((key) => !["mimeType", "bytes", "sha256"].includes(key));
      if (unknown.length > 0) return envelope(response, 400, "validation", `Unrecognized keys: ${unknown.map((key) => `"${key}"`).join(", ")}`, { field: unknown.join("."), rule: "unknown_field" });
      if (typeof declared.sha256 !== "string") return envelope(response, 400, "validation", "sha256 is required");
      if (typeof declared.mimeType !== "string" || typeof declared.bytes !== "number") return envelope(response, 400, "validation", "mimeType and bytes are required");
      return json(response, 200, media.has(declared.sha256) ? { mediaId: declared.sha256, exists: true } : { mediaId: declared.sha256, exists: false, upload: `${SITE_BASE}/media/${declared.sha256}` });
    }
    if (request.method === "PUT" && route.startsWith("/media/")) {
      const sha = route.slice("/media/".length);
      const actual = createHash("sha256").update(raw).digest("hex");
      if (actual !== sha) return envelope(response, 400, "validation", "bytes do not hash to their address");
      media.add(sha);
      return json(response, 201, { mediaId: sha });
    }
    const match = /^\/(episodes|serials)\/([a-z0-9-]+)$/u.exec(route);
    if (match !== null && request.method === "PUT") {
      const containerKey = match[1] as string;
      if (tombstones.has(route)) return envelope(response, 410, "tombstone", "retired");
      const wrong = refusalOf({ address: "", seen, records, media, tombstones, html: false, close: async () => {} }, containerKey, body);
      if (wrong !== null) return envelope(response, wrong.code === "conflict" ? 409 : 400, wrong.code, wrong.message, { ...(wrong.field === undefined ? {} : { field: wrong.field }), ...(wrong.rule === undefined ? {} : { rule: wrong.rule }) });
      const created = !records.has(route);
      records.set(route, body);
      return json(response, created ? 201 : 200, { id: match[2], ...(body as object), status: "published" });
    }
    if (match !== null && request.method === "DELETE") {
      if (!records.has(route)) return envelope(response, 404, "unknown", "no such record");
      records.delete(route);
      tombstones.add(route);
      return json(response, 200, { id: match[2], status: "retired" });
    }
    return envelope(response, 404, "unknown", "no such route");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const bound = server.address();
  // The address ends with a slash, the way a person writes one.
  const address = typeof bound === "object" && bound !== null ? `http://127.0.0.1:${bound.port}${SITE_BASE}/` : "";
  const site: StubSite = {
    address,
    seen,
    records,
    media,
    tombstones,
    get html() {
      return state.html;
    },
    set html(value: boolean) {
      state.html = value;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
  return site;
}
