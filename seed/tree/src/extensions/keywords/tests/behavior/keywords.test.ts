import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ALIAS_ROLE, DEFINITION_ROLE, KEYWORD_ROLE, type DocumentRolesView, type RoleView } from "~/extensions/doc-block-roles/lib/roles";
import { MIGRATIONS as ROLE_MIGRATIONS } from "~/extensions/doc-block-roles/server/migrations";
import { createRole, readRole, reviseRole, rolesOf, setRole, setValues } from "~/extensions/doc-block-roles/server/roles";
import { createDocument, deleteDocument, insertBlock, readDocument, renameDocument, restoreBlock, retireBlock, reviseTextBlock } from "~/extensions/documents/server/documents";
import { write } from "~/server/ccgw/client";
import { readGraphEnv } from "~/server/ccgw/env";

import type { DocumentMentionsView, MentionedInView } from "../../lib/keywords";
import { createKeyword, keywordsOf, mentionedIn, mentionsOf } from "../../server/keywords";
import { mergeKeywordRoles } from "../../server/merge";
import { promptKeywords, readKeywords, ToolRefusal } from "../../server/tools";

/**
 * Keywords over the one graph (`BO_0301_018`, `BO_0310_026`, the server
 * side): a document taking the built-in *Keyword* is mentioned from another
 * at once, in the plural and by an alias read from *Alias*; a keyword named
 * with `@` counted in *Mentioned in*; the mention gone when the block is
 * retired; the keyword renamed re-matching; a keyword created from the `@`
 * list; the run-start section with *Definition* switched on and off; the
 * merge of the roles a person chose before; and the tool's answer. Runs under
 * the kernel harness like `documents.test.ts`.
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

const refusedAs = (outcome: { outcome: string } & Record<string, unknown>): string =>
  outcome["outcome"] === "validationFailure" ? ((outcome["failures"] as { rule: string }[])[0]?.rule ?? "") : outcome["outcome"];

/** A write to a built-in the roles suite may have written a moment ago,
 * tried again past the kernel's per-node floor. */
const retried = async <T extends { outcome: string } & Record<string, unknown>>(act: () => Promise<T>): Promise<T> => {
  for (let attempt = 0; ; attempt++) {
    const outcome = await act();
    if (attempt >= 5 || refusedAs(outcome) !== "write_too_frequent") return outcome;
    await settle();
  }
};

const migrate = async (statement: { statement: string; parameters: Record<string, unknown> }, why: string) => {
  if (statement.statement !== "") ok(await retried(() => write(statement.statement, statement.parameters, why) as Promise<{ outcome: string } & Record<string, unknown>>));
  await settle();
};

