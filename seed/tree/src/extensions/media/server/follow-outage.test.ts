import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProcessRecord } from "~/lib/process";
import { follow, type Pace } from "./make";

/**
 * A generation is followed to its end through a kernel that cannot be
 * reached for a while: a poll that finds no kernel is waited past, and
 * whatever else ends the follow fails its process with the job's id instead
 * of leaving it running for good. The kernel here is a real HTTP server
 * holding the process record and the generation routes; tearing a request's
 * socket down is a kernel that does not answer. ME_0003_004
 */

const processId = "22222222-2222-4222-8222-222222222222";
const jobId = "job-7";
const quick: Pace = { patienceMs: 600, betweenMs: 20 };
const work = { processId, jobId, group: "node:media-1", documentId: "doc-1", blockId: "blk-pending" };

let server: Server | undefined;

afterEach(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve) => (server === undefined ? resolve() : server.close(() => resolve())));
  server = undefined;
});

/** A kernel answering the process record, and the job through `job` and its
 * file through `file`, each seeing its request's number from 1. */
async function kernel(
  job: (look: number, request: IncomingMessage, response: ServerResponse) => void,
  file: (request: IncomingMessage, response: ServerResponse) => void,
): Promise<{ record: () => ProcessRecord; steps: () => (string | null)[] }> {
  let record = {
    id: processId,
    workspaceId: "00000000-0000-4000-8000-000000000001",
    title: "a laurel",
    state: "running",
    step: `job ${jobId}`,
    itemId: null,
    error: null,
    createdAt: "2026-10-05T00:00:00Z",
    updatedAt: "2026-10-05T00:00:00Z",
  } as ProcessRecord;
  const steps: (string | null)[] = [];
  let looks = 0;
  server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const url = request.url ?? "";
    if (url === `/__kernel/media/generations/${jobId}`) {
      looks += 1;
      job(looks, request, response);
      return;
    }
    if (url === `/__kernel/media/generations/${jobId}/file`) {
      file(request, response);
      return;
    }
    if (url === `/__kernel/state/processes/${processId}`) {
      if (request.method === "PUT") {
        let body = "";
        request.on("data", (chunk: Buffer) => (body += chunk.toString()));
        request.on("end", () => {
          record = JSON.parse(body) as ProcessRecord;
          steps.push(record.step);
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
  return { record: () => record, steps: () => steps };
}

/** A kernel that does not answer: the connection is gone before a response. */
const unreachable = (request: IncomingMessage) => request.socket.destroy();

const answer = (response: ServerResponse, body: unknown) => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};

describe("a generation followed while the kernel cannot be reached", () => {
  it("Given the first polls finding no kernel and then a finished job, Then the follow goes on to store it", async () => {
    const { record, steps } = await kernel(
      (look, request, response) => (look <= 3 ? unreachable(request) : answer(response, { state: "completed" })),
      (_request, response) => response.writeHead(404).end(),
    );

    await expect(follow(work, quick)).resolves.toBeUndefined();

    // It reached the storing step, so the outage did not end it; the file
    // the stand-in kernel does not have ends it in the storing step's words.
    expect(steps()).toContain("storing what was made");
    expect(record().state).toBe("failed");
    expect(record().error).toBe("the generator made nothing to store");
  });

  it("Given the file's read finding no kernel, Then the process fails in words with the job's id, and the follow settles", async () => {
    const { record } = await kernel(
      (_look, _request, response) => answer(response, { state: "completed" }),
      (request) => unreachable(request),
    );

    await expect(follow(work, quick)).resolves.toBeUndefined();

    expect(record().state).toBe("failed");
    expect(record().error).toContain("the kernel is unreachable");
    expect(record().error).toContain(`(job ${jobId})`);
  });

  it("Given a kernel that never answers within the patience, Then the follow ends with the job collectable by its id", async () => {
    const { record } = await kernel(
      (_look, request) => unreachable(request),
      (request) => unreachable(request),
    );

    // The outage covers the whole patience, so the process is only reachable
    // again for the final move: the record route keeps answering.
    await expect(follow(work, quick)).resolves.toBeUndefined();

    expect(record().state).toBe("failed");
    expect(record().error).toBe(`job ${jobId} did not finish in time; it can be collected by its id`);
  });
});
