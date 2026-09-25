import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DocumentRoleView } from "~/extensions/doc-block-roles/lib/roles";
import { createDocumentRole, reviseDocumentRole, setBlockRole, setDocumentRole } from "~/extensions/doc-block-roles/server/roles";
import { createDocument, deleteDocument, insertBlock, readDocument, renameDocument, reviseTextBlock, setBlockDisposition } from "~/extensions/documents/server/documents";
import { readGraphEnv } from "~/server/ccgw/env";

import type { DocumentMentionsView, MentionedInView } from "../../lib/keywords";
import { keywordsOf, mentionedIn, mentionsOf } from "../../server/keywords";
import { readSettings, writeSettings } from "../../server/settings";
import { readKeywords, ToolRefusal } from "../../server/tools";

/**
 * Keywords over the one graph (`BO_0301_018`, the server side): a document
 * roled as a keyword is mentioned from another at once, in the plural and
 * by an alias; the mention gone when the block is retired; the keyword
 * renamed re-matching; *Mentioned in*; the tool's answer; and nothing while
 * no keyword role is chosen. Runs under the kernel harness like
 * `documents.test.ts`, as the owner, whose credential writes the settings.
 */
const configured = ((): boolean => {
  try {
    readGraphEnv();
    return true;
  } catch {
    return false;
  }
})();

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 350));

const ok = <T>(outcome: { outcome: string } & Record<string, unknown>): T => {
  if (outcome["outcome"] !== "success") throw new Error(`expected success, got ${JSON.stringify(outcome)}`);
  return outcome["result"] as T;
};

