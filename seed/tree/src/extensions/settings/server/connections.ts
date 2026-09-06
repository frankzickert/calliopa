import type postgres from "postgres";

import {
  configurationRefusal,
  isChannelParty,
  isConnectionParty,
  type AgentStatus,
  type ConnectionKind,
  type ConnectionParty,
  type ConnectionRecord,
  type ConnectionState,
  type RuntimeStatus,
} from "~/lib/connections";
import { agentStatus, runtimeStatuses } from "./adapters";
import { testConnection } from "./connection-tests";
import { HttpError } from "~/server/http-error";
import { decryptSecret, encryptSecret, parseSecretsKey } from "~/server/secrets.mjs";

/**
 * The store over the connection rows. Reading connections never decrypts: the
 * state and the stored suffix answer everything the settings surface shows, and
 * the one place a plaintext secret leaves this module is `connectionSecret`,
 * which server code calls to reach the party.
 */

const SUFFIX_LENGTH = 4;

/**
 * The key is handed in the way the SQL client is, so no caller depends on how
 * another reaches it and a test can run against a key of its own. This reads
 * the one variable it needs rather than the whole application environment,
 * which is validated at server startup and is not available everywhere the
 * store is.
 */
export function secretsKey(
  source: Record<string, string | undefined> = process.env,
): Buffer {
  return parseSecretsKey(source.CALLIOPA_SECRETS_KEY ?? "");
}

interface ConnectionRow {
  readonly party: string;
  readonly kind: string;
  readonly secret: string | null;
  readonly secret_suffix: string | null;
  readonly configuration: Record<string, string>;
  readonly state: string;
  readonly last_tested_at: Date | null;
  readonly last_error: string | null;
}

function asRecord(row: ConnectionRow): ConnectionRecord {
  return withConfiguration({
    party: row.party as ConnectionParty,
    kind: row.kind as ConnectionKind,
    state: row.state as ConnectionState,
    keySet: row.secret !== null,
    secretSuffix: row.secret_suffix,
    configuration: row.configuration ?? {},
    lastTestedAt: row.last_tested_at?.toISOString() ?? null,
    lastError: row.last_error,
    status: null,
    agent: null,
  });
}

/**
 * A channel that cannot be reached yet is `unconfigured`, whatever its key.
 *
 * The stored state answers what happened to the secret; whether the channel is
 * usable also depends on the configuration beside it. Reading is where the two
 * are put together, for the reason a status row's state is read live: a second
 * copy of a derivable fact is a copy that can disagree.
 */
function withConfiguration(record: ConnectionRecord): ConnectionRecord {
  if (!isChannelParty(record.party)) return record;
  const refusal = configurationRefusal(record.party, record.configuration);
  if (refusal === null) return record;
  return { ...record, state: "unconfigured", lastError: refusal };
}

/**
 * Lays what the agent reports over a status row.
 *
 * A status row's state is not stored: the runtime's own answer is the truth,
 * and a copy in the database would be a second account of it that can go stale.
 * It is expressed in the states every connection already has, so the surface
 * reads one vocabulary rather than two.
 */
export function withStatus(
  record: ConnectionRecord,
  reported: Record<string, RuntimeStatus>,
  stamped: AgentStatus | null,
): ConnectionRecord {
  if (record.kind !== "status") return record;
  if (record.party === "hermes") return asAgent(record, reported, stamped);

  const status = reported[record.party] ?? null;
  if (status === null) {
    return {
      ...record,
      state: "unconfigured",
      lastError: "The agent has not reported on this runtime.",
      status: null,
    };
  }
  if (!status.installed) {
    return {
      ...record,
      state: "failing",
      lastError: "This runtime is not installed in the agent container.",
      status,
    };
  }
  return {
    ...record,
    state: status.authenticated ? "verified" : "unconfigured",
    lastError: null,
    status,
  };
}

/**
 * The agent's own row, which is not a runtime and is not asked about like one.
 *
 * What it reports is what the agent stamped about the start it is running, laid
 * over what its reasoning runtime says about itself: the agent is doing its
 * work when that runtime is signed in and the toolset reached it. A toolset
 * missing while a credential is held is a registration that failed, which is a
 * different thing to tell a reader than a credential nobody has issued yet.
 * CA_0026_002
 */
