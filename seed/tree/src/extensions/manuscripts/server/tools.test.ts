import { describe, expect, it } from "vitest";

import { manuscriptWrite } from "./make";
import { documentOfInput, keptForKernel, keptOfInput, ToolRefusal } from "./tools";

/** What the kernel hands this extension's callback routes for a run's
 * manuscript, and what they answer (`BO_0293_023`). */

const documentId = "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f";
const source = { _kind: "blob", hash: `sha256:${"a".repeat(64)}`, mediaType: "text/x-tex", size: 24, filename: "manuscript.tex" };
const pdf = { _kind: "blob", hash: `sha256:${"b".repeat(64)}`, mediaType: "application/pdf", size: 4096, filename: "manuscript.pdf" };
const figure = { _kind: "blob", hash: `sha256:${"c".repeat(64)}`, mediaType: "image/png", size: 90, filename: "figure-img.png" };
const kept = { document: documentId, title: "Ice loss", venue: "ieee", revision: 41, outcome: "ok", log: ["one warning"], omitted: ["a video"], files: [source, pdf] };

describe("the projection's input", () => {
  it("takes the document's record id and refuses what is not one", () => {
    expect(documentOfInput({ document: ` ${documentId} ` })).toBe(documentId);
    expect(() => documentOfInput({})).toThrow(ToolRefusal);
    expect(() => documentOfInput({ document: "ice" })).toThrow(/record id/u);
  });
});

describe("the kept manuscript", () => {
  it("reads what the kernel hands it", () => {
    expect(keptOfInput(kept)).toEqual({ ...kept, files: [source, pdf] });
    expect(keptOfInput({ ...kept, figures: [figure] }).files).toEqual([source, pdf, figure]);
    expect(() => keptOfInput({ ...kept, figures: [{ filename: "figure-img.png" }] })).toThrow(/blob reference/u);
    expect(keptOfInput({ ...kept, title: undefined, log: undefined, omitted: "x" })).toMatchObject({ title: "", log: [], omitted: [] });
  });

  it("refuses what is not a manuscript's", () => {
    expect(() => keptOfInput({ ...kept, venue: "" })).toThrow(/venue/u);
    expect(() => keptOfInput({ ...kept, revision: "41" })).toThrow(/revision/u);
    expect(() => keptOfInput({ ...kept, outcome: "maybe" })).toThrow(/ok, errors, failed or timed out/u);
    expect(() => keptOfInput({ ...kept, files: [] })).toThrow(/at least its source/u);
    expect(() => keptOfInput({ ...kept, files: [{ filename: "manuscript.tex" }] })).toThrow(/blob reference/u);
    expect(() => keptOfInput({ ...kept, files: [{ ...source, filename: undefined }] })).toThrow(/filename/u);
  });

  it("composes the one node a press writes, by the run's principal, for the kernel to stage", () => {
    const answer = keptForKernel({ input: kept, run: { id: "arun-1", group: "node:run-1", pin: 41, person: "ann", principal: "claude" } });
    const [write, ...rest] = answer.stage ?? [];
    expect(rest).toEqual([]);
    expect(write?.statement).toBe(manuscriptWrite({ manuscriptId: "x", documentId, title: "", revision: 0, venue: "", files: [], made: "", by: "", outcome: "ok", log: [], omitted: [] }).statement);
    // A proposal-scoped write stages a candidate and refuses an explicit
    // established, so the run's write says no status; the press's does.
    expect(write?.statement).not.toContain("status");
    expect(manuscriptWrite({ manuscriptId: "x", documentId, title: "", revision: 0, venue: "", files: [], made: "", by: "", outcome: "ok", log: [], omitted: [] }, "established").statement).toContain('status: "established"');
    expect(write?.parameters).toMatchObject({ m_of: documentId, m_title: "Ice loss", m_revision: 41, m_venue: "ieee", m_files: [source, pdf], m_by: "claude", m_outcome: "ok", m_log: ["one warning"], m_omitted: ["a video"] });
    expect(write?.parameters["m_id"]).toBe((answer.result as { manuscriptId: string }).manuscriptId);
    expect(write?.rationale).toBe("a ieee manuscript of Ice loss");
    expect(answer.result).toMatchObject({ outcome: "ok", files: ["manuscript.tex", "manuscript.pdf"] });
  });

  it("is by the person who asked when the run names no principal, and refuses when neither is named", () => {
    const answer = keptForKernel({ input: kept, run: { id: "arun-1", group: "node:run-1", pin: 41, person: "ann" } });
    expect(answer.stage?.[0]?.parameters["m_by"]).toBe("ann");
    expect(() => keptForKernel({ input: kept, run: { id: "arun-1", group: "node:run-1", pin: 41 } })).toThrow(/who made it/u);
  });
});
