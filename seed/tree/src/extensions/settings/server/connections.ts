import {
  configurationRefusal,
  reasoningParty,
  type AgentStatus,
  type ConnectionRecord,
  type ConnectionState,
  type RuntimeStatus,
} from "~/lib/connections";
import { HttpError } from "~/server/http-error";
import { kernelSecrets, type PartyView } from "~/server/kernel/client";
import type { RegisteredParty } from "~/registry";
import { parties, partyOf } from "~/server/registry";
import { agentStatus, apiKeyModelConfigured, runtimeStatuses } from "~/server/agent/adapters";

/**
 * The store over the parties, kept by the kernel (`ui-kernel.md`,
 * `BO_0207_003`). Reading never reaches a secret: the kernel answers state,
 * configuration and whether a key is set with its last characters, which is
 * everything the settings surface shows, and nothing in this module or in any
 * shell code holds a plaintext value. Proving a party is the kernel running
 * the party's probe; presenting a key to a party is the kernel brokering the
 * request. `BO_0207_013`
 */

/**
 * Which secret field a party's key is. Every key-holding party today has one
 * key, named the same, so the settings surface's one write-only field maps to
 * it. What proving a party means is the party's contributed probe, handed to
 * the kernel with every save (`BO_0202_008`).
 */
const SECRET_FIELD = "apiKey";

const STATES: readonly string[] = ["unconfigured", "configured", "verified", "failing"];

/**
 * A record over the kernel's view of a party and the descriptor the party's
 * extension contributed: what the surface shows of a party — its label, its
 * purpose, whether it is a channel and the fields it holds — travels with the
 * record, so the browser holds no roster of its own. BO_0202_008
 */
