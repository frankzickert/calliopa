import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import postgres from "postgres";

/**
 * The tree's schema, applied by the tree itself. Migrations live in
 * `migrations/` and, for a feature that is its own extension, in
 * `src/extensions/<id>/migrations/`; they are one sequence ordered by file
 * name across every directory, applied once each and recorded in
 * `schema_migrations`. BO_0200_011 BO_0200_012
 */
export function migrationFiles(root) {
  const dirs = [join(root, "migrations")];
  const extensions = join(root, "src", "extensions");
  if (existsSync(extensions)) {
    for (const entry of readdirSync(extensions, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const dir = join(extensions, entry.name, "migrations");
        if (existsSync(dir)) {
          dirs.push(dir);
        }
      }
    }
  }
  const files = [];
  for (const dir of dirs) {
    for (const name of readdirSync(dir)) {
      if (name.endsWith(".sql")) {
        files.push({ version: name.replace(/\.sql$/u, ""), path: join(dir, name) });
      }
    }
  }
  files.sort((a, b) => (a.version < b.version ? -1 : a.version > b.version ? 1 : 0));
  return files;
}

export async function applyMigrations(root, databaseUrl, log = () => undefined) {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => undefined });
  try {
    const [{ present }] = await sql`
      select to_regclass('public.schema_migrations') is not null as present
    `;
    const applied = new Set(
      present
        ? (await sql`select version from schema_migrations`).map((row) => row.version)
        : [],
    );
    let count = 0;
    for (const { version, path } of migrationFiles(root)) {
      if (applied.has(version)) {
        continue;
      }
      const statements = readFileSync(path, "utf8");
      try {
        await sql.begin(async (transaction) => {
          await transaction.unsafe(statements);
          await transaction`insert into schema_migrations (version) values (${version})`;
        });
      } catch (error) {
        log(`failed applying ${version}`);
        throw error;
      }
      log(`applied ${version}`);
      count += 1;
    }
    return count;
  } finally {
    await sql.end();
  }
}
