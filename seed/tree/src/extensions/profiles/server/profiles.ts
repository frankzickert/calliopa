import { HttpError } from "~/server/http-error";
import type { GraphOutcome } from "~/server/outcome";
import { isRecordId } from "~/server/uuid";
import { call } from "~/server/kernel/client";
import { nodeRef } from "~/server/ccgw/nodes";
import { PROFILE_RECORD } from "~/extensions/documents/lib/profile";
import { UNNAMED_PROFILE } from "~/extensions/documents/lib/naming";
import { clearProfileSlotsStatement, createDocument, listProfiles, profileSummary } from "~/extensions/documents/server/documents";
import { documentsCarrying, rolesOf, setRole } from "~/extensions/doc-block-roles/server/roles";
import { HAS_BLOCK_ROLE } from "~/extensions/doc-block-roles/lib/roles";

import { PROFILE_ROLE, type ProfileChoices } from "../lib/profiles";

/**
 * What `profiles`' routes are made of (`calliopa-bootstrap`'s `BO_0311`):
 * the create, the chip's choices, the kernel's grant forwarded, and the
 * upgrade migration. Only server code imports this module.
 */

export const record = (value: unknown): Record<string, unknown> => (typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {});

export const documentOf = (id: string | undefined): string => {
  if (id === undefined || !isRecordId(id)) throw new HttpError(404, "no such document");
  return id;
};

/** What the kernel answers, as the route answers it: its body and status, a
 * refusal as `{error}` in the kernel's own words. */
export async function forward(path: string, init: RequestInit): Promise<{ readonly status: number; readonly body: unknown }> {
  const response = await call(path, init);
  const body = await response.json().catch(() => ({}));
  if (response.ok) return { status: response.status, body };
  const said = (record(body)["diagnostics"] as readonly { readonly message?: string }[] | undefined)?.[0]?.message;
  return { status: response.status, body: { error: said ?? `the kernel answered ${response.status}` } };
}

/** The profile the person last sent with in the document, or null. */
async function lastProfile(documentId: string): Promise<string | null> {
  const response = await call(`/__kernel/state/people/me/profile/${encodeURIComponent(documentId)}`, { method: "GET" });
  if (!response.ok) return null;
  const body = record(await response.json().catch(() => ({})));
  return typeof body["profile"] === "string" ? body["profile"] : null;
}

/**
 * What the chip offers on a block (`BO_0311_011`): every profile by title,
 * those carrying a role the block or its document takes marked to be grouped
 * first, and the profile the person last sent with here — none on a profile
 * document's own chip, which starts at *No profile* (`BO_0298_Q9`).
 */
export async function choicesFor(documentId: string, blockId: string): Promise<GraphOutcome<ProfileChoices>> {
  const [listed, own, roles] = await Promise.all([listProfiles(), profileSummary(documentId), rolesOf(documentId)]);
  if (listed.outcome !== "success") return listed as GraphOutcome<never>;
  if (own.outcome !== "success") return own as GraphOutcome<never>;
  const taken = new Set<string>();
  if (roles.outcome === "success") {
    for (const role of roles.result.roles) taken.add(role.id);
    for (const role of roles.result.blocks.find((block) => block.blockId === blockId)?.roles ?? []) taken.add(role.id);
  }
  taken.delete(PROFILE_ROLE);
  const matching = new Set<string>();
  for (const role of taken) {
    const carrying = await documentsCarrying(role);
    if (carrying.outcome === "success") for (const document of carrying.result) matching.add(document.id);
  }
  const isProfile = own.result !== null;
  return {
    outcome: "success",
    result: {
      reachable: true,
      isProfile,
      profiles: listed.result.map((profile) => ({ ...profile, matches: matching.has(profile.id) })),
      last: isProfile ? null : await lastProfile(documentId),
    },
  };
}

/**
 * The migration `BO_0311_010` and `BO_0311_020` take on upgrade (`BO_0311_Q1`):
 * every profile takes *Profile* where it does not, and every document's
 * attached profile is dropped, so every chip starts at *No profile*. One
 * script, or an empty one once both stand. Idempotent.
 */
export async function profileInTheChip(): Promise<GraphOutcome<{ statement: string; parameters: Record<string, unknown>; rationale: string }>> {
  const [listed, carrying, slots] = await Promise.all([listProfiles(), documentsCarrying(PROFILE_ROLE), clearProfileSlotsStatement()]);
  if (listed.outcome !== "success") return listed as GraphOutcome<never>;
  if (carrying.outcome !== "success") return carrying as GraphOutcome<never>;
  if (slots.outcome !== "success") return slots as GraphOutcome<never>;
  const holding = new Set(carrying.result.map((document) => document.id));
  const statements: string[] = slots.result.statement === "" ? [] : [slots.result.statement];
  const parameters: Record<string, unknown> = { ...slots.result.parameters };
  listed.result
    .filter((profile) => !holding.has(profile.id))
    .forEach((profile, index) => {
      parameters[`r${index}from`] = nodeRef(profile.id);
      parameters[`r${index}to`] = nodeRef(PROFILE_ROLE);
      statements.push(`RELATE r${index}from -[r${index}:${HAS_BLOCK_ROLE}]-> r${index}to`);
    });
  return { outcome: "success", result: { statement: statements.join("; "), parameters, rationale: "every profile takes Profile, and no document keeps an attached profile" } };
}

/**
 * The migration `BO_0311_015` takes on upgrade: every document carrying
 * *Profile* without `record: profile` — given the role from its chip before
 * taking the role wrote the record — takes the record, so the chip, the run
 * start and the grant read it as the profile it is. One script, or an empty
 * one once every carrier holds it. Idempotent.
 */
export async function profileRecord(): ReturnType<typeof profileInTheChip> {
  const [listed, carrying] = await Promise.all([listProfiles(), documentsCarrying(PROFILE_ROLE)]);
  if (listed.outcome !== "success") return listed as GraphOutcome<never>;
  if (carrying.outcome !== "success") return carrying as GraphOutcome<never>;
  const recorded = new Set(listed.result.map((profile) => profile.id));
  const statements: string[] = [];
  const parameters: Record<string, unknown> = {};
  carrying.result
    .filter((document) => !recorded.has(document.id))
    .forEach((document, index) => {
      parameters[`p${index}NodeId`] = nodeRef(document.id);
      parameters[`p${index}_record`] = PROFILE_RECORD;
      statements.push(`SET p${index}.record = $p${index}_record`);
    });
  return { outcome: "success", result: { statement: statements.join("; "), parameters, rationale: "every document carrying Profile is a profile" } };
}

export const MIGRATIONS: Readonly<Record<string, () => ReturnType<typeof profileInTheChip>>> = {
  "profile-in-the-chip": profileInTheChip,
  "profile-record": profileRecord,
};

/** A new profile: a document carrying the record, with one empty block,
 * named as a new document is and renamed in the editor, taking the built-in
 * *Profile* so the Roles category lists it. BO_0298_014 BO_0311_010 */
export async function createProfile(title: string): ReturnType<typeof createDocument> {
  const created = await createDocument({ title: title.trim() === "" ? UNNAMED_PROFILE : title, record: PROFILE_RECORD });
  if (created.outcome === "success") await setRole({ documentId: created.result.documentId, role: PROFILE_ROLE, taken: true });
  return created;
}

