import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { addWork } from "~/extensions/bibliography/server/works";
import { MIGRATIONS as ROLE_MIGRATIONS } from "~/extensions/doc-block-roles/server/migrations";
import { createRole, readRole, reviseRole, rolesOf, setRole, setValues } from "~/extensions/doc-block-roles/server/roles";
import type { RoleView } from "~/extensions/doc-block-roles/lib/roles";
import { createDocument, deleteDocument, fillMediaBlock, insertBlock, readDocument, setFigure } from "~/extensions/documents/server/documents";
import { blobHash, blobReference, objectIdOfHash, putBlob, readBlob } from "~/server/ccgw/blobs";
import { query, write } from "~/server/ccgw/client";
import { readGraphEnv } from "~/server/ccgw/env";
import { nodeRef } from "~/server/ccgw/nodes";
import { commit } from "~/server/ccgw/script";

import { renditionWrite } from "../../server/make";
import { MIGRATIONS } from "../../server/migrations";
import { listRenditions, readRendition } from "../../server/renditions";
import { keptForKernel, projectForKernel } from "../../server/tools";

/**
 * Manuscripts as formats over the one graph (`calliopa-bootstrap`'s
 * `BO_0312_025`, `BO_0332_033`): a document carrying *Format* (PDF), a
 * venue role and *Paper* read by field key into a run's projection of its
 * whole reading order at its pin, and the refusals in words — a document with
 * no *Format*, *Format* that is not a PDF, a role the document does not carry,
 * *Format* on a block; the kept rendition composed for the kernel, read back
 * on its document beside one kept on a block before; a real IEEE manuscript by the typesetting service when
 * `CALLIOPA_TYPESET_TEST_URL` names one; and the formats migration retiring
 * the kept manuscripts and moving front matter to *Paper*. Runs under the
 * kernel harness that holds the human seat a truth write needs.
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

const settle = () => new Promise((resolve) => setTimeout(resolve, 350));

const refusedAs = (outcome: { outcome: string } & Record<string, unknown>): string =>
  outcome["outcome"] === "validationFailure" ? ((outcome["failures"] as { rule: string }[])[0]?.rule ?? "") : outcome["outcome"];

/** A write to a built-in another suite may have written a moment ago, tried
 * again past the kernel's per-node floor. */
const retried = async <T extends { outcome: string } & Record<string, unknown>>(act: () => Promise<T>): Promise<T> => {
  for (let attempt = 0; ; attempt++) {
    const outcome = await act();
    if (attempt >= 5 || refusedAs(outcome) !== "write_too_frequent") return outcome;
    await settle();
  }
};

/** The built-ins and Format's fields, as the pin's migrations make them. */
async function builtins(): Promise<void> {
  for (const name of ["builtin-roles", "format-fields"]) {
    const statement = ok<{ statement: string; parameters: Record<string, unknown> }>(await ROLE_MIGRATIONS[name]!());
    if (statement.statement !== "") await retried(() => write(statement.statement, statement.parameters, name) as never);
    await settle();
  }
}

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