function asAgent(
  record: ConnectionRecord,
  reported: Record<string, RuntimeStatus>,
  stamped: AgentStatus | null,
): ConnectionRecord {
  if (stamped === null) {
    return {
      ...record,
      state: "unconfigured",
      lastError: "The agent is not running.",
      status: null,
      agent: null,
    };
  }
  const reasoning = reported[stamped.runtime]?.authenticated ?? false;
  if (stamped.credential && !stamped.toolset) {
    return {
      ...record,
      state: "failing",
      lastError: "The agent holds a credential its toolset was not registered with.",
      status: null,
      agent: stamped,
    };
  }
  return {
    ...record,
    state: reasoning && stamped.toolset ? "verified" : "unconfigured",
    lastError: null,
    status: null,
    agent: stamped,
  };
}

/** A party the application does not know is refused before any row is touched. */
export function assertParty(party: string): ConnectionParty {
  if (!isConnectionParty(party)) {
    throw new HttpError(404, `unknown connection ${party}`);
  }
  return party;
}

export async function listConnections(
  sql: postgres.Sql | postgres.TransactionSql,
): Promise<ConnectionRecord[]> {
  const rows = await sql<ConnectionRow[]>`
    select party, kind, secret, secret_suffix, configuration, state, last_tested_at, last_error
    from connection
    order by kind, party
  `;
  const status = rows.some((row) => row.kind === "status");
  const reported = status ? await runtimeStatuses() : {};
  const stamped = status ? await agentStatus() : null;
  return rows.map((row) => withStatus(asRecord(row), reported, stamped));
}

export async function readConnection(
  sql: postgres.Sql | postgres.TransactionSql,
  party: string,
): Promise<ConnectionRecord> {
  const name = assertParty(party);
  const [row] = await sql<ConnectionRow[]>`
    select party, kind, secret, secret_suffix, configuration, state, last_tested_at, last_error
    from connection
    where party = ${name}
  `;
  if (row === undefined) {
    throw new HttpError(404, `unknown connection ${party}`);
  }
  return asRecord(row);
}

/**
 * Saving a key encrypts it, records its last characters, and returns the row to
 * `configured`: what a previous test said is no longer about the key that is
 * stored now.
 */
export async function saveConnectionSecret(
  sql: postgres.Sql,
  key: Buffer,
  party: string,
  plain: string,
): Promise<ConnectionRecord> {
  const name = assertParty(party);
  const secret = plain.trim();
  if (secret === "") {
    throw new HttpError(400, "a key is required");
  }
  const [row] = await sql<ConnectionRow[]>`
    update connection set
      secret = ${encryptSecret(secret, key)},
      secret_suffix = ${secret.slice(-SUFFIX_LENGTH)},
      state = 'configured',
      last_tested_at = null,
      last_error = null,
      updated_at = now()
    where party = ${name}
    returning party, kind, secret, secret_suffix, configuration, state, last_tested_at, last_error
  `;
  if (row === undefined) {
    throw new HttpError(404, `unknown connection ${party}`);
  }
  return asRecord(row);
}

/**
 * Saving a channel's configuration. It is refused where it is parsed rather
 * than later inside a request, and it never touches the secret: an address is
 * changed without retyping a token that has not changed.
 */
export async function saveConnectionConfiguration(
  sql: postgres.Sql,
  party: string,
  configuration: Readonly<Record<string, string>>,
): Promise<ConnectionRecord> {
  const name = assertParty(party);
  const trimmed = Object.fromEntries(
    Object.entries(configuration).map(([field, value]) => [field, value.trim()]),
  );
  const refusal = configurationRefusal(name, trimmed);
  if (refusal !== null) {
    throw new HttpError(400, refusal);
  }
  const [row] = await sql<ConnectionRow[]>`
    update connection set
      configuration = ${sql.json(trimmed)},
      updated_at = now()
    where party = ${name}
    returning party, kind, secret, secret_suffix, configuration, state, last_tested_at, last_error
  `;
  if (row === undefined) {
    throw new HttpError(404, `unknown connection ${party}`);
  }
  return asRecord(row);
}

