import { applyMigrations } from "./lib/migrations.mjs";

const root = new URL("../", import.meta.url).pathname;
const databaseUrl = process.env.CALLIOPA_DATABASE_URL;

if (!databaseUrl) {
  process.stderr.write("CALLIOPA_DATABASE_URL is not set.\n");
  process.exit(1);
}

const count = await applyMigrations(root, databaseUrl, (line) =>
  process.stdout.write(`${line}\n`),
);
process.stdout.write(
  count === 0 ? "no pending migrations\n" : `${count} migration(s) applied\n`,
);
