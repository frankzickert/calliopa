import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProcessRecord } from "~/lib/process";
import { ABANDONED_RUN_ERROR, followRun, type FollowTiming } from "./conductor";

/**
 * Following a run survives its stream breaking: the follower reconnects, the
 * bridge's replay brings the end that came meanwhile, and only reconnects
 * that keep failing past the bound give the run up as abandoned. The kernel
 * here is a real HTTP server holding the process record and the run's stream;
 * the timing is shortened so the suite need not wait out minutes. CA_0080_002
 */

const processId = "11111111-1111-4111-8111-111111111111";
const runId = "arun-1";
const quick: FollowTiming = { delays: [10, 20], every: 30, bound: 400 };

const frame = (type: string, extra: Record<string, unknown> = {}) =>
  `event: ${type}\ndata: ${JSON.stringify({ type, at: 1, ...extra })}\n\n`;

let server: Server | undefined;

afterEach(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve) => (server === undefined ? resolve() : server.close(() => resolve())));
  server = undefined;
});

/** A kernel answering the process record and the run, and serving its stream
 * through `events`, which sees each connection's number from 1. */
async function kernel(events: (connection: number, response: ServerResponse) => void, status: string): Promise<{ record: () => ProcessRecord }> {
  let record: ProcessRecord = {
    id: processId,
    workspaceId: "00000000-0000-4000-8000-000000000001",
    title: "summarise",
    state: "queued",
    step: null,
    itemId: null,
    error: null,
    createdAt: "2026-10-05T00:00:00Z",
    updatedAt: "2026-10-05T00:00:00Z",
  } as ProcessRecord;
  let connections = 0;
  server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const url = request.url ?? "";
    if (url === `/__kernel/agent/runs/${runId}/events`) {
      connections += 1;
      events(connections, response);
      return;
    }
    if (url === `/__kernel/agent/runs/${runId}`) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ run: { id: runId, goal: "g", staged: false, pin: 1, status } }));
      return;
    }
    if (url === `/__kernel/state/processes/${processId}`) {
      if (request.method === "PUT") {
        let body = "";
        request.on("data", (chunk: Buffer) => (body += chunk.toString()));
        request.on("end", () => {
          record = JSON.parse(body) as ProcessRecord;
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ status: "stored", id: processId }));
        });
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(record));
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  vi.stubEnv("CALLIOPA_CCGW_URL", "http://127.0.0.1:1");
  vi.stubEnv("CALLIOPA_KERNEL_URL", `http://127.0.0.1:${port}`);
  return { record: () => record };
}

/** Writes the frames, then breaks the connection under the reader. */
const cutAfter = (response: ServerResponse, frames: string) => {
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.write(frames, () => setTimeout(() => response.socket?.destroy(), 10));
};

describe("a run whose stream breaks while it works", () => {
  it("Given the stream cut mid-run and a reconnect replaying the run's end, Then the process ends completed, not failed", async () => {
    const { record } = await kernel((connection, response) => {
      if (connection === 1) {
        cutAfter(response, frame("run.started") + frame("tool.started", { tool: "read_document" }));
        return;
      }
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end(frame("run.started") + frame("tool.started", { tool: "read_document" }) + frame("run.completed") + "event: end\ndata: {}\n\n");
    }, "completed");

    await followRun(processId, runId, quick);

    expect(record().state).toBe("completed");
    expect(record().error).toBeNull();
  });

  it("Given every reconnect failing past the bound, Then the process takes the abandoned outcome, and the follow settles without throwing", async () => {
    let connections = 0;
    const { record } = await kernel((connection, response) => {
      connections = connection;
      if (connection === 1) {
        cutAfter(response, frame("run.started"));
        return;
      }
      response.socket?.destroy();
    }, "running");

    await expect(followRun(processId, runId, quick)).resolves.toBeUndefined();

    expect(record().state).toBe("failed");
    expect(record().error).toBe(ABANDONED_RUN_ERROR);
    expect(connections).toBeGreaterThan(2);
  });
});
