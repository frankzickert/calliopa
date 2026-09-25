import { afterAll, describe, expect, it } from "vitest";

import { addWork, readWork, retireWork } from "~/extensions/bibliography/server/works";
import { createDocument, fillMediaBlock, insertBlock, readDocument, setFigure, setFrontMatter } from "~/extensions/documents/server/documents";
import { blobHash, blobReference, objectIdOfHash, putBlob, readBlob } from "~/server/ccgw/blobs";
import { readGraphEnv } from "~/server/ccgw/env";
import { commit } from "~/server/ccgw/script";

import { makeManuscript, type Transport } from "../../server/make";
import { listManuscripts, readManuscript } from "../../server/manuscripts";
import { keptForKernel, projectForKernel } from "../../server/tools";

/**
 * A manuscript made and kept over the one graph (`BO_0293_021`): a document
 * with its front matter, an abstract, a heading, a sentence citing a work of
 * the bibliography, a numbered picture and a numbered table, made into an IEEE
 * manuscript by the real typesetting service and kept — the node naming the
 * document, the revision and the venue, and the source, the .bib and the PDF
 * read back from the store. The typesetting is the real service: the case
 * runs when `CALLIOPA_TYPESET_TEST_URL` names one, under the kernel harness
 * that holds the human seat a truth write needs. A service that does not
 * answer is refused in words and keeps nothing, whether or not one is named.
 */
const configured = ((): boolean => {
  try {
    readGraphEnv();
    return true;
  } catch {
    return false;
  }
})();
const service = process.env["CALLIOPA_TYPESET_TEST_URL"];
const bearer = process.env["CALLIOPA_TYPESET_TEST_BEARER"] ?? "";

const ok = <T>(outcome: { outcome: string } & Record<string, unknown>): T => {
  if (outcome["outcome"] !== "success") throw new Error(`expected success, got ${JSON.stringify(outcome)}`);
  return outcome["result"] as T;
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 260));

/** The kernel forward's paths, sent to the service itself with its bearer. */
const direct: Transport = (path, init) =>
  fetch(`${service}${path.replace(/^\/__kernel\/typeset/u, "")}`, { ...init, headers: { ...(init.headers as Record<string, string>), authorization: `Bearer ${bearer}` } });

/** A two-by-two PNG, its chunks and checksums real. */
function png(): Uint8Array {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes: Uint8Array) => {
    let c = 0xffffffff;
    for (const byte of bytes) c = (table[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const u32 = (value: number) => {
    const out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, value);
    return out;
  };
  const chunk = (kind: string, data: Uint8Array) => {
    const body = new Uint8Array([...new TextEncoder().encode(kind), ...data]);
    return new Uint8Array([...u32(data.length), ...body, ...u32(crc(body))]);
  };
  const raw = new Uint8Array([0, 255, 0, 0, 0, 0, 255, 0, 0, 0, 0, 255, 255, 255, 255]);
  let a = 1;
  let b = 0;
  for (const byte of raw) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  const zlib = new Uint8Array([0x78, 0x01, 0x01, raw.length, 0, ~raw.length & 0xff, 0xff, ...raw, b >> 8, b & 0xff, a >> 8, a & 0xff]);
  return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...chunk("IHDR", new Uint8Array([0, 0, 0, 2, 0, 0, 0, 2, 8, 2, 0, 0, 0])), ...chunk("IDAT", zlib), ...chunk("IEND", new Uint8Array())]);
}

