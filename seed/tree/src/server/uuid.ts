import { HttpError } from "./http-error";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Whether a value is one of this application's logical record identifiers. */
export function isRecordId(id: string): boolean {
  return UUID.test(id);
}

/**
 * Postgres rejects a malformed uuid with a server error, so an unknown
 * identifier is answered as a missing record before it reaches a query.
 */
export function assertRecordId(id: string, kind: string): string {
  if (!isRecordId(id)) throw new HttpError(404, `no ${kind} ${id}`);
  return id;
}
