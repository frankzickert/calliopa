import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../http-error";
import { kernelState } from "../kernel/client";
import { withRequestContext } from "../request-context";
import { attachmentForProcess } from "./attachments";
import { conductRun, runEvents } from "./conductor";

/**
 * The shell's half of per-person runs against the kernel's routes, at the
 * transport boundary as the bridge's own tests are: a process names its
 * person, the kernel's refusals keep their status, a run the kernel does not
 * serve is unknown, and an attachment opens only through a run that carried
 * it. The kernel's filtering is proven in its own suites. BO_0232_006
 * BO_0232_007 BO_0232_008 BO_0232_009
 */

const workspace = "00000000-0000-4000-8000-000000000001";
const processId = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

type Route = (url: string, init: RequestInit) => Response | undefined;

const kernel = (route: Route) => {
  vi.stubEnv("CALLIOPA_CCGW_URL", "http://ccgw.test");
  vi.stubEnv("CALLIOPA_KERNEL_URL", "http://kernel.test");
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const answer = route(url, init);
    if (answer === undefined) throw new Error(`unexpected call ${init.method ?? "GET"} ${url}`);
    return Promise.resolve(answer);
  });
  return calls;
};

const storedWorkspace = { id: workspace, tabs: [], activeTabId: null, layout: { left: "expanded", right: "hidden", dock: "composer" }, createdAt: "2026-09-17T00:00:00Z", updatedAt: "2026-09-17T00:00:00Z" };

describe("a process names its person", () => {
  it("Given a signed-in person's command, Then the process the run gets is written with their account", async () => {
    const written: Record<string, unknown>[] = [];
    kernel((url, init) => {
      if (url === "http://kernel.test/__kernel/session") return json(200, { name: "ann", class: "human", owner: false });
      if (url === "http://kernel.test/__kernel/agent/runs") return json(202, { run: { id: "arun-1", goal: "g", staged: false, pin: 1, status: "running" } });
      if (url === `http://kernel.test/__kernel/state/workspaces/${workspace}`) return json(200, storedWorkspace);
      if (url.startsWith("http://kernel.test/__kernel/state/processes/")) {
        if (init.method === "PUT") {
          const record = JSON.parse(String(init.body)) as Record<string, unknown>;
          written.push(record);
          return json(200, { status: "stored", id: record["id"] });
        }
        return json(200, written.at(-1) ?? {});
      }
      return undefined;
    });
    const started = await withRequestContext("calliopa_session=ann", () => conductRun({ workspaceId: workspace, goal: "summarise", agent: "codex" }));
    expect(started.ok).toBe(true);
    expect(written.length).toBeGreaterThan(0);
    for (const record of written) expect(record["account"]).toBe("ann");
  });

  it("Given no session, Then the process names no account and the kernel keeps it as before", async () => {
    const written: Record<string, unknown>[] = [];
    kernel((url, init) => {
      if (url === "http://kernel.test/__kernel/session") return json(401, { status: "refused" });
      if (url === "http://kernel.test/__kernel/agent/runs") return json(202, { run: { id: "arun-2", goal: "g", staged: false, pin: 1, status: "running" } });
      if (url === `http://kernel.test/__kernel/state/workspaces/${workspace}`) return json(200, storedWorkspace);
      if (url.startsWith("http://kernel.test/__kernel/state/processes/")) {
        if (init.method === "PUT") written.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return json(200, written.at(-1) ?? {});
      }
      return undefined;
    });
    await withRequestContext("calliopa_session=gone", () => conductRun({ workspaceId: workspace, goal: "g", agent: "codex" }));
    expect(written[0]).not.toHaveProperty("account");
  });
});

describe("the kernel's refusals keep what they are", () => {
  it("Given the state record refusing someone else's process, Then the refusal is 403 in the kernel's words", async () => {
    kernel(() => json(403, { status: "refused", diagnostics: [{ code: "forbidden", message: "this process is ann's" }] }));
    const refused = await kernelState.write("processes", { id: processId }).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(HttpError);
    expect((refused as HttpError).status).toBe(403);
    expect((refused as HttpError).message).toBe("this process is ann's");
    expect((refused as HttpError).code).toBe("forbidden");
  });

  it("Given the intake refusing as forbidden or as a conflict, Then the run answers that, in the kernel's words", async () => {
    kernel((url) => (url === "http://kernel.test/__kernel/agent/runs" ? json(403, { error: "not yours" }) : undefined));
    expect(await conductRun({ workspaceId: workspace, goal: "g", agent: "codex" })).toEqual({ ok: false, reason: "forbidden", detail: "not yours" });
    const inactive = "the intention refine belongs to calliopa-refine, which is switched off";
    kernel((url) => (url === "http://kernel.test/__kernel/agent/runs" ? json(409, { error: inactive }) : undefined));
    expect(await conductRun({ workspaceId: workspace, goal: "g", agent: "codex" })).toEqual({ ok: false, reason: "conflict", detail: inactive });
  });

  it("Given events of a run the kernel does not serve this person, Then they are unknown, not an empty list", async () => {
    kernel(() => json(404, { error: "unknown run arun-ann" }));
    expect(await runEvents("arun-ann")).toBeNull();
    kernel(() => new Response("event: end\ndata: {}\n\n", { status: 200, headers: { "content-type": "text/event-stream" } }));
    expect(await runEvents("arun-mine")).toEqual([]);
  });
});

describe("an attachment opens only through its run", () => {
  const attachmentId = "22222222-2222-4222-8222-222222222222";
  const node = {
    id: `node:${attachmentId}`,
    revision: { id: "rev:1", content: { _type: "attachment", filename: "plan.md", mediaType: "text/markdown", file: { _kind: "blob", hash: `sha256:${"a".repeat(64)}` } } },
  };
  const graph = (runAnswer: Response): void => {
    kernel((url) => {
      if (url === `http://kernel.test/__kernel/state/processes/${processId}`) return json(200, { id: processId, runId: "arun-1" });
      if (url === "http://kernel.test/__kernel/agent/runs/arun-1") return runAnswer;
      if (url === "http://ccgw.test/v1/cypher/query") return json(200, { status: "success", result: { roots: [node.id], nodes: [node], relations: [] } });
      return undefined;
    });
  };

  it("Given a run that carried it, Then it is read", async () => {
    graph(json(200, { run: { id: "arun-1", goal: "g", staged: false, pin: 1, status: "completed", attachments: [{ id: node.id, filename: "plan.md", mediaType: "text/markdown", size: 7, delivered: "text" }] } }));
    expect((await attachmentForProcess(processId, attachmentId))?.filename).toBe("plan.md");
  });

  it("Given a run the kernel does not serve this person, a run that did not carry it, or no process, Then it is unknown", async () => {
    graph(json(404, { error: "unknown run arun-1" }));
    expect(await attachmentForProcess(processId, attachmentId)).toBeNull();
    graph(json(200, { run: { id: "arun-1", goal: "g", staged: false, pin: 1, status: "completed", attachments: [] } }));
    expect(await attachmentForProcess(processId, attachmentId)).toBeNull();
    graph(json(200, { run: { id: "arun-1", goal: "g", staged: false, pin: 1, status: "completed" } }));
    expect(await attachmentForProcess("not-a-process", attachmentId)).toBeNull();
  });
});
