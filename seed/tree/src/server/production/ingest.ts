import { createHash } from "node:crypto";

import type postgres from "postgres";

import type { GraphOutcome } from "../graph/contract";
import { putObject } from "../object-store";
import { readMediaFacts } from "./media-facts";
import { recordRendition } from "./production";

/**
 * The ingest path: a file in, its bytes content-addressed into Garage, its
 * machine facts read off it, and a rendition recorded for it.
 *
 * This is one of the two permanent ways media arrives. Calliopa ingests
 * externally produced exports today and will produce them itself; external
 * upload stays the fallback either way, so nothing here is scaffolding and no
 * reader of a rendition can tell which path a file took beyond its recorded
 * provenance.
 */

export interface IngestedRendition {
  readonly renditionId: string;
  readonly objectId: string;
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
  readonly contentType: string;
  readonly durationSeconds: number | null;
  readonly dataRevision: string;
}

/** The content's SHA-256 in lowercase hex, which is what an object id is. */
export const objectIdOf = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

/**
 * Puts one export in the store and records it against its asset.
 *
 * The facts are read before anything is written, so a file this build cannot
 * read leaves neither an object nor a rendition behind.
 */
export async function ingestRendition(
  db: postgres.Sql,
  input: {
    readonly assetId: string;
    readonly bytes: Uint8Array;
    readonly provenance?: "ingested" | "produced";
  },
): Promise<GraphOutcome<IngestedRendition>> {
  const facts = readMediaFacts(input.bytes);
  if (!facts.ok) {
    return {
      outcome: "validationFailure",
      failures: [{ operation: null, rule: "unreadableMedia", detail: facts.detail }],
    };
  }

  const objectId = objectIdOf(input.bytes);
  await putObject({
    objectId,
    bytes: input.bytes,
    contentType: facts.facts.contentType,
  });

  const written = await recordRendition(db, {
    assetId: input.assetId,
    rendition: {
      objectId,
      width: facts.facts.width,
      height: facts.facts.height,
      byteSize: input.bytes.byteLength,
      contentType: facts.facts.contentType,
      provenance: input.provenance ?? "ingested",
    },
  });
  if (written.outcome !== "success") return written as GraphOutcome<IngestedRendition>;

  return {
    outcome: "success",
    result: {
      renditionId: written.result.renditionId,
      objectId,
      width: facts.facts.width,
      height: facts.facts.height,
      byteSize: input.bytes.byteLength,
      contentType: facts.facts.contentType,
      durationSeconds: facts.facts.durationSeconds ?? null,
      dataRevision: written.result.dataRevision,
    },
  };
}