describe.skipIf(!configured)("a manuscript over CCGW", () => {
  const works: string[] = [];

  afterAll(async () => {
    for (const workId of works) {
      const current = await readWork(workId);
      if (current.outcome === "success") await retireWork({ workId, baseRevisionId: current.result.revisionId });
    }
  });

  it("refuses in words and keeps nothing when the typesetting service does not answer", async () => {
    const created = ok<{ documentId: string }>(await createDocument({ title: "No service" }));
    const nowhere: Transport = () => Promise.resolve(new Response(JSON.stringify({ error: "the typesetting service is not answering" }), { status: 502 }));
    const refused = await makeManuscript({ documentId: created.documentId, by: "suite", transport: nowhere });
    expect(refused.outcome).toBe("validationFailure");
    expect(JSON.stringify(refused)).toContain("the typesetting service is not answering");
    expect(ok<{ of: string }[]>(await listManuscripts(created.documentId))).toEqual([]);
  });

  it("answers the kernel a run's projection at its pin and composes the kept manuscript as a press writes it", async () => {
    // The run's half (BO_0293_023): the projection the kernel posts to the
    // service, read at the run's pin, and the node the kernel stages from
    // the outcome — the same node a press keeps.
    const created = ok<{ documentId: string }>(await createDocument({ title: "A run's manuscript" }));
    const documentId = created.documentId;
    const head = ok<{ revisionId: string }>(await readDocument(documentId));
    ok(await setFrontMatter({ documentId, baseRevisionId: head.revisionId, frontMatter: { authors: [{ name: "Ada Lovelace" }], affiliations: [], keywords: [], venue: "ieee" } }));
    await settle();
    ok(await insertBlock({ documentId, block: { kind: "text", role: "abstract", runs: [{ text: "A run can make a manuscript." }] }, placement: { at: "end" } }));
    ok(await insertBlock({ documentId, block: { kind: "text", role: "h1", runs: [{ text: "Method" }] }, placement: { at: "end" } }));
    ok(await insertBlock({ documentId, block: { kind: "video" }, placement: { at: "end" } }));
    const picture = ok<{ blockId: string; revisionId: string }>(await insertBlock({ documentId, block: { kind: "image" }, placement: { at: "end" } }));
    await settle();
    const bytes = png();
    const stored = ok<{ hash: string; size: number }>(await putBlob(bytes));
    ok(
      await fillMediaBlock({ documentId, blockId: picture.blockId, baseRevisionId: picture.revisionId, reference: blobReference(objectIdOfHash(stored.hash) as string, "image/png", stored.size), width: 2, height: 2 }),
    );
    await settle();
    const pinned = ok<{ dataRevision?: number }>(await readDocument(documentId));
    const pin = pinned.dataRevision ?? 0;
    expect(pin).toBeGreaterThan(0);
    // The document moves on after the pin; the run's projection does not.
    ok(await insertBlock({ documentId, block: { kind: "text", role: "h1", runs: [{ text: "Later" }] }, placement: { at: "end" } }));
    await settle();

    const run = { id: "arun-test", group: "node:run-test", pin, person: "ann", principal: "claude" };
    const projected = await projectForKernel({ input: { document: documentId }, run });
    expect(projected).toMatchObject({ document: documentId, title: "A run's manuscript", venue: "ieee", revision: pin });
    expect(projected.request.venue).toBe("ieee");
    expect(JSON.stringify(projected.request.ast)).toContain("Method");
    expect(JSON.stringify(projected.request.ast)).not.toContain("Later");
    expect(projected.omitted.join(" ")).toMatch(/video/u);
    expect(Object.keys(projected.request.files)).toEqual([`figure-${picture.blockId}.png`]);
    expect(projected.figures).toEqual([{ ...blobReference(objectIdOfHash(stored.hash) as string, "image/png", bytes.byteLength), filename: `figure-${picture.blockId}.png` }]);
    expect((await projectForKernel({ input: { document: documentId, venue: "generic" }, run })).venue).toBe("generic");

    const source = ok<{ hash: string; size: number }>(await putBlob(new TextEncoder().encode("\\documentclass{article}")));
    const kept = keptForKernel({
      input: {
        document: documentId,
        title: projected.title,
        venue: projected.venue,
        revision: projected.revision,
        outcome: "failed",
        log: ["! Undefined control sequence."],
        omitted: projected.omitted,
        files: [{ ...blobReference(objectIdOfHash(source.hash) as string, "text/x-tex", source.size), filename: "manuscript.tex" }],
        figures: projected.figures,
      },
      run,
    });
    const [write] = kept.stage ?? [];
    expect(write).toBeDefined();
    expect(write?.statement).not.toContain("status");
    // The kernel stages this into the run's group; here it is written as
    // the acceptance would establish it, so the node reads back.
    const written = ok<{ manuscriptId: string }>(
      await commit(`${write?.statement.slice(0, -2) ?? ""}, status: "established"})`, write?.parameters ?? {}, "a run's manuscript, kept", async () => ({ manuscriptId: (kept.result as { manuscriptId: string }).manuscriptId })),
    );
    const read = ok<{ of: string; venue: string; revision: number; by: string; outcome: string; files: { filename: string }[]; omitted: string[] }>(await readManuscript(written.manuscriptId));
    expect(read).toMatchObject({ of: documentId, venue: "ieee", revision: pin, by: "claude", outcome: "failed" });
    expect(read.files.map((file) => file.filename)).toEqual(["manuscript.tex", `figure-${picture.blockId}.png`]);
    expect(read.omitted.join(" ")).toMatch(/video/u);
    expect(ok<{ manuscriptId: string }[]>(await listManuscripts(documentId)).map((entry) => entry.manuscriptId)).toContain(written.manuscriptId);
  });

  it.skipIf(service === undefined)("makes an IEEE manuscript by the real service and keeps it with its files", async () => {
    // No hyphenated CSL field: the bibliography's addWork cannot write one yet
    // (its backtick-quoted keys do not parse), which its own suite reports.
    const work = ok<{ workId: string }>(
      await addWork({ record: { title: "On records", kind: "article-journal", DOI: `10.9999/bo0293-${Date.now()}`, author: [{ family: "Smith", given: "Anna" }] } }),
    );
    works.push(work.workId);
    const created = ok<{ documentId: string }>(await createDocument({ title: "A Manuscript Out Of The Record" }));
    const documentId = created.documentId;
    const head = ok<{ revisionId: string }>(await readDocument(documentId));
    ok(
      await setFrontMatter({
        documentId,
        baseRevisionId: head.revisionId,
        frontMatter: { authors: [{ name: "Ada Lovelace", affiliations: [0], corresponding: true }], affiliations: ["Analytical Engines Ltd"], keywords: ["provenance"], venue: "ieee" },
      }),
    );
    await settle();
    ok(await insertBlock({ documentId, block: { kind: "text", role: "abstract", runs: [{ text: "We show that a record can emit a paper." }] }, placement: { at: "end" } }));
    ok(await insertBlock({ documentId, block: { kind: "text", role: "h1", runs: [{ text: "Introduction" }] }, placement: { at: "end" } }));
    const picture = ok<{ blockId: string; revisionId: string }>(await insertBlock({ documentId, block: { kind: "image" }, placement: { at: "end" } }));
    const table = ok<{ blockId: string; revisionId: string }>(
      await insertBlock({ documentId, block: { kind: "table", columns: [{ name: "x", type: "number" }], rows: [["1"]], caption: "Readings" }, placement: { at: "end" } }),
    );
    ok(
      await insertBlock({
        documentId,
        block: { kind: "text", runs: [{ text: "Prior work " }, { text: "", cite: { work: work.workId } }, { text: " shows it; see " }, { text: "", figureRef: picture.blockId }, { text: "." }] },
        placement: { at: "end" },
      }),
    );
    await settle();
    const bytes = png();
    const stored = ok<{ hash: string; size: number }>(await putBlob(bytes));
    const filled = ok<{ revisionId: string }>(
      await fillMediaBlock({ documentId, blockId: picture.blockId, baseRevisionId: picture.revisionId, reference: blobReference(objectIdOfHash(stored.hash) as string, "image/png", stored.size), width: 2, height: 2 }),
    );
    await settle();
    ok(await setFigure({ documentId, blockId: picture.blockId, baseRevisionId: filled.revisionId, caption: "The apparatus", numbered: true }));
    ok(await setFigure({ documentId, blockId: table.blockId, baseRevisionId: table.revisionId, numbered: true }));
    await settle();
    const read = ok<{ dataRevision?: number }>(await readDocument(documentId));

    const made = ok<{ manuscriptId: string; outcome: string }>(await makeManuscript({ documentId, by: "suite", transport: direct }));
    expect(made.outcome).toBe("ok");

    const kept = ok<{ of: string; venue: string; revision: number; by: string; outcome: string; files: { filename: string; objectId: string; mediaType: string }[]; omitted: string[] }>(
      await readManuscript(made.manuscriptId),
    );
    expect(kept).toMatchObject({ of: documentId, venue: "ieee", by: "suite", outcome: "ok" });
    expect(kept.revision).toBe(read.dataRevision);
    expect(kept.files.map((file) => file.filename).sort()).toEqual([`figure-${picture.blockId}.png`, "manuscript.pdf", "manuscript.tex", "references.bib"]);
    const pdf = kept.files.find((file) => file.filename === "manuscript.pdf");
    expect(new TextDecoder().decode((await readBlob(blobHash(pdf?.objectId ?? ""))).subarray(0, 4))).toBe("%PDF");
    const tex = new TextDecoder().decode(await readBlob(blobHash(kept.files.find((file) => file.filename === "manuscript.tex")?.objectId ?? "")));
    expect(tex).toContain("\\documentclass[conference]{IEEEtran}");
    expect(tex).toContain(`\\label{fig:${picture.blockId}}`);
    expect(tex).toContain(`\\citep{${work.workId}}`);
    expect(ok<{ manuscriptId: string }[]>(await listManuscripts(documentId)).map((entry) => entry.manuscriptId)).toEqual([made.manuscriptId]);
  });
});
