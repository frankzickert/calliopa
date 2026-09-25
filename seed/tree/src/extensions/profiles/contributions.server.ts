import { serverContributions as declare, type ApiRoute } from "~/contract";
import { HttpError } from "~/server/http-error";
import { respond } from "~/server/outcome";
import { isRecordId } from "~/server/uuid";
import { PROFILE_RECORD, type ProfileSummary } from "~/extensions/documents/lib/profile";
import { UNNAMED_PROFILE } from "~/extensions/documents/lib/naming";
import { createDocument, listProfiles, readProfileSelection, setProfile } from "~/extensions/documents/server/documents";

/**
 * The server half of `profiles` (`BO_0298_014`, `BO_0298_015`): the listing
 * the Profiles section is handed, the create — a document carrying
 * `record: profile`, minted unnamed and renamed in the editor — and a
 * document's selection, read and written. The writes and reads themselves
 * are `documents`' exported functions, since the properties are declared on
 * its `document` type; this half is the routes. Only server code imports
 * this module.
 */

/** What the Profiles section is handed: the profiles, or that the graph did not answer. */
export interface ProfilesListing {
  readonly reachable: boolean;
  readonly profiles: readonly ProfileSummary[];
}

const record = (value: unknown): Record<string, unknown> => (typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {});

const readers = {
  profiles: async (): Promise<ProfilesListing> => {
    const listed = await listProfiles();
    return listed.outcome === "success" ? { reachable: true, profiles: listed.result } : { reachable: false, profiles: [] };
  },
};

const documentOf = (params: Readonly<Record<string, string>>): string => {
  const id = params["id"] ?? "";
  if (!isRecordId(id)) throw new HttpError(404, "no such document");
  return id;
};

const routes: readonly ApiRoute[] = [
  {
    // A new profile: a document carrying the record, with one empty block,
    // named as a new document is and renamed in the editor. BO_0298_014
    method: "POST",
    path: "profiles",
    handle: async (event) => {
      const body = record(await event.request.json().catch(() => ({})));
      const title = typeof body["title"] === "string" && body["title"].trim() !== "" ? body["title"] : UNNAMED_PROFILE;
      const { status, body: answer } = respond(await createDocument({ title, record: PROFILE_RECORD }));
      event.json(status === 200 ? 201 : status, answer);
    },
  },
  {
    method: "GET",
    path: "documents/[id]/selection",
    handle: async (event, params) => {
      const { status, body } = respond(await readProfileSelection(documentOf(params)));
      event.json(status, body);
    },
  },
  {
    // The person's choice in the selector: a profile's id, or null for *No
    // profile*, written at once as truth. BO_0298_015
    method: "POST",
    path: "documents/[id]/selection",
    handle: async (event, params) => {
      const documentId = documentOf(params);
      const body = record(await event.request.json().catch(() => ({})));
      const profile = body["profile"];
      if (profile !== null && (typeof profile !== "string" || !isRecordId(profile))) {
        throw new HttpError(400, "a selection names a profile by its id, or null for no profile");
      }
      const { status, body: answer } = respond(await setProfile({ documentId, profile }));
      event.json(status, answer);
    },
  },
];

export const contributions = declare({ readers, routes });
