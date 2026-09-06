import type postgres from "postgres";

import { resolveCaller, type Caller } from "./api-clients.mjs";
import { db } from "./db";

/**
 * The external API's authentication boundary. Consumers depend on the resolved
 * caller, never on how it was proven. The client is a parameter for the same
 * reason it is one throughout `api-clients`: nothing here depends on how
 * another caller reaches Postgres.
 */
export async function resolveRequestCaller(
  request: Request,
  sql: postgres.Sql = db(),
): Promise<Caller> {
  return resolveCaller(sql, request.headers.get("authorization"));
}
