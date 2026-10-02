import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MIGRATIONS as ROLE_MIGRATIONS } from "~/extensions/doc-block-roles/server/migrations";
import { createRole, documentsCarrying, setRole } from "~/extensions/doc-block-roles/server/roles";
import { PROFILE_RECORD } from "~/extensions/documents/lib/profile";
import { createDocument, deleteDocument, profileSummary, readDocument } from "~/extensions/documents/server/documents";
import { write } from "~/server/ccgw/client";
import { readGraphEnv } from "~/server/ccgw/env";
import { nodeRef } from "~/server/ccgw/nodes";
import { call, jsonInit } from "~/server/kernel/client";

import { PROFILE_ROLE, type GrantView, type ProfileChoices } from "../../lib/profiles";
import { choicesFor, createProfile, forward, profileInTheChip, profileRecord } from "../../server/profiles";

/**
 * `profiles` over the one graph and the kernel (`calliopa-bootstrap`'s
 * `BO_0311_013`, the server side): a profile created takes the built-in
 * *Profile*; the chip is offered every profile, those carrying a role the
 * document takes marked first, and the person's last profile in the
 * document, none on a profile's own; the upgrade migration gives a profile
 * made before the role the role and drops a document's attached profile,
 * then finds nothing left of either; and a grant and a revoke through the
 * kernel, the grant naming a code block as its tool. Runs under the kernel
 * harness like `documents`' suites.
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

/** A write to a built-in another suite may have written a moment ago. */
const retried = async <T extends { outcome: string } & Record<string, unknown>>(act: () => Promise<T>): Promise<T> => {
  for (let attempt = 0; ; attempt++) {
    const outcome = await act();
    const rule = outcome["outcome"] === "validationFailure" ? ((outcome["failures"] as { rule: string }[])[0]?.rule ?? "") : "";
    if (attempt >= 5 || rule !== "write_too_frequent") return outcome;
    await settle();
  }
};

const migrate = async (statement: { statement: string; parameters: Record<string, unknown> }, why: string) => {
  if (statement.statement !== "") ok(await retried(() => write(statement.statement, statement.parameters, why) as Promise<{ outcome: string } & Record<string, unknown>>));
  await settle();
};

const carrying = async (): Promise<string[]> => ok<readonly { id: string }[]>(await documentsCarrying(PROFILE_ROLE)).map((document) => document.id);

