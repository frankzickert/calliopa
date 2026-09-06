import postgres from "postgres";

import { appEnv } from "./env";

let client: postgres.Sql | undefined;

export function db(): postgres.Sql {
  client ??= postgres(appEnv().databaseUrl, { onnotice: () => undefined });
  return client;
}
