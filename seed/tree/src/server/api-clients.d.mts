import type postgres from "postgres";

export type ClientState = "active" | "suspended" | "revoked";

/** Whether a client may write truth directly or may only stage a proposal. */
export type ClientIdentityClass = "writer" | "proposer";

export interface ApiClient {
  readonly id: string;
  readonly name: string;
  readonly state: ClientState;
  readonly identity_class: ClientIdentityClass;
}

export interface ApiClientRow extends ApiClient {
  readonly created_at: Date;
  readonly updated_at: Date;
  readonly credential_id: string | null;
  readonly issued_at: Date | null;
  readonly expires_at: Date | null;
  readonly last_used_at: Date | null;
}

export interface IssuedCredential {
  readonly id: string;
  readonly issued_at: Date;
  readonly expires_at: Date | null;
  /** Shown once. Only its verifier is stored. */
  readonly token: string;
}

export type Caller =
  | { ok: true; clientId: string; identityClass: ClientIdentityClass }
  | { ok: false };

export const TOKEN_PREFIX: string;
export const IDENTITY_CLASSES: readonly ClientIdentityClass[];

export function newSecret(): string;
export function verifierFor(secret: string): string;
export function verifies(secret: string, verifier: string): boolean;
export function formatToken(credentialId: string, secret: string): string;
export function parseToken(
  token: unknown,
): { credentialId: string; secret: string } | null;
export function bearerToken(header: unknown): string | null;

export function listClients(sql: postgres.Sql): Promise<ApiClientRow[]>;
export function createClient(
  sql: postgres.Sql,
  name: string,
  options?: { identityClass?: ClientIdentityClass },
): Promise<ApiClient>;
export function setClientClass(
  sql: postgres.Sql,
  clientId: string,
  identityClass: ClientIdentityClass,
): Promise<ApiClient>;
export function issueCredential(
  sql: postgres.Sql,
  clientId: string,
  options?: { expiresAt?: Date | null },
): Promise<IssuedCredential>;
export function suspendClient(
  sql: postgres.Sql,
  clientId: string,
): Promise<ApiClient>;
export function resumeClient(
  sql: postgres.Sql,
  clientId: string,
): Promise<ApiClient>;
export function revokeClient(
  sql: postgres.Sql,
  clientId: string,
): Promise<ApiClient>;
/** Resolving a caller only reads, so it works inside a transaction too. */
export function resolveCaller(
  sql: postgres.Sql | postgres.TransactionSql,
  authorizationHeader: unknown,
  now?: Date,
): Promise<Caller>;