export async function clearConnectionSecret(
  sql: postgres.Sql,
  party: string,
): Promise<ConnectionRecord> {
  const name = assertParty(party);
  const [row] = await sql<ConnectionRow[]>`
    update connection set
      secret = null,
      secret_suffix = null,
      state = 'unconfigured',
      last_tested_at = null,
      last_error = null,
      updated_at = now()
    where party = ${name}
    returning party, kind, secret, secret_suffix, configuration, state, last_tested_at, last_error
  `;
  if (row === undefined) {
    throw new HttpError(404, `unknown connection ${party}`);
  }
  return asRecord(row);
}

/**
 * What the party answered. A connection with no stored key is never tested, so
 * an outcome always belongs to a key that was actually presented.
 */
export async function recordTestOutcome(
  sql: postgres.Sql,
  party: string,
  error: string | null,
): Promise<ConnectionRecord> {
  const name = assertParty(party);
  const [row] = await sql<ConnectionRow[]>`
    update connection set
      state = ${error === null ? "verified" : "failing"},
      last_tested_at = now(),
      last_error = ${error},
      updated_at = now()
    where party = ${name} and secret is not null
    returning party, kind, secret, secret_suffix, configuration, state, last_tested_at, last_error
  `;
  if (row === undefined) {
    throw new HttpError(409, `${party} has no key stored`);
  }
  return asRecord(row);
}

/**
 * The one accessor server code reaches a party's credential through. Nothing
 * reads a party's key from `process.env`: the environment carries the key that
 * opens secrets, not the secrets.
 */
export async function connectionSecret(
  sql: postgres.Sql | postgres.TransactionSql,
  key: Buffer,
  party: string,
): Promise<string | null> {
  const name = assertParty(party);
  const [row] = await sql<{ secret: string | null }[]>`
    select secret from connection where party = ${name}
  `;
  return row?.secret == null ? null : decryptSecret(row.secret, key);
}

/**
 * The request-facing half. It takes the SQL client and the key the way the
 * store does, so a route supplies them and a test supplies its own; nothing
 * about how either is found is buried where it cannot be reached.
 */

export async function writeConnectionSecret(
  sql: postgres.Sql,
  key: Buffer,
  party: string,
  body: unknown,
): Promise<ConnectionRecord> {
  const fields =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const configuration = asConfiguration(fields.configuration);
  if (typeof fields.secret !== "string" && configuration === null) {
    throw new HttpError(400, "a key is required");
  }
  // The configuration goes first, so a request carrying both leaves a row that
  // is either wholly the new one or wholly the old: a refused address never
  // lands beside a key that was accepted.
  let record =
    configuration === null
      ? await readConnection(sql, party)
      : await saveConnectionConfiguration(sql, party, configuration);
  if (typeof fields.secret === "string") {
    record = await saveConnectionSecret(sql, key, party, fields.secret);
  }
  return record;
}

/** The configuration a request carried, or `null` when it carried none. */
function asConfiguration(
  value: unknown,
): Readonly<Record<string, string>> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.some(([, field]) => typeof field !== "string")) {
    throw new HttpError(400, "configuration values must be text");
  }
  return Object.fromEntries(entries) as Record<string, string>;
}

/**
 * Proving a connection: the stored key against the real party. A connection
 * with no key is refused rather than reported as failing, because there is
 * nothing to have been refused.
 */
export async function proveConnection(
  sql: postgres.Sql,
  key: Buffer,
  party: string,
): Promise<ConnectionRecord> {
  const name = assertParty(party);
  const secret = await connectionSecret(sql, key, name);
  if (secret === null) {
    throw new HttpError(409, `${name} has no key stored`);
  }
  // A channel with nowhere to send the request is refused rather than reported
  // as failing, for the reason a row with no key is: nothing was refused.
  const { configuration } = await readConnection(sql, name);
  const refusal = configurationRefusal(name, configuration);
  if (refusal !== null) {
    throw new HttpError(409, refusal);
  }
  return recordTestOutcome(
    sql,
    name,
    await testConnection(name, secret, configuration),
  );
}