describe.skipIf(!configured)("profiles over CCGW", () => {
  let blog = "";
  let other = "";
  let legacy = "";
  let essay = "";
  const created: string[] = [];

  beforeAll(async () => {
    await migrate(ok(await ROLE_MIGRATIONS["builtin-roles"]!()), "the built-in roles");
    blog = ok<{ documentId: string }>(await createProfile("Blog post")).documentId;
    other = ok<{ documentId: string }>(await createProfile("Exploration")).documentId;
    legacy = ok<{ documentId: string }>(await createDocument({ title: "Made before the role", record: PROFILE_RECORD })).documentId;
    essay = ok<{ documentId: string }>(await createDocument({ title: "Essay" })).documentId;
    created.push(blog, other, legacy, essay);
  });

  afterAll(async () => {
    for (const id of created) {
      const document = await readDocument(id);
      if (document.outcome === "success") {
        await settle();
        await deleteDocument({ documentId: id, baseRevisionId: document.result.revisionId });
      }
    }
  });

  it("Given a profile created, Then it takes the built-in Profile, and one made before the role does not yet", async () => {
    const holding = await carrying();
    expect(holding).toContain(blog);
    expect(holding).toContain(other);
    expect(holding).not.toContain(legacy);
  });

  it("Given a role the document and one profile take, Then the chip marks that profile first, and restores the person's last", async () => {
    const recipe = ok<{ id: string }>(await createRole({ name: `Recipe ${Date.now()}` })).id;
    await settle();
    ok(await retried(() => setRole({ documentId: blog, role: recipe, taken: true }) as Promise<{ outcome: string } & Record<string, unknown>>));
    await settle();
    ok(await retried(() => setRole({ documentId: essay, role: recipe, taken: true }) as Promise<{ outcome: string } & Record<string, unknown>>));
    const essayDocument = ok<{ blocks: readonly { blockId: string }[] }>(await readDocument(essay));
    const block = essayDocument.blocks[0]?.blockId ?? "";

    let choices = ok<ProfileChoices>(await choicesFor(essay, block));
    expect(choices.isProfile).toBe(false);
    expect(choices.last).toBeNull();
    expect(choices.profiles.find((profile) => profile.id === blog)?.matches).toBe(true);
    expect(choices.profiles.find((profile) => profile.id === other)?.matches).toBe(false);

    // The kernel keeps the person's last as a run starts; written here as the
    // kernel writes it.
    const kept = await call(`/__kernel/state/people/me/profile/${encodeURIComponent(essay)}`, jsonInit("PUT", { profile: other }));
    expect(kept.status).toBe(200);
    choices = ok<ProfileChoices>(await choicesFor(essay, block));
    expect(choices.last).toBe(other);

    const own = ok<ProfileChoices>(await choicesFor(blog, ""));
    expect(own.isProfile).toBe(true);
    expect(own.last).toBeNull();
  });

  it("Given a profile without the role and a document with an attached profile, Then the migration gives the one and drops the other, and then finds nothing of either", async () => {
    await settle();
    ok(await retried(() => write("SET d.profile = $p", { dNodeId: nodeRef(essay), p: blog }, "an attachment from before BO_0311") as Promise<{ outcome: string } & Record<string, unknown>>));
    await settle();
    const first = ok<{ statement: string; parameters: Record<string, unknown> }>(await profileInTheChip());
    expect(Object.values(first.parameters)).toContain(nodeRef(legacy));
    expect(Object.values(first.parameters)).toContain(nodeRef(essay));
    expect(Object.values(first.parameters)).not.toContain(nodeRef(blog));
    await migrate(first, "the profile in the chip");
    expect(await carrying()).toContain(legacy);
    const again = ok<{ parameters: Record<string, unknown> }>(await profileInTheChip());
    expect(Object.values(again.parameters)).not.toContain(nodeRef(legacy));
    expect(Object.values(again.parameters)).not.toContain(nodeRef(essay));
  });

  it("Given a profile with a code block, When the owner grants and revokes it, Then the kernel answers the tool granted and then offline", async () => {
    await settle();
    ok(await retried(() =>
      write(
        `CREATE (c:sourcecode {id: $cid, order: "z", source: "print('sent')", caption: "Send an email", status: "established"}); RELATE pref -[r:CONTAINS]-> cref`,
        { cid: `${blog}-send`, pref: nodeRef(blog), cref: nodeRef(`${blog}-send`) },
        "a tool in the profile",
      ) as Promise<{ outcome: string } & Record<string, unknown>>,
    ));
    await settle();
    const before = await forward(`/__kernel/profiles/${encodeURIComponent(blog)}/grant`, { method: "GET" });
    expect(before.status).toBe(200);
    expect((before.body as GrantView).granted).toBe(false);
    expect((before.body as GrantView).tools).toEqual([{ block: `${blog}-send`, name: "send_an_email", description: "Send an email", state: "never" }]);

    const granted = await forward(`/__kernel/profiles/${encodeURIComponent(blog)}/grant`, jsonInit("PUT", { secrets: [] }));
    expect(granted.status).toBe(200);
    expect((granted.body as GrantView).granted).toBe(true);
    expect((granted.body as GrantView).tools[0]?.state).toBe("granted");

    const revoked = await forward(`/__kernel/profiles/${encodeURIComponent(blog)}/grant`, { method: "DELETE" });
    expect((revoked.body as GrantView).granted).toBe(false);
    expect((revoked.body as GrantView).tools[0]?.state).toBe("never");
  });
  it("Given a document taking Profile, Then it is a profile the chip offers, and clearing the role makes it a document again", async () => {
    const mailer = ok<{ documentId: string }>(await createDocument({ title: "Mailer" })).documentId;
    created.push(mailer);
    await settle();
    ok(await retried(() => setRole({ documentId: mailer, role: PROFILE_ROLE, taken: true }) as Promise<{ outcome: string } & Record<string, unknown>>));
    expect(ok<{ id: string } | null>(await profileSummary(mailer))?.id).toBe(mailer);
    const offered = ok<ProfileChoices>(await choicesFor(essay, ""));
    expect(offered.profiles.map((profile) => profile.id)).toContain(mailer);
    await settle();
    ok(await retried(() => setRole({ documentId: mailer, role: PROFILE_ROLE, taken: false }) as Promise<{ outcome: string } & Record<string, unknown>>));
    expect(ok<unknown>(await profileSummary(mailer))).toBeNull();
  });

  it("Given a document that took Profile before taking it wrote the record, Then the migration gives it the record, and then finds nothing", async () => {
    const before = ok<{ documentId: string }>(await createDocument({ title: "Mailer from before" })).documentId;
    created.push(before);
    await settle();
    ok(await retried(() => write(`RELATE dref -[h:hasBlockRole]-> rref`, { dref: nodeRef(before), rref: nodeRef(PROFILE_ROLE) }, "the role without the record") as Promise<{ outcome: string } & Record<string, unknown>>));
    expect(ok<unknown>(await profileSummary(before))).toBeNull();
    await settle();
    const first = ok<{ statement: string; parameters: Record<string, unknown> }>(await profileRecord());
    expect(Object.values(first.parameters)).toContain(nodeRef(before));
    await migrate(first, "every carrier of Profile is a profile");
    expect(ok<{ id: string } | null>(await profileSummary(before))?.id).toBe(before);
    expect(Object.values(ok<{ parameters: Record<string, unknown> }>(await profileRecord()).parameters)).not.toContain(nodeRef(before));
  });
});
