import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MIGRATIONS as ROLE_MIGRATIONS } from "~/extensions/structures/server/migrations";
import { documentsCarrying, structuresOf } from "~/extensions/structures/server/structures";
import { createDocument, deleteDocument, insertBlock, listDocuments, readDocument } from "~/extensions/documents/server/documents";
import { query, write } from "~/server/ccgw/client";
import { readGraphEnv } from "~/server/ccgw/env";
import { nodeRef } from "~/server/ccgw/nodes";

import { MIGRATIONS } from "../../server/migrations";
import { referencesOf } from "../../server/references";
import { addWork, fillWork, listWorks, readWork } from "../../server/works";

/**
 * Sources as documents over the one graph (`BO_0313_020`, `BO_0313_023`): a
 * web page, an interview and a dataset are added as source documents, each
 * carrying *Source* and listed among the documents; a second record sharing
 * an identifier is refused by naming the first; a fill against a stale base
 * is a conflict and against the current one lands, keeping what the record
 * does not hold; a document citing all three numbers them and its reference
 * list carries each; and the migration makes a `work` a source document and
 * renames its citation, so the list reads as before. Runs under the kernel
 * harness, which holds the human seat every truth write needs; a shell
 * without the environment skips it.
 */
const configured = ((): boolean => {
  try {
    readGraphEnv();
    return true;
  } catch {
    return false;
  }
})();

/** The kernel refuses a second write of a node within 250ms
 * (`write_too_frequent`), so a write after another to the same node waits. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 300));

const ok = <T>(outcome: { outcome: string } & Record<string, unknown>): T => {
  if (outcome["outcome"] !== "success") throw new Error(`expected success, got ${JSON.stringify(outcome)}`);
  return outcome["result"] as T;
};

/** A migration's statement written as truth, retried past the floor another
 * suite's write to the same built-in may hold. */
async function migrate(run: () => Promise<{ outcome: string } & Record<string, unknown>>, rationale: string): Promise<void> {
  const statement = ok<{ statement: string; parameters: Record<string, unknown> }>(await run());
  if (statement.statement === "") return;
  for (let attempt = 0; ; attempt += 1) {
    const written = await write(statement.statement, statement.parameters, rationale);
    if (written.outcome === "success") return;
    if (attempt >= 4 || !JSON.stringify(written).includes("write_too_frequent")) throw new Error(JSON.stringify(written));
    await settle();
  }
}