describe.skipIf(!configured)("keywords over CCGW", () => {
  let computing = "";
  let computingFirst = "";
  let qubit = "";
  let essay = "";
  let essayFirst = "";
  let essaySecond = "";
  let essayNamed = "";
  let prompt = "";
  const created: string[] = [];

  beforeAll(async () => {
    // The built-ins stand as every instance's do after its migrations.
    await migrate(ok(await ROLE_MIGRATIONS["builtin-roles"]!()), "the built-in roles");
    await migrate(ok(await ROLE_MIGRATIONS["keyword-builtins"]!()), "what Keyword offers and sends");
    // The definition goes with a prompt, as on a fresh install.
    ok(await retried(() => reviseRole(KEYWORD_ROLE, { command: "sendWithPrompt", entry: DEFINITION_ROLE, on: true })));
    await settle();

    const first = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "Quantum computing" }));
    computing = first.documentId;
    computingFirst = first.blockId;
    await settle();
    const read = ok<{ blocks: { blockId: string; revisionId: string }[] }>(await readDocument(computing));
    ok(await reviseTextBlock({ documentId: computing, blockId: computingFirst, baseRevisionId: read.blocks[0]!.revisionId, runs: [{ text: "Computing with qubits, as a field." }] }));
    await settle();
    const aliases = ok<{ blockId: string }>(await insertBlock({ documentId: computing, block: { kind: "text", runs: [{ text: "QC\nquantum computation" }] }, placement: { after: computingFirst } })).blockId;
    await settle();
    ok(await setRole({ documentId: computing, role: KEYWORD_ROLE, taken: true }));
    ok(await setRole({ documentId: computing, blockId: computingFirst, role: DEFINITION_ROLE, taken: true }));
    ok(await setRole({ documentId: computing, blockId: aliases, role: ALIAS_ROLE, taken: true }));

    const second = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "Qubit" }));
    qubit = second.documentId;
    await settle();
    ok(await setRole({ documentId: qubit, role: KEYWORD_ROLE, taken: true }));

    const third = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "An essay" }));
    essay = third.documentId;
    essayFirst = third.blockId;
    await settle();
    const essayRead = ok<{ blocks: { blockId: string; revisionId: string }[] }>(await readDocument(essay));
    ok(await reviseTextBlock({ documentId: essay, blockId: essayFirst, baseRevisionId: essayRead.blocks[0]!.revisionId, runs: [{ text: "Quantum computers hold qubits; QCs and quantum computation are the field." }] }));
    await settle();
    essaySecond = ok<{ blockId: string }>(await insertBlock({ documentId: essay, block: { kind: "text", runs: [{ text: "Only a " }, { text: "qubit", marks: ["code"] }, { text: " in code here." }] }, placement: { after: essayFirst } })).blockId;
    await settle();
    // Named with `@`: words that match nothing name Qubit on purpose.
    essayNamed = ok<{ blockId: string }>(await insertBlock({ documentId: essay, block: { kind: "text", runs: [{ text: "The " }, { text: "two-level systems", keyword: qubit }, { text: " again." }] }, placement: { after: essaySecond } })).blockId;
    await settle();
    // A prompt naming Qubit and saying quantum computing.
    prompt = ok<{ blockId: string }>(await insertBlock({ documentId: essay, block: { kind: "text", runs: [{ text: "Explain " }, { text: "those bits", keyword: qubit }, { text: " for quantum computing." }] }, placement: { after: essayNamed } })).blockId;
    await settle();
  });

  afterAll(async () => {
    for (const id of [essay, qubit, computing, ...created]) {
      if (id === "") continue;
      const document = await readDocument(id);
      if (document.outcome === "success") await deleteDocument({ documentId: id, baseRevisionId: document.result.revisionId });
    }
  });

  it("holds the keywords with their aliases and definitions by the built-ins", async () => {
    const keywords = ok<readonly { id: string; title: string; aliases: readonly string[]; definitionSource: string | null }[]>(await keywordsOf());
    const found = keywords.find((keyword) => keyword.id === computing);
    expect(found?.title).toBe("Quantum computing");
    expect(found?.aliases).toEqual(["QC", "quantum computation"]);
    expect(found?.definitionSource).toBe("block");
    expect(keywords.find((keyword) => keyword.id === qubit)?.definitionSource).toBeNull();
  });

  it("mentions from another document at once — the plural, an alias, the stem, a keyword named with @ — and nothing under the code mark", async () => {
    const view = ok<DocumentMentionsView>(await mentionsOf(essay));
    const first = view.blocks.find((block) => block.blockId === essayFirst);
    expect(first?.mentions.map((mention) => [mention.keyword, mention.rule])).toEqual([
      [computing, "stem"],
      [qubit, "inflection"],
      [computing, "alias"],
      [computing, "alias"],
    ]);
    expect(view.blocks.some((block) => block.blockId === essaySecond)).toBe(false);
    expect(view.blocks.find((block) => block.blockId === essayNamed)?.mentions.map((mention) => [mention.keyword, mention.rule, mention.start, mention.end])).toEqual([[qubit, "named", 4, 21]]);
    expect(view.keywords[computing]?.aliases).toEqual(["QC", "quantum computation"]);
  });

  it("leaves a keyword's own names alone, and counts a keyword's mention of another keyword", async () => {
    const view = ok<DocumentMentionsView>(await mentionsOf(computing));
    expect(view.blocks.flatMap((block) => block.mentions.map((mention) => mention.keyword))).toEqual([qubit]);
  });

  it("answers Mentioned in for a keyword, the named mention counted, and nothing for a document that is none", async () => {
    const mentioned = ok<MentionedInView>(await mentionedIn(qubit));
    expect(mentioned.keyword?.title).toBe("Qubit");
    expect(mentioned.documents.map((document) => [document.title, document.mentions.map((mention) => mention.blockId)])).toEqual([
      ["An essay", [essayFirst, essayNamed, prompt]],
      ["Quantum computing", [computingFirst]],
    ]);
    expect(ok<MentionedInView>(await mentionedIn(essay))).toEqual({ keyword: null, documents: [] });
  });

  it("gives the run the included keywords' definitions at its start, and nothing with Definition switched off", async () => {
    const answer = await promptKeywords({ input: { document: essay, block: prompt }, run: { id: "run", group: "group", pin: 0 } });
    // Named and matched alike; Qubit has no definition, so nothing is sent of it.
    expect(answer.items).toEqual([{ id: computing, title: "Quantum computing" }]);
    expect(answer.section).toContain("- Quantum computing\n  Definition: Computing with qubits, as a field.");
    expect(answer.section).not.toContain("Qubit");
    ok(await retried(() => reviseRole(KEYWORD_ROLE, { command: "sendWithPrompt", entry: DEFINITION_ROLE, on: false })));
    await settle();
    expect(await promptKeywords({ input: { document: essay, block: prompt }, run: { id: "run", group: "group", pin: 0 } })).toEqual({ section: "", items: [] });
    ok(await retried(() => reviseRole(KEYWORD_ROLE, { command: "sendWithPrompt", entry: DEFINITION_ROLE, on: true })));
    await settle();
    // A block with no keyword sends nothing.
    expect(await promptKeywords({ input: { document: essay, block: essaySecond }, run: { id: "run", group: "group", pin: 0 } })).toEqual({ section: "", items: [] });
  });

  it("creates a keyword from the @ list: a document taking Keyword, titled as typed", async () => {
    const made = ok<{ id: string; title: string }>(await createKeyword("  entanglement  "));
    created.push(made.id);
    expect(made.title).toBe("entanglement");
    await settle();
    const roles = ok<DocumentRolesView>(await rolesOf(made.id));
    expect(roles.roles.map((role) => role.id)).toEqual([KEYWORD_ROLE]);
    expect(ok<readonly { id: string }[]>(await keywordsOf()).map((keyword) => keyword.id)).toContain(made.id);
    expect((await createKeyword("   ")).outcome).toBe("validationFailure");
  });

  it("merges the roles a person chose before into the built-ins, and retires them", async () => {
    let mine = ok<RoleView>(await createRole({ name: "Keyword (mine)" }));
    const meaning = ok<RoleView>(await createRole({ name: "Meaning" }));
    const names = ok<RoleView>(await createRole({ name: "Other names" }));
    const example = ok<RoleView>(await createRole({ name: "Example" }));
    await settle();
    mine = ok<RoleView>(await reviseRole(mine.id, { command: "addField", name: "Domain", type: "text" }));
    await settle();
    for (const offered of [meaning.id, names.id, example.id]) {
      mine = ok<RoleView>(await reviseRole(mine.id, { command: "offer", role: offered }));
      await settle();
    }
    const made = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "Superposition" }));
    created.push(made.documentId);
    await settle();
    ok(await setRole({ documentId: made.documentId, role: mine.id, taken: true }));
    await settle();
    ok(await setValues({ documentId: made.documentId, role: mine.id, values: { [mine.fields[0]!.key]: "physics" } }));
    ok(await setRole({ documentId: made.documentId, blockId: made.blockId, role: meaning.id, taken: true }));
    await settle();

    await migrate(ok(await mergeKeywordRoles({ id: "keywords", keywordRole: mine.id, definitionRole: { kind: "block", id: meaning.id }, aliasRole: names.id })), "the merge");
    const keyword = ok<RoleView>(await readRole(KEYWORD_ROLE));
    expect(keyword.fields.map((field) => field.name)).toContain("Domain");
    expect(keyword.offers).toEqual(expect.arrayContaining([DEFINITION_ROLE, ALIAS_ROLE, example.id]));
    expect(keyword.offers).not.toContain(meaning.id);
    const roles = ok<DocumentRolesView>(await rolesOf(made.documentId));
    expect(roles.roles.map((role) => role.id)).toEqual([KEYWORD_ROLE]);
    expect(roles.roles[0]!.values[mine.fields[0]!.key]).toBe("physics");
    expect(roles.blocks[0]!.roles.map((role) => role.id)).toEqual([DEFINITION_ROLE]);
    for (const id of [mine.id, meaning.id, names.id]) expect(ok<RoleView>(await readRole(id)).retired).toBe(true);
    expect(ok<readonly { id: string }[]>(await keywordsOf()).map((entry) => entry.id)).toContain(made.documentId);
    // Nothing left to merge: every chosen role is retired.
    expect(ok<{ statement: string }>(await mergeKeywordRoles({ keywordRole: mine.id, definitionRole: { kind: "block", id: meaning.id }, aliasRole: names.id })).statement).toBe("");
    expect(ok<{ statement: string }>(await mergeKeywordRoles(null)).statement).toBe("");
  });

  it("loses a mention with the block retired, and follows a rename at the next read", async () => {
    // Retired and restored at the start, where it stood. BO_0315_009
    ok(await retireBlock({ documentId: essay, blockId: essayFirst }));
    await settle();
    expect(ok<MentionedInView>(await mentionedIn(qubit)).documents.map((document) => [document.title, document.mentions.length])).toEqual([
      ["An essay", 2],
      ["Quantum computing", 1],
    ]);
    ok(await restoreBlock({ documentId: essay, blockId: essayFirst, placement: { at: "start" } }));
    await settle();
    const read = ok<{ revisionId: string }>(await readDocument(qubit));
    ok(await renameDocument({ documentId: qubit, baseRevisionId: read.revisionId, title: "Quantum bit" }));
    await settle();
    const view = ok<DocumentMentionsView>(await mentionsOf(essay));
    // *qubits* no longer reaches *Quantum bit* by any rule; the named mention
    // follows the rename.
    expect(view.blocks.find((block) => block.blockId === essayFirst)?.mentions.map((mention) => mention.keyword)).toEqual([computing, computing, computing]);
    expect(view.keywords[qubit]?.title).toBe("Quantum bit");
  });

  it("answers the tool at the run's pin, and refuses a document that is not here", async () => {
    const answer = (await readKeywords({ input: { document: essay }, run: { id: "run", group: "group", pin: 0 } })).result as { mentioned: { title: string }[]; keywords: { title: string }[]; note: string };
    expect(answer.mentioned.map((keyword) => keyword.title)).toEqual(expect.arrayContaining(["Quantum computing", "Quantum bit"]));
    expect(answer.keywords.map((keyword) => keyword.title)).toContain("Quantum bit");
    expect(answer.note).toContain("definition");
    await expect(readKeywords({ input: { document: "00000000-0000-4000-8000-000000000000" }, run: { id: "run", group: "group", pin: 0 } })).rejects.toThrow(ToolRefusal);
  });
});