describe.skipIf(!configured)("manuscripts as formats over CCGW", () => {
  const works: string[] = [];
  let venue: RoleView;
  let paper: RoleView;

  beforeAll(async () => {
    await builtins();
    venue = ok<RoleView>(await createRole({ name: "IEEE conference" }));
    paper = ok<RoleView>(await createRole({ name: "Paper under test" }));
    await settle();
    venue = ok<RoleView>(await reviseRole(venue.id, { command: "addField", name: "Template", type: "text" }));
    paper = ok<RoleView>(await reviseRole(paper.id, { command: "addField", name: "Authors", type: "longText" }));
    await settle();
    venue = ok<RoleView>(await reviseRole(venue.id, { command: "addField", name: "Citation style", type: "text" }));
    paper = ok<RoleView>(await reviseRole(paper.id, { command: "addField", name: "Keywords", type: "text" }));
    expect(venue.fields.map((field) => field.key)).toEqual(["template", "citationStyle"]);
    expect(paper.fields.map((field) => field.key)).toEqual(["authors", "keywords"]);
  });

  afterAll(async () => {
    for (const workId of works) {
      // A source is a document (BO_0313), deleted as one.
      const current = await readDocument(workId);
      if (current.outcome === "success") await deleteDocument({ documentId: workId, baseRevisionId: current.result.revisionId });
    }
  });

  /** A document carrying Format (PDF), the venue and the paper — Format is
   * taken by documents alone (BO_0332). */
  async function formatted(title: string): Promise<{ documentId: string; blockId: string }> {
    const created = ok<{ documentId: string; blockId: string }>(await createDocument({ title }));
    await settle();
    ok(await setRole({ documentId: created.documentId, role: "builtin:format", taken: true }));
    await settle();
    ok(await setValues({ documentId: created.documentId, role: "builtin:format", values: { type: "PDF" } }));
    ok(await setRole({ documentId: created.documentId, role: venue.id, taken: true }));
    await settle();
    ok(await setValues({ documentId: created.documentId, role: venue.id, values: { template: "ieee" } }));
    ok(await setRole({ documentId: created.documentId, role: paper.id, taken: true }));
    await settle();
    ok(await setValues({ documentId: created.documentId, role: paper.id, values: { authors: "Ada Lovelace <ada@example.org>", keywords: "provenance, records" } }));
    await settle();
    return created;
  }

  it("answers the kernel a whole document's projection at its pin with the venue and the paper read by key, and refuses in words what it cannot make", async () => {
    const { documentId, blockId } = await formatted("A run's manuscript");
    ok(await insertBlock({ documentId, block: { kind: "text", role: "abstract", runs: [{ text: "A run can make a manuscript." }] }, placement: { at: "end" } }));
    await settle();
    const pin = ok<{ dataRevision?: number }>(await readDocument(documentId)).dataRevision ?? 0;
    expect(pin).toBeGreaterThan(0);
    const run = { id: "arun-test", group: "node:run-test", pin, person: "ann", principal: "claude" };

    // A block named, as a run that read the old tool might, is not read: the
    // document is projected whole. BO_0332_030
    const projected = await projectForKernel({ input: { document: documentId, block: blockId, venueRole: venue.id, paperRole: paper.id }, run });
    expect(projected).toMatchObject({ document: documentId, venue: "ieee", revision: pin });
    expect(projected).not.toHaveProperty("block");
    expect(projected.request.venue).toBe("ieee");
    expect(projected.read).toEqual(["type", "template", "authors", "keywords"]);
    expect(projected.missing).toEqual(["citationStyle", "affiliations"]);
    const head = JSON.stringify((projected.request.ast as { meta: unknown }).meta);
    expect(head).toContain("Lovelace");
    expect(head).toContain("ada@example.org");
    expect(head).toContain("records");
    // The whole reading order is projected: the abstract at its end reaches the head.
    expect(head).toContain('"abstract"');
    expect(head).toContain('"manuscript."');

    // Format is never taken on a block, so a block never carries it.
    expect(refusedAs(await setRole({ documentId, blockId, role: "builtin:format", taken: true }))).toBe("blockNotAllowed");
    const bare = ok<{ documentId: string }>(await createDocument({ title: "No Format here" }));
    await settle();
    await expect(projectForKernel({ input: { document: bare.documentId }, run: { ...run, pin: 0 } })).rejects.toThrow(/carries no Format role/u);
    await expect(projectForKernel({ input: { document: documentId, venueRole: "builtin:keyword" }, run })).rejects.toThrow(/not taken on the document/u);
    ok(await setValues({ documentId, role: "builtin:format", values: { type: "image" } }));
    await settle();
    await expect(projectForKernel({ input: { document: documentId }, run: { ...run, pin: 0 } })).rejects.toThrow(/Format as image, not PDF/u);

    const source = ok<{ hash: string; size: number }>(await putBlob(new TextEncoder().encode("\\documentclass{article}")));
    const kept = keptForKernel({
      input: {
        document: documentId,
        type: "pdf",
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
    const [staged] = kept.stage ?? [];
    expect(staged?.statement).not.toContain("status");
    // The kernel stages this into the run's group; here it is written as
    // the acceptance would establish it, so the node reads back.
    const renditionId = (kept.result as { renditionId: string }).renditionId;
    ok(await commit(`${staged?.statement.slice(0, -2) ?? ""}, status: "established"})`, staged?.parameters ?? {}, "a run's rendition, kept", async () => ({ renditionId })));
    const read = ok<{ of: string; document: string; type: string; venue: string; by: string; outcome: string; files: { filename: string }[] }>(await readRendition(renditionId));
    expect(read).toMatchObject({ of: documentId, document: documentId, type: "pdf", venue: "ieee", by: "claude", outcome: "failed" });
    expect(read.files.map((file) => file.filename)).toEqual(["manuscript.tex"]);

    // A rendition kept on a block before BO_0332 keeps its of and is listed
    // with the document's own, since no block draws one any more.
    await settle();
    const earlier = renditionWrite({
      renditionId: randomUUID(),
      of: blockId,
      documentId,
      type: "pdf",
      title: projected.title,
      revision: projected.revision,
      venue: "ieee",
      files: [{ ...blobReference(objectIdOfHash(source.hash) as string, "text/x-tex", source.size), filename: "manuscript.tex" }],
      made: "2026-09-30T10:00:00.000Z",
      by: "claude",
      outcome: "ok",
      log: [],
      omitted: [],
    });
    ok(await commit(`${earlier.statement.slice(0, -2)}, status: "established"})`, earlier.parameters, "a rendition kept on a block before", async () => undefined));
    expect(ok<{ renditionId: string; of: string }[]>(await listRenditions(documentId)).map((entry) => entry.of)).toEqual([documentId, blockId]);
  }, 30_000);

  it.skipIf(service === undefined)("makes an IEEE manuscript of a whole document by the real service and keeps it on the document", async () => {
    // No hyphenated CSL field: the bibliography's addWork cannot write one yet
    // (its backtick-quoted keys do not parse), which its own suite reports.
    const work = ok<{ workId: string }>(
      await addWork({ record: { title: "On records", kind: "article-journal", DOI: `10.9999/bo0312-${Date.now()}`, author: [{ family: "Smith", given: "Anna" }] } }),
    );
    works.push(work.workId);
    const created = ok<{ documentId: string }>(await createDocument({ title: "A Manuscript Out Of The Record" }));
    const documentId = created.documentId;
    await settle();
    ok(await setRole({ documentId, role: "builtin:format", taken: true }));
    ok(await setRole({ documentId, role: venue.id, taken: true }));
    await settle();
    ok(await setValues({ documentId, role: venue.id, values: { template: "ieee" } }));
    ok(await insertBlock({ documentId, block: { kind: "text", role: "abstract", runs: [{ text: "We show that a record can emit a paper." }] }, placement: { at: "end" } }));
    ok(await insertBlock({ documentId, block: { kind: "text", role: "h1", runs: [{ text: "Introduction" }] }, placement: { at: "end" } }));
    const picture = ok<{ blockId: string; revisionId: string }>(await insertBlock({ documentId, block: { kind: "image" }, placement: { at: "end" } }));
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
    await settle();
    const pin = ok<{ dataRevision?: number }>(await readDocument(documentId)).dataRevision ?? 0;
    const run = { id: "arun-real", group: "node:run-real", pin, person: "ann", principal: "claude" };
    const projected = await projectForKernel({ input: { document: documentId, venueRole: venue.id }, run });
    expect(projected.document).toBe(documentId);

    // What the kernel does between the two routes: the service typesets,
    // and its files are put as blobs.
    const answered = await fetch(`${service}/v1/manuscripts`, {
      method: "POST",
      headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
      body: JSON.stringify(projected.request),
    });
    expect(answered.ok).toBe(true);
    const made = (await answered.json()) as { outcome: string; tex: string; bib?: string; pdf?: string };
    expect(made.outcome).toBe("ok");
    const files: Record<string, unknown>[] = [];
    for (const [bytesOf, mediaType, filename] of [
      [new TextEncoder().encode(made.tex), "text/x-tex", "manuscript.tex"],
      [new TextEncoder().encode(made.bib ?? ""), "text/x-bibtex", "references.bib"],
      [Buffer.from(made.pdf ?? "", "base64"), "application/pdf", "manuscript.pdf"],
    ] as const) {
      const put = ok<{ hash: string; size: number }>(await putBlob(bytesOf));
      files.push({ ...blobReference(objectIdOfHash(put.hash) as string, mediaType, put.size), filename });
    }
    const kept = keptForKernel({
      input: { document: documentId, type: "pdf", title: projected.title, venue: projected.venue, revision: projected.revision, outcome: made.outcome, log: [], omitted: projected.omitted, files, figures: projected.figures },
      run,
    });
    const [staged] = kept.stage ?? [];
    const renditionId = (kept.result as { renditionId: string }).renditionId;
    ok(await commit(`${staged?.statement.slice(0, -2) ?? ""}, status: "established"})`, staged?.parameters ?? {}, "a real rendition, kept", async () => ({ renditionId })));
    const read = ok<{ of: string; files: { filename: string; objectId: string }[] }>(await readRendition(renditionId));
    expect(read.of).toBe(documentId);
    expect(read.files.map((file) => file.filename).sort()).toEqual([`figure-${picture.blockId}.png`, "manuscript.pdf", "manuscript.tex", "references.bib"]);
    const pdf = read.files.find((file) => file.filename === "manuscript.pdf");
    expect(new TextDecoder().decode((await readBlob(blobHash(pdf?.objectId ?? ""))).subarray(0, 4))).toBe("%PDF");
    expect(made.tex).toContain("\\documentclass[conference]{IEEEtran}");
    expect(made.tex).toContain(`\\label{fig:${picture.blockId}}`);
   }, 60_000);

  it("the formats migration retires the kept manuscripts and moves front matter to Paper, once", async () => {
    // The old shapes, written as they stood before BO_0312: a kept
    // manuscript, and a document holding front matter.
    const created = ok<{ documentId: string; revisionId: string }>(await createDocument({ title: "Front matter of before" }));
    await settle();
    const head = ok<{ revisionId: string }>(await readDocument(created.documentId));
    ok(
      await commit(
        "SET d.authors = $authors, d.affiliations = $affiliations, d.keywords = $keywords, d.venue = $venue",
        {
          dNodeId: nodeRef(created.documentId),
          authors: [{ name: "Ada Lovelace", affiliations: [0], corresponding: true }],
          affiliations: ["Analytical Engines Ltd"],
          keywords: ["provenance"],
          venue: "ieee",
        },
        "front matter of before",
        async () => undefined,
      ),
    );
    const manuscriptId = crypto.randomUUID();
    const source = ok<{ hash: string; size: number }>(await putBlob(new TextEncoder().encode("\\documentclass{article}")));
    ok(
      await commit(
        'CREATE (m:manuscript {id: $id, of: $of, revision: 1, venue: "ieee", files: $files, made: "2026-09-25T12:00:00Z", by: "suite", outcome: "ok", status: "established"})',
        { id: manuscriptId, of: created.documentId, files: [{ ...blobReference(objectIdOfHash(source.hash) as string, "text/x-tex", source.size), filename: "manuscript.tex" }] },
        "a manuscript of before",
        async () => undefined,
      ),
    );
    await settle();

    const statement = ok<{ statement: string; parameters: Record<string, unknown> }>(await MIGRATIONS["formats"]!());
    expect(statement.statement).toContain("RETIRE");
    ok(await write(statement.statement, statement.parameters, "manuscripts are formats"));
    await settle();
    expect(ok<{ statement: string }>(await MIGRATIONS["formats"]!()).statement).toBe("");

    expect((await query({ statement: "MATCH (m) RETURN GRAPH m ROOT m", roots: [nodeRef(manuscriptId)], purpose: "verify" })).outcome).toBe("noResult");
    const document = ok<{ revisionId: string }>(await readDocument(created.documentId));
    const node = await query({ statement: "MATCH (d) RETURN GRAPH d ROOT d", roots: [nodeRef(created.documentId)], purpose: "verify" });
    const content = node.outcome === "success" ? (node.result.nodes[0]?.revision.content ?? {}) : {};
    for (const key of ["authors", "affiliations", "keywords", "venue"]) expect(content[key] ?? null).toBeNull();
    expect(document.revisionId).not.toBe(head.revisionId);
    const roles = ok<{ roles: { id: string; name: string; builtin: boolean; values: Record<string, unknown> }[] }>(await rolesOf(created.documentId));
    const taken = roles.roles.find((role) => role.name === "Paper");
    expect(taken).toBeDefined();
    expect(taken?.builtin).toBe(false);
    expect(taken?.values).toEqual({ authors: "Ada Lovelace*", affiliations: "Analytical Engines Ltd", keywords: "provenance" });
    // An ordinary role the person can rename.
    const renamed = ok<RoleView>(await reviseRole(taken?.id ?? "", { command: "rename", name: "Journal paper" }));
    expect(renamed.name).toBe("Journal paper");
    expect(ok<RoleView>(await readRole(taken?.id ?? "")).fields.map((field) => field.key)).toEqual(["authors", "affiliations", "keywords"]);
  });
});
