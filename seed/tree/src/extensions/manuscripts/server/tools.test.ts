import { describe, expect, it } from "vitest";

import { renditionWrite } from "./make";
import { documentOfInput, keptForKernel, keptOfInput, ToolRefusal } from "./tools";

/** What the kernel hands this extension's callback routes for a run's
 * manuscript, and what they answer (`BO_0293_023`, `calliopa-bootstrap`'s
 * `BO_0312_020`–`BO_0312_021`). */

const documentId = "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f";
const blockId = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const source = { _kind: "blob", hash: `sha256:${"a".repeat(64)}`, mediaType: "text/x-tex", size: 24, filename: "manuscript.tex" };
const pdf = { _kind: "blob", hash: `sha256:${"b".repeat(64)}`, mediaType: "application/pdf", size: 4096, filename: "manuscript.pdf" };
const figure = { _kind: "blob", hash: `sha256:${"c".repeat(64)}`, mediaType: "image/png", size: 90, filename: "figure-img.png" };
const kept = { document: documentId, type: "pdf", title: "Ice loss", venue: "ieee", revision: 41, outcome: "ok", log: ["one warning"], omitted: ["a video"], files: [source, pdf] };

describe("the projection's input", () => {
  it("takes the document's record id and refuses what is not one", () => {
    expect(documentOfInput({ document: ` ${documentId} ` })).toBe(documentId);
    expect(() => documentOfInput({})).toThrow(ToolRefusal);
    expect(() => documentOfInput({ document: "ice" })).toThrow(/record id/u);
  });


});

describe("the kept rendition", () => {
  it("reads what the kernel hands it", () => {
    expect(keptOfInput(kept)).toEqual({ ...kept, files: [source, pdf] });
    expect(keptOfInput({ ...kept, figures: [figure] }).files).toEqual([source, pdf, figure]);
    expect(keptOfInput({ ...kept, type: undefined })).toMatchObject({ type: "pdf" });
    // A block named, as a kernel before BO_0332 sends one, is not read:
    // the rendition is kept on the document.
    expect(keptOfInput({ ...kept, block: blockId })).not.toHaveProperty("block");
    expect(() => keptOfInput({ ...kept, figures: [{ filename: "figure-img.png" }] })).toThrow(/blob reference/u);
    expect(keptOfInput({ ...kept, title: undefined, log: undefined, omitted: "x" })).toMatchObject({ title: "", log: [], omitted: [] });
  });

  it("refuses what is not a rendition's", () => {
    expect(() => keptOfInput({ ...kept, type: "slides" })).toThrow(/text, table, image, video, pdf or structured/u);
    expect(() => keptOfInput({ ...kept, venue: "" })).toThrow(/venue/u);
    expect(() => keptOfInput({ ...kept, revision: "41" })).toThrow(/revision/u);
    expect(() => keptOfInput({ ...kept, outcome: "maybe" })).toThrow(/ok, errors, failed or timed out/u);
    expect(() => keptOfInput({ ...kept, files: [] })).toThrow(/at least its source/u);
    expect(() => keptOfInput({ ...kept, files: [{ filename: "manuscript.tex" }] })).toThrow(/blob reference/u);
    expect(() => keptOfInput({ ...kept, files: [{ ...source, filename: undefined }] })).toThrow(/filename/u);
  });

  it("composes one rendition on the document, by the run's principal, for the kernel to stage", () => {
    const answer = keptForKernel({ input: kept, run: { id: "arun-1", group: "node:run-1", pin: 41, person: "ann", principal: "claude" } });
    const [write, ...rest] = answer.stage ?? [];
    expect(rest).toEqual([]);
    const blank = { renditionId: "x", of: "", documentId, type: "pdf" as const, title: "", revision: 0, venue: "", files: [], made: "", by: "", outcome: "ok" as const, log: [], omitted: [] };
    expect(write?.statement).toBe(renditionWrite(blank).statement);
    expect(write?.statement).toContain("CREATE (r:formatRendition {");
    // A proposal-scoped write stages a candidate and refuses an explicit
    // established, so the run's write says no status.
    expect(write?.statement).not.toContain("status");
    expect(write?.parameters).toMatchObject({ r_of: documentId, r_document: documentId, r_type: "pdf", r_title: "Ice loss", r_revision: 41, r_venue: "ieee", r_files: [source, pdf], r_by: "claude", r_outcome: "ok", r_log: ["one warning"], r_omitted: ["a video"] });
    expect(write?.parameters["r_id"]).toBe((answer.result as { renditionId: string }).renditionId);
    expect(write?.rationale).toBe("a ieee manuscript of Ice loss");
    expect(answer.result).toMatchObject({ outcome: "ok", files: ["manuscript.tex", "manuscript.pdf"] });
  });

  it("is by the person who asked when the run names no principal, and refuses when neither is named", () => {
    const answer = keptForKernel({ input: kept, run: { id: "arun-1", group: "node:run-1", pin: 41, person: "ann" } });
    expect(answer.stage?.[0]?.parameters["r_by"]).toBe("ann");
    expect(() => keptForKernel({ input: kept, run: { id: "arun-1", group: "node:run-1", pin: 41 } })).toThrow(/who made it/u);
  });
});