function asRecord(party: RegisteredParty, view: PartyView): ConnectionRecord {
  const key = view.secretFields[SECRET_FIELD];
  const kind = party.credential;
  return withConfiguration(party, {
    party: party.id,
    kind,
    label: party.label,
    purpose: party.purpose,
    channel: party.kind === "channel",
    fields: party.fields,
    state:
      kind === "status"
        ? "unconfigured"
        : STATES.includes(view.state)
          ? (view.state as ConnectionState)
          : "unconfigured",
    keySet: key?.set ?? false,
    secretSuffix: key?.set ? (key.suffix ?? null) : null,
    configuration: view.configuration ?? {},
    lastTestedAt: view.lastTestedAt ?? null,
    lastError: view.lastError ?? null,
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
function withConfiguration(party: RegisteredParty, record: ConnectionRecord): ConnectionRecord {
  if (party.kind !== "channel") return record;
  const refusal = configurationRefusal(party, record.configuration);
  if (refusal === null) return record;
  return { ...record, state: "unconfigured", lastError: refusal };
}

/**
 * Lays what the agent reports over a status row.
 *
 * A status row's state is not stored: the runtime's own answer is the truth,
 * and a copy would be a second account of it that can go stale. It is
 * expressed in the states every connection already has, so the surface reads
 * one vocabulary rather than two.
 */
export function withStatus(
  record: ConnectionRecord,
  reported: Record<string, RuntimeStatus>,
  stamped: AgentStatus | null,
  apiKeyModel = false,
): ConnectionRecord {
  if (record.kind !== "status") return record;
  if (record.party === "hermes") return asAgent(record, reported, stamped, apiKeyModel);

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
  apiKeyModel = false,
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
  const reasoning = reported[reasoningParty(stamped)]?.authenticated ?? false;
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
    apiKeyModel,
  };
}

/**
 * A party nothing contributes is refused before anything is asked. A record
 * the kernel still holds for one is kept and not shown, as the listing
 * already did for an unknown party. BO_0202_008
 */
export function assertParty(party: string): RegisteredParty {
  const registered = partyOf(party);
  if (registered === undefined) {
    throw new HttpError(404, `unknown connection ${party}`);
  }
  return registered;
}

/**
 * Every contributed party, by credential kind then name: the roster is the
 * registry's, so a party the kernel holds nothing for still lists,
 * unconfigured.
 */
export async function listConnections(): Promise<ConnectionRecord[]> {
  const roster = [...parties()].sort((left, right) =>
    left.credential === right.credential
      ? left.id.localeCompare(right.id)
      : left.credential.localeCompare(right.credential),
  );
  const records = await Promise.all(
    roster.map(async (party) => asRecord(party, await kernelSecrets.read(party.id))),
  );
  const status = records.some((record) => record.kind === "status");
  const reported = status ? await runtimeStatuses() : {};
  const stamped = status ? await agentStatus() : null;
  const apiKeyModel = status ? await apiKeyModelConfigured() : false;
  return records.map((record) => withStatus(record, reported, stamped, apiKeyModel));
}

export async function readConnection(party: string): Promise<ConnectionRecord> {
  const registered = assertParty(party);
  return asRecord(registered, await kernelSecrets.read(registered.id));
}

/**
 * Saving a key hands it to the kernel, which records its last characters and
 * returns the party to `configured`: what a previous test said is no longer
 * about the key that is stored now. The party's probe and authorization travel
 * with every save, so the kernel always holds the current spec.
 */
export async function saveConnectionSecret(
  party: string,
  plain: string,
): Promise<ConnectionRecord> {
  const registered = assertParty(party);
  const secret = plain.trim();
  if (secret === "") {
    throw new HttpError(400, "a key is required");
  }
  if (registered.credential !== "apiKey") {
    throw new HttpError(400, `${registered.id} takes no key`);
  }
  const spec = registered.probe;
  return asRecord(
    registered,
    await kernelSecrets.write(registered.id, {
      kind: registered.credential,
      secrets: { [SECRET_FIELD]: secret },
      ...(spec === undefined ? {} : { authorization: spec.authorization, test: spec.test }),
    }),
  );
}

/**
 * Saving a channel's configuration. It is refused where it is parsed rather
 * than later inside a request, and it never touches the secret: an address is
 * changed without retyping a token that has not changed.
 */
export async function saveConnectionConfiguration(
  party: string,
  configuration: Readonly<Record<string, string>>,
): Promise<ConnectionRecord> {
  const registered = assertParty(party);
  const trimmed = Object.fromEntries(
    Object.entries(configuration).map(([field, value]) => [field, value.trim()]),
  );
  const refusal = configurationRefusal(registered, trimmed);
  if (refusal !== null) {
    throw new HttpError(400, refusal);
  }
  const spec = registered.probe;
  return asRecord(
    registered,
    await kernelSecrets.write(registered.id, {
      kind: registered.credential,
      configuration: trimmed,
      ...(spec === undefined ? {} : { authorization: spec.authorization, test: spec.test }),
    }),
  );
}

/** Clearing removes the stored secret and returns the party to `unconfigured`. */
export async function clearConnectionSecret(party: string): Promise<ConnectionRecord> {
  const registered = assertParty(party);
  await kernelSecrets.remove(registered.id);
  return asRecord(registered, await kernelSecrets.read(registered.id));
}

/**
 * The request-facing half: a request carrying a configuration, a key, or
 * both. The configuration goes first, so a request carrying both leaves a
 * record that is either wholly the new one or wholly the old: a refused
 * address never lands beside a key that was accepted.
 */
export async function writeConnectionSecret(
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
  let record =
    configuration === null
      ? await readConnection(party)
      : await saveConnectionConfiguration(party, configuration);
  if (typeof fields.secret === "string") {
    record = await saveConnectionSecret(party, fields.secret);
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
 * Proving a connection: the kernel presents the stored key to the real party.
 * A connection with no key is refused rather than reported as failing, because
 * there is nothing to have been refused; a channel with nowhere to send the
 * request is refused for the same reason.
 */
export async function proveConnection(party: string): Promise<ConnectionRecord> {
  const registered = assertParty(party);
  const current = await readConnection(registered.id);
  if (!current.keySet) {
    throw new HttpError(409, `${registered.id} has no key stored`);
  }
  const refusal = configurationRefusal(registered, current.configuration);
  if (refusal !== null) {
    throw new HttpError(409, refusal);
  }
  if (registered.probe === undefined) {
    throw new HttpError(409, `${registered.id} holds no key to test.`);
  }
  await kernelSecrets.test(registered.id);
  return readConnection(registered.id);
}
