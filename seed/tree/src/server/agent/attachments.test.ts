import { afterEach, describe, expect, it, vi } from "vitest";

import type { AttachmentDescriptor } from "~/lib/command-target";
import { withRequestContext } from "../request-context";
import { fileHeaders, uploadAttachment, writeAttachments } from "./attachments";

/**
 * The shell's side of an attachment against the kernel's routes, at the
 * transport boundary: the upload's name and cookie, one node written per file
 * as the person before the run, a lapsed upload refused in words, and the
 * headers a file opens with. The kernel's side is proven in its own suites.
 * BO_0229_008 BO_0229_009 BO_0229_011 BO_0229_013
 */
const hash = `sha256:${"c".repeat(64)}`;
const markdown: AttachmentDescriptor = { hash, size: 7, mediaType: "text/markdown", filename: "plan.md", text: null, textStatus: "text" };
const docx: AttachmentDescriptor = {
  hash: `sha256:${"d".repeat(64)}`,
  size: 2048,
  mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  filename: "Grüße.docx",
  text: { hash: `sha256:${"e".repeat(64)}`, size: 16 },
  textStatus: "extracted",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const kernel = (answer: (url: string, init: RequestInit) => Response) => {
  vi.stubEnv("CALLIOPA_CCGW_URL", "http://ccgw.test");
  vi.stubEnv("CALLIOPA_KERNEL_URL", "http://kernel.test");
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(answer(url, init));
  });
  return calls;
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("uploading a file", () => {
  it("Given a file, Then its name travels percent-encoded with the session's cookie, and the kernel's descriptor comes back", async () => {
    const calls = kernel(() => json(200, docx));
    const uploaded = await withRequestContext("calliopa_session=abc", () =>
      uploadAttachment(new Uint8Array([1, 2, 3]).buffer, "Grüße.docx", ""),
    );
    expect(uploaded).toEqual({ ok: true, descriptor: docx });
    expect(calls[0]?.url).toBe("http://kernel.test/__kernel/attachments");
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers["x-calliopa-filename"]).toBe("Gr%C3%BC%C3%9Fe.docx");
    expect(headers["content-type"]).toBe("application/octet-stream");
    expect(headers["cookie"]).toBe("calliopa_session=abc");
  });

  it("Given a kernel refusal or a file past the bound, Then the refusal is answered in words with its status", async () => {
    kernel(() => json(422, { status: "refused", diagnostics: [{ code: "attachment_unreadable", message: "broken.docx could not be read" }] }));
    expect(await uploadAttachment(new ArrayBuffer(3), "broken.docx", "")).toEqual({ ok: false, status: 422, error: "broken.docx could not be read" });
    const calls = kernel(() => json(200, markdown));
    expect(await uploadAttachment(new ArrayBuffer(10 * 1024 * 1024 + 1), "huge.bin", "")).toEqual({
      ok: false,
      status: 413,
      error: "huge.bin is larger than 10 MB, the most a command can carry per file.",
    });
    expect(calls).toHaveLength(0);
  });
});

describe("writing the attachments of a command", () => {
  it("Given two files, Then one attachment node each is written as the person through the kernel's write verb, and their ids answer", async () => {
    const calls = kernel(() => json(200, { status: "established", dataRevision: 42 }));
    const written = await withRequestContext("calliopa_session=abc", () => writeAttachments([markdown, docx]));
    expect(written.ok).toBe(true);
    const ids = written.ok ? written.ids : [];
    expect(ids).toHaveLength(2);
    expect(calls.map((call) => call.url)).toEqual(["http://kernel.test/__kernel/review/write", "http://kernel.test/__kernel/review/write"]);
    expect((calls[0]?.init.headers as Record<string, string>)["cookie"]).toBe("calliopa_session=abc");
    const bodies = calls.map((call) => JSON.parse(String(call.init.body)) as { statement: string; parameters: Record<string, unknown>; rationale: string });
    expect(bodies[0]?.statement).toBe("CREATE (a:attachment {id: $id, filename: $filename, mediaType: $mediaType, size: $size, file: $file, textStatus: $textStatus, status: \"established\"})");
    expect(bodies[0]?.parameters).toMatchObject({
      filename: "plan.md",
      mediaType: "text/markdown",
      size: 7,
      textStatus: "text",
      file: { _kind: "blob", hash, size: 7, mediaType: "text/markdown", filename: "plan.md" },
    });
    expect(bodies[0]?.parameters).not.toHaveProperty("text");
    expect(ids[0]).toBe(`node:${String(bodies[0]?.parameters["id"])}`);
    expect(bodies[1]?.statement).toContain("text: $text, textStatus: $textStatus");
    expect(bodies[1]?.parameters["text"]).toEqual({ _kind: "blob", hash: `sha256:${"e".repeat(64)}`, size: 16, mediaType: "text/plain; charset=utf-8" });
    expect(bodies[1]?.rationale).toBe("attachment Grüße.docx sent with a command");
  });

  it("Given a file whose upload lapsed, Then the command is refused naming it, and nodes written before it stay", async () => {
    let call = 0;
    const calls = kernel(() => {
      call += 1;
      return call === 1
        ? json(200, { status: "established", dataRevision: 42 })
        : json(409, { status: "refused", diagnostics: [{ code: "dangling_blob_reference", message: `blob reference ${hash} does not resolve to a stored object` }] });
    });
    expect(await writeAttachments([markdown, docx])).toEqual({
      ok: false,
      status: 400,
      error: "Grüße.docx is no longer stored: it was attached too long ago. Attach it again.",
    });
    expect(calls).toHaveLength(2);
  });

  it("Given no files, Then nothing is written", async () => {
    const calls = kernel(() => json(200, {}));
    expect(await writeAttachments([])).toEqual({ ok: true, ids: [] });
    expect(calls).toHaveLength(0);
  });
});

describe("opening an attachment's file", () => {
  it("Given any file, Then it downloads with its type, never sniffed, under an ASCII name and its UTF-8 name", () => {
    expect(fileHeaders({ id: "node:a", filename: 'Grüße "final".html', mediaType: "text/html", fileHash: hash })).toEqual({
      "content-type": "text/html",
      "content-disposition": `attachment; filename="Gr__e _final_.html"; filename*=UTF-8''Gr%C3%BC%C3%9Fe%20%22final%22.html`,
      "x-content-type-options": "nosniff",
    });
  });
});
