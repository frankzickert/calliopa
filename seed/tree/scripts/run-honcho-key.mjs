/**
 * Prints the `honcho` connection's stored key, or nothing when none is stored.
 *
 * It runs inside a container because the database is reachable by service name
 * on the Compose network rather than from the host, and it prints rather than
 * writes because the key must not land in a file: `pnpm run dev` reads it once
 * and hands it to Compose in the environment of the process it spawns.
 */
import postgres from "postgres";

import { decryptSecret, parseSecretsKey } from "../src/server/secrets.mjs";

const sql = postgres(process.env.CALLIOPA_DATABASE_URL ?? "", { max: 1 });
try {
  const [row] = await sql`select secret from connection where party = 'honcho'`;
  if (row?.secret != null) {
    process.stdout.write(
      decryptSecret(
        row.secret,
        parseSecretsKey(process.env.CALLIOPA_SECRETS_KEY ?? ""),
      ),
    );
  }
} catch {
  // No key, no row, no database, or a key that will not open: every one of
  // them means the same thing here, which is that memory does not run.
} finally {
  await sql.end();
}
