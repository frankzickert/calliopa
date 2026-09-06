import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Machine-caller identity. Plain ESM with a sibling declaration file, because
 * the operator script runs under bare Node while the Qwik server is compiled
 * TypeScript, and both must share one implementation of this behavior.
 *
 * Every function takes its SQL client, so no caller depends on how another one
 * reaches Postgres.
 */

export const TOKEN_PREFIX = "cak";
const SECRET_BYTES = 32;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function newSecret() {
  return randomBytes(SECRET_BYTES).toString("hex");
}

export function verifierFor(secret) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/**
 * A machine-generated secret carries 256 bits of entropy, so a digest is the
 * right verifier and a slow password KDF would only tax every request.
 */
export function verifies(secret, verifier) {
  const presented = Buffer.from(verifierFor(secret), "hex");
  const stored = Buffer.from(verifier, "hex");
  return (
    presented.length === stored.length && timingSafeEqual(presented, stored)
  );
}

export function formatToken(credentialId, secret) {
  return `${TOKEN_PREFIX}_${credentialId}_${secret}`;
}

/**
 * The credential id travels in the token because a stored digest cannot be
 * looked up by the secret itself.
 */
export function parseToken(token) {
  const parts = typeof token === "string" ? token.split("_") : [];
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
    return null;
  }
  const [, credentialId, secret] = parts;
  if (!UUID.test(credentialId) || !/^[0-9a-f]{64}$/u.test(secret)) {
    return null;
  }
  return { credentialId, secret };
}

export function bearerToken(header) {
  const match = /^Bearer (\S+)$/u.exec(typeof header === "string" ? header : "");
  return match ? match[1] : null;
}

/**
 * The classes a client may hold. A `writer` reaches the graph's own mutations;
 * a `proposer` may only stage, which the graph gateway enforces at its own
 * boundary. Neither is a permission over records.
 */
export const IDENTITY_CLASSES = Object.freeze(["writer", "proposer"]);

function identityClassOf(value) {
  if (!IDENTITY_CLASSES.includes(value)) {
    throw new Error(
      `An identity class is ${IDENTITY_CLASSES.join(" or ")}, not ${String(value)}.`,
    );
  }
  return value;
}

export async function listClients(sql) {
  return sql`
    select c.id, c.name, c.state, c.identity_class, c.created_at, c.updated_at,
           k.id as credential_id, k.issued_at, k.expires_at, k.last_used_at
      from api_client c
      left join api_credential k
        on k.client_id = c.id and k.is_current
     order by c.name
  `;
}

export async function createClient(sql, name, { identityClass = "writer" } = {}) {
  const trimmed = String(name ?? "").trim();
  if (trimmed === "") {
    throw new Error("A client needs a name.");
  }
  const [client] = await sql`
    insert into api_client (name, identity_class)
    values (${trimmed}, ${identityClassOf(identityClass)})
    returning id, name, state, identity_class, created_at, updated_at
  `;
  return client;
}

/**
 * Moves a client between proposing and writing. It is a change to a record
 * that already exists, so it takes effect on the caller's next request without
 * a redeploy, as suspension already does.
 */
export async function setClientClass(sql, clientId, identityClass) {
  const [client] = await sql`
    update api_client
       set identity_class = ${identityClassOf(identityClass)}, updated_at = now()
     where id = ${clientId} and state <> 'revoked'
    returning id, name, state, identity_class
  `;
  if (!client) {
    throw new Error(`No client ${clientId} that is not revoked.`);
  }
  return client;
}

/**
 * Issuing is also rotating: the predecessor stops being current in the same
 * transaction, so a client never has two live credentials.
 */
export async function issueCredential(sql, clientId, { expiresAt = null } = {}) {
  const secret = newSecret();
  return sql.begin(async (tx) => {
    const [client] = await tx`
      select id, state from api_client where id = ${clientId} for update
    `;
    if (!client) {
      throw new Error(`No client ${clientId}.`);
    }
    if (client.state === "revoked") {
      throw new Error("A revoked client cannot be issued a credential.");
    }
    await tx`
      update api_credential set is_current = false
       where client_id = ${clientId} and is_current
    `;
    const [credential] = await tx`
      insert into api_credential (client_id, verifier, expires_at)
      values (${clientId}, ${verifierFor(secret)}, ${expiresAt})
      returning id, issued_at, expires_at
    `;
    await tx`update api_client set updated_at = now() where id = ${clientId}`;
    return { ...credential, token: formatToken(credential.id, secret) };
  });
}

async function moveTo(sql, clientId, from, to) {
  const [client] = await sql`
    update api_client set state = ${to}, updated_at = now()
     where id = ${clientId} and state = any(${from})
    returning id, name, state, identity_class
  `;
  if (!client) {
    throw new Error(`No client ${clientId} in state ${from.join(" or ")}.`);
  }
  return client;
}

export async function suspendClient(sql, clientId) {
  return moveTo(sql, clientId, ["active"], "suspended");
}

export async function resumeClient(sql, clientId) {
  return moveTo(sql, clientId, ["suspended"], "active");
}

/** Terminal. The credential dies with the client and neither comes back. */
export async function revokeClient(sql, clientId) {
  return sql.begin(async (tx) => {
    const client = await moveTo(tx, clientId, ["active", "suspended"], "revoked");
    await tx`
      update api_credential set is_current = false
       where client_id = ${clientId} and is_current
    `;
    return client;
  });
}

const REFUSED = Object.freeze({ ok: false });

/**
 * Resolves a request's caller. Every failure returns the identical outcome, so
 * a caller learns nothing about which part of its credential was wrong.
 *
 * The resolved caller carries its identity class, so a consumer deciding what
 * this caller may do reads it here rather than querying the record again.
 */
export async function resolveCaller(sql, authorizationHeader, now = new Date()) {
  const token = bearerToken(authorizationHeader);
  const parsed = token === null ? null : parseToken(token);
  if (parsed === null) {
    return REFUSED;
  }

  const [row] = await sql`
    select k.id, k.verifier, k.expires_at, c.id as client_id, c.state,
           c.identity_class
      from api_credential k
      join api_client c on c.id = k.client_id
     where k.id = ${parsed.credentialId} and k.is_current
  `;
  if (!row || row.state !== "active") {
    return REFUSED;
  }
  if (row.expires_at !== null && row.expires_at <= now) {
    return REFUSED;
  }
  if (!verifies(parsed.secret, row.verifier)) {
    return REFUSED;
  }

  await sql`
    update api_credential set last_used_at = now() where id = ${row.id}
  `;
  return {
    ok: true,
    clientId: row.client_id,
    identityClass: row.identity_class,
  };
}
