import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

/**
 * A stub Bunny Stream library for the behaviour suite that validates what it
 * receives: the `AccessKey` header, the library in the path, a title on the
 * create call, a guid it minted on the upload, bytes that are not empty. It
 * answers the Stream API's shapes — the created video with its `guid`, the
 * upload's `success`, the listing the probe reads — and can be told to
 * refuse the key. PU_0004_006
 */

export const HOST_KEY = "bunny-key-1357";
export const LIBRARY_ID = "512345";

export interface HostSeen {
  readonly method: string;
  readonly path: string;
  readonly title?: string;
  readonly bytes?: number;
}

export interface StubHost {
  /** The library's address, the way the channel's row holds it. */
  readonly address: string;
  readonly seen: HostSeen[];
  readonly videos: Map<string, { title: string; bytes: number }>;
  close: () => Promise<void>;
}

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

export async function startHost(): Promise<StubHost> {
  const seen: HostSeen[] = [];
  const videos = new Map<string, { title: string; bytes: number }>();
  const base = `/library/${LIBRARY_ID}`;
  const server: Server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://host");
    const raw = await readBody(request);
    if (String(request.headers["accesskey"] ?? "") !== HOST_KEY) return json(response, 401, { success: false, message: "Unauthorized", statusCode: 401 });
    if (!url.pathname.startsWith(`${base}/`)) return json(response, 404, { success: false, message: "Not Found", statusCode: 404 });
    const route = url.pathname.slice(base.length);
    if (request.method === "GET" && route === "/videos") {
      seen.push({ method: "GET", path: url.pathname });
      return json(response, 200, { totalItems: videos.size, currentPage: 1, itemsPerPage: 1, items: [...videos.entries()].slice(0, 1).map(([guid, video]) => ({ guid, title: video.title })) });
    }
    if (request.method === "POST" && route === "/videos") {
      const body = raw.length > 0 ? (JSON.parse(raw.toString("utf8")) as { title?: unknown }) : {};
      if (typeof body.title !== "string" || body.title.trim() === "") return json(response, 400, { success: false, message: "title is required", statusCode: 400 });
      const guid = randomUUID();
      videos.set(guid, { title: body.title, bytes: 0 });
      seen.push({ method: "POST", path: url.pathname, title: body.title });
      return json(response, 200, { videoLibraryId: Number(LIBRARY_ID), guid, title: body.title, status: 0 });
    }
    const match = /^\/videos\/([0-9a-f-]+)$/u.exec(route);
    if (match !== null && request.method === "PUT") {
      const guid = match[1] as string;
      const video = videos.get(guid);
      if (video === undefined) return json(response, 404, { success: false, message: "Video not found", statusCode: 404 });
      if (raw.length === 0) return json(response, 400, { success: false, message: "empty upload", statusCode: 400 });
      video.bytes = raw.length;
      seen.push({ method: "PUT", path: url.pathname, bytes: raw.length });
      return json(response, 200, { success: true, message: "OK", statusCode: 200 });
    }
    if (match !== null && request.method === "DELETE") {
      const guid = match[1] as string;
      if (!videos.has(guid)) return json(response, 404, { success: false, message: "Video not found", statusCode: 404 });
      videos.delete(guid);
      seen.push({ method: "DELETE", path: url.pathname });
      return json(response, 200, { success: true, message: "OK", statusCode: 200 });
    }
    return json(response, 404, { success: false, message: "Not Found", statusCode: 404 });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const bound = server.address();
  const address = typeof bound === "object" && bound !== null ? `http://127.0.0.1:${bound.port}${base}` : "";
  return { address, seen, videos, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}