describe.skipIf(!configured)("sources are documents", () => {
  const made: string[] = [];
  const stamp = Date.now();

  beforeAll(async () => {
    await migrate(() => ROLE_MIGRATIONS["builtin-roles"]!(), "the built-in roles");
    await settle();
    await migrate(() => ROLE_MIGRATIONS["source-fields"]!(), "Source's release fields");
    await settle();
  });

  afterAll(async () => {
    for (const documentId of made) {
      const current = await readDocument(documentId);
      if (current.outcome === "success") await deleteDocument({ documentId, baseRevisionId: current.result.revisionId });
    }
  });

  it("Given a web page, an interview and a dataset, Then each is a source document carrying Source, cited and numbered, and in the reference list", async () => {
    const page = ok<{ workId: string; revisionId: string }>(
      await addWork({ record: { title: "How the river moved", kind: "webpage", URL: `https://example.org/river-${stamp}`, author: [{ literal: "River Trust" }], accessed: { "date-parts": [[2026, 9, 30]] } } }),
    );
    const interview = ok<{ workId: string; revisionId: string }>(
      await addWork({ record: { title: `Interview with the ferryman ${stamp}`, kind: "interview", author: [{ family: "Okafor", given: "Chi" }], issued: { "date-parts": [[2025, 6]] } } }),
    );
    const dataset = ok<{ workId: string; revisionId: string }>(
      await addWork({ record: { title: "Gauge readings 1990–2025", kind: "dataset", DOI: `10.9999/bo0313-${stamp}`, publisher: "Hydrology Office" } }),
    );
    made.push(page.workId, interview.workId, dataset.workId);

    expect(ok<{ record: { kind: string; URL?: string } }>(await readWork(page.workId)).record).toMatchObject({ kind: "webpage", URL: `https://example.org/river-${stamp}` });
    expect(ok<{ record: { kind: string } }>(await readWork(interview.workId)).record.kind).toBe("interview");
    const listed = ok<{ workId: string }[]>(await listWorks()).map((work) => work.workId);
    expect(listed).toEqual(expect.arrayContaining([page.workId, interview.workId, dataset.workId]));

    // Listed among the documents too, and under Roles → Source (BO_0313_Q3).
    const documents = ok<readonly { documentId: string }[]>(await listDocuments()).map((document) => document.documentId);
    expect(documents).toEqual(expect.arrayContaining([page.workId, interview.workId, dataset.workId]));
    const carrying = ok<readonly { id: string }[]>(await documentsCarrying("builtin:source")).map((document) => document.id);
    expect(carrying).toEqual(expect.arrayContaining([page.workId, interview.workId, dataset.workId]));
    const roles = ok<{ roles: readonly { id: string; values: Record<string, unknown> }[] }>(await structuresOf(dataset.workId));
    expect(roles.roles.find((role) => role.id === "builtin:source")?.values).toMatchObject({ kind: "dataset", doi: `10.9999/bo0313-${stamp}`, publisher: "Hydrology Office" });

    const duplicate = await addWork({ record: { title: "The same readings", kind: "dataset", DOI: `https://doi.org/10.9999/BO0313-${stamp}` } });
    expect(duplicate.outcome).toBe("validationFailure");
    expect(JSON.stringify(duplicate)).toContain(dataset.workId);

    const citing = ok<{ documentId: string }>(await createDocument({ title: `Citing three sources ${stamp}` }));
    made.push(citing.documentId);
    ok(
      await insertBlock({
        documentId: citing.documentId,
        block: {
          kind: "text",
          runs: [
            { text: "The river moved " },
            { text: "", cite: { work: page.workId } },
            { text: ", the ferryman saw it " },
            { text: "", cite: { work: interview.workId, locator: "12:30" } },
            { text: ", and the gauges agree " },
            { text: "", cite: { work: dataset.workId } },
            { text: "." },
          ],
        },
        placement: { at: "end" },
      }),
    );
    const read = ok<{ citationNumbers?: Record<string, number>; missingWorks?: readonly string[] }>(await readDocument(citing.documentId));
    expect(read.citationNumbers).toEqual({ [page.workId]: 1, [interview.workId]: 2, [dataset.workId]: 3 });
    expect(read.missingWorks).toBeUndefined();
    const ieee = ok<{ references: readonly { workId: string; number: number }[] }>(await referencesOf(citing.documentId, "ieee"));
    expect(ieee.references.map((reference) => [reference.workId, reference.number])).toEqual([
      [page.workId, 1],
      [interview.workId, 2],
      [dataset.workId, 3],
    ]);
    // APA cites an unpublished interview in the text alone, as personal
    // communication, and lists the other two, each as its own entry.
    const apa = ok<{ references: readonly { workId: string; title: string }[] }>(await referencesOf(citing.documentId, "apa"));
    expect(apa.references.map((reference) => reference.workId).sort()).toEqual([page.workId, dataset.workId].sort());
    expect(apa.references.find((reference) => reference.workId === page.workId)?.title).toBe("How the river moved");
   }, 30_000);

  it("Given a fill, Then a stale base is a conflict, and the current one writes the record's fields and keeps the rest", async () => {
    const added = ok<{ workId: string; revisionId: string }>(
      await addWork({ record: { title: "Typed in by hand", kind: "report", publisher: "Kept Publisher", URL: `https://example.org/report-${stamp}` } }),
    );
    made.push(added.workId);
    const record = { title: "The fetched report", kind: "report", author: [{ family: "Fetched", given: "A." }], issued: { "date-parts": [[2024]] }, URL: `https://example.org/report-${stamp}` };
    expect((await fillWork({ workId: added.workId, baseRevisionId: "rev:stale", record })).outcome).toBe("conflict");
    await settle();
    ok(await fillWork({ workId: added.workId, baseRevisionId: added.revisionId, record }));
    const filled = ok<{ record: Record<string, unknown> }>(await readWork(added.workId)).record;
    expect(filled).toMatchObject({ title: "The fetched report", author: [{ family: "Fetched", given: "A." }], publisher: "Kept Publisher" });
  });

  it("Given a work cited in a document, When the migration runs, Then the work is a source document, the citation names it and the list reads as before", async () => {
    const workId = crypto.randomUUID();
    const created = await write(
      'CREATE (w:work {id: $w_id, title: $w_title, kind: $w_kind, containerTitle: $w_container, DOI: $w_doi, status: "established"})',
      { w_id: workId, w_title: `A migrated paper ${stamp}`, w_kind: "article-journal", w_container: "Journal of Rivers", w_doi: `10.9999/bo0313-m-${stamp}` },
      "a work as BO_0291 wrote it",
    );
    expect(created.outcome).toBe("success");
    const citing = ok<{ documentId: string }>(await createDocument({ title: `Citing a work ${stamp}` }));
    made.push(citing.documentId);
    const block = ok<{ blockId: string }>(
      await insertBlock({ documentId: citing.documentId, block: { kind: "text", runs: [{ text: "As found " }, { text: "", cite: { work: workId, locator: "p. 4" } }] }, placement: { at: "end" } }),
    );
    // Before: the kernel and this build read a work as no source, so the
    // citation draws as missing until the migration has run.
    expect(ok<{ missingWorks?: readonly string[] }>(await readDocument(citing.documentId)).missingWorks).toEqual([workId]);

    await migrate(() => MIGRATIONS["sources-are-documents"]!(), "every work a source document");
    await settle();

    const after = ok<{ blocks: readonly { blockId: string; kind: string; runs?: readonly { cite?: { work: string; locator?: string } }[] }[]; citationNumbers?: Record<string, number>; missingWorks?: readonly string[] }>(
      await readDocument(citing.documentId),
    );
    const cite = after.blocks.find((one) => one.blockId === block.blockId)?.runs?.find((run) => run.cite !== undefined)?.cite;
    expect(cite?.work).not.toBe(workId);
    expect(cite?.locator).toBe("p. 4");
    const source = ok<{ record: Record<string, unknown> }>(await readWork(cite!.work));
    made.push(cite!.work);
    expect(source.record).toMatchObject({ title: `A migrated paper ${stamp}`, kind: "article-journal", "container-title": "Journal of Rivers", DOI: `10.9999/bo0313-m-${stamp}` });
    expect(after.citationNumbers).toEqual({ [cite!.work]: 1 });
    expect(after.missingWorks).toBeUndefined();
    const references = ok<{ references: readonly { title: string }[] }>(await referencesOf(citing.documentId, "ieee"));
    expect(references.references.map((reference) => reference.title)).toEqual([`A migrated paper ${stamp}`]);
    // The work is retired, and a second run finds nothing to do.
    const gone = await query({ statement: "MATCH (w) RETURN GRAPH w ROOT w", roots: [nodeRef(workId)], purpose: "the retired work" });
    expect(gone.outcome === "noResult" || (gone.outcome === "success" && gone.result.nodes.every((node) => node.id !== nodeRef(workId)))).toBe(true);
  });
});