describe.skipIf(!configured)("keywords over CCGW", () => {
  let keywordRole: DocumentRoleView;
  let definition = "";
  let alias = "";
  let computing = "";
  let computingFirst = "";
  let qubit = "";
  let essay = "";
  let essayFirst = "";
  let essaySecond = "";
  let before = { keywordRole: null as string | null, definitionRole: null as { kind: "block" | "document"; id: string } | null, aliasRole: null as string | null };

  beforeAll(async () => {
    before = await readSettings();
    keywordRole = ok<DocumentRoleView>(await createDocumentRole({ name: "Keyword (test)" }));
    
    keywordRole = ok<DocumentRoleView>(await reviseDocumentRole(keywordRole.id, { command: "addBlockRole", name: "Definition" }));
    keywordRole = ok<DocumentRoleView>(await reviseDocumentRole(keywordRole.id, { command: "addBlockRole", name: "Alias" }));
    definition = keywordRole.blockRoles.find((role: { name: string }) => role.name === "Definition")!.id;
    alias = keywordRole.blockRoles.find((role: { name: string }) => role.name === "Alias")!.id;

    const created = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "Quantum computing" }));
    computing = created.documentId;
    computingFirst = created.blockId;
    await settle();
    const read = ok<{ blocks: { blockId: string; revisionId: string }[] }>(await readDocument(computing));
    ok(await reviseTextBlock({ documentId: computing, blockId: computingFirst, baseRevisionId: read.blocks[0]!.revisionId, runs: [{ text: "Computing with qubits, as a field." }] }));
    await settle();
    const aliases = ok<{ blockId: string }>(await insertBlock({ documentId: computing, block: { kind: "text", runs: [{ text: "QC\nquantum computation" }] }, placement: { after: computingFirst } })).blockId;
    await settle();
    ok(await setDocumentRole({ documentId: computing, documentRole: keywordRole.id }));
    ok(await setBlockRole({ documentId: computing, blockId: computingFirst, blockRole: definition }));
    ok(await setBlockRole({ documentId: computing, blockId: aliases, blockRole: alias }));

    const second = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "Qubit" }));
    qubit = second.documentId;
    await settle();
    ok(await setDocumentRole({ documentId: qubit, documentRole: keywordRole.id }));

    const third = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "An essay" }));
    essay = third.documentId;
    essayFirst = third.blockId;
    await settle();
    const essayRead = ok<{ blocks: { blockId: string; revisionId: string }[] }>(await readDocument(essay));
    ok(await reviseTextBlock({ documentId: essay, blockId: essayFirst, baseRevisionId: essayRead.blocks[0]!.revisionId, runs: [{ text: "Quantum computers hold qubits; QCs and quantum computation are the field." }] }));
    await settle();
    essaySecond = ok<{ blockId: string }>(await insertBlock({ documentId: essay, block: { kind: "text", runs: [{ text: "Only a " }, { text: "qubit", marks: ["code"] }, { text: " in code here." }] }, placement: { after: essayFirst } })).blockId;
    await settle();

    await writeSettings({ keywordRole: keywordRole.id, definitionRole: { kind: "block", id: definition }, aliasRole: alias });
  });

  afterAll(async () => {
    await writeSettings(before);
    for (const id of [essay, qubit, computing]) {
      if (id === "") continue;
      const document = await readDocument(id);
      if (document.outcome === "success") await deleteDocument({ documentId: id, baseRevisionId: document.result.revisionId });
    }
    await reviseDocumentRole(keywordRole.id, { command: "retire" });
  });

  it("holds the keywords with their aliases and definitions", async () => {
    const keywords = ok<readonly { id: string; title: string; aliases: readonly string[]; definitionSource: string | null }[]>(await keywordsOf());
    const found = keywords.find((keyword) => keyword.id === computing);
    expect(found?.title).toBe("Quantum computing");
    expect(found?.aliases).toEqual(["QC", "quantum computation"]);
    expect(found?.definitionSource).toBe("block");
    expect(keywords.find((keyword) => keyword.id === qubit)?.definitionSource).toBeNull();
  });

  it("mentions from another document at once — the plural, an alias, the stem — and nothing under the code mark", async () => {
    const view = ok<DocumentMentionsView>(await mentionsOf(essay));
    const first = view.blocks.find((block) => block.blockId === essayFirst);
    expect(first?.mentions.map((mention) => [mention.keyword, mention.rule])).toEqual([
      [computing, "stem"],
      [qubit, "inflection"],
      [computing, "alias"],
      [computing, "alias"],
    ]);
    expect(view.blocks.some((block) => block.blockId === essaySecond)).toBe(false);
    expect(view.keywords[computing]?.aliases).toEqual(["QC", "quantum computation"]);
  });

  it("leaves a keyword's own names alone, and counts a keyword's mention of another keyword", async () => {
    const view = ok<DocumentMentionsView>(await mentionsOf(computing));
    expect(view.blocks.flatMap((block) => block.mentions.map((mention) => mention.keyword))).toEqual([qubit]);
  });

  it("answers Mentioned in for a keyword, and nothing for a document that is none", async () => {
    const mentioned = ok<MentionedInView>(await mentionedIn(qubit));
    expect(mentioned.keyword?.title).toBe("Qubit");
    expect(mentioned.documents.map((document) => [document.title, document.mentions.map((mention) => mention.blockId)])).toEqual([
      ["An essay", [essayFirst]],
      ["Quantum computing", [computingFirst]],
    ]);
    expect(ok<MentionedInView>(await mentionedIn(essay))).toEqual({ keyword: null, documents: [] });
  });

  it("loses a mention with the block retired, and follows a rename at the next read", async () => {
    const stand = async (standing: "discarded" | "keep") => {
      const read = ok<{ blocks: { blockId: string; revisionId: string }[] }>(await readDocument(essay));
      const block = read.blocks.find((candidate) => candidate.blockId === essayFirst)!;
      ok(await setBlockDisposition({ documentId: essay, blockId: essayFirst, baseRevisionId: block.revisionId, standing }));
      await settle();
    };
    await stand("discarded");
    expect(ok<MentionedInView>(await mentionedIn(qubit)).documents.map((document) => document.title)).toEqual(["Quantum computing"]);
    await stand("keep");
    const read = ok<{ revisionId: string }>(await readDocument(qubit));
    ok(await renameDocument({ documentId: qubit, baseRevisionId: read.revisionId, title: "Quantum bit" }));
    await settle();
    const view = ok<DocumentMentionsView>(await mentionsOf(essay));
    // *qubits* no longer reaches *Quantum bit* by any rule; the stem of *bit* is not *qubit*.
    expect(view.blocks.find((block) => block.blockId === essayFirst)?.mentions.map((mention) => mention.keyword)).toEqual([computing, computing, computing]);
  });

  it("answers the tool at the run's pin, and refuses a document that is not here", async () => {
    const answer = (await readKeywords({ input: { document: essay }, run: { id: "run", group: "group", pin: 0 } })).result as { mentioned: { title: string }[]; keywords: { title: string }[]; note: string };
    expect(answer.mentioned.map((keyword) => keyword.title)).toEqual(["Quantum computing"]);
    expect(answer.keywords.map((keyword) => keyword.title)).toContain("Quantum bit");
    expect(answer.note).toContain("definition");
    await expect(readKeywords({ input: { document: "00000000-0000-4000-8000-000000000000" }, run: { id: "run", group: "group", pin: 0 } })).rejects.toThrow(ToolRefusal);
  });

  it("matches nothing while no keyword role is chosen", async () => {
    await writeSettings({ keywordRole: null, definitionRole: null, aliasRole: null });
    expect(ok<DocumentMentionsView>(await mentionsOf(essay)).blocks).toEqual([]);
    expect(ok<readonly unknown[]>(await keywordsOf())).toEqual([]);
    await writeSettings({ keywordRole: keywordRole.id, definitionRole: { kind: "block", id: definition }, aliasRole: alias });
  });
});
