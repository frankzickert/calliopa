import type { ConfigurationField } from "~/contract";

/**
 * Connections are the outbound half of credentials: one record per external
 * party Calliopa presents a credential to. The inbound half — who is calling
 * Calliopa — is the core's (`BO_0206`) and is unrelated to this.
 *
 * The set of parties is application source, not user data. A party arrives with
 * the change that needs it; nothing adds, renames, or removes one at runtime.
 */

export const CONNECTION_STATES = [
  "unconfigured",
  "configured",
  "verified",
  "failing",
] as const;
export type ConnectionState = (typeof CONNECTION_STATES)[number];

/**
 * The parties are contributions: each extension's server half declares the
 * parties it presents a credential to, and the registry is the roster
 * (`BO_0202_008`). The settings surface reads what it needs of a descriptor —
 * label, purpose, whether the party is a channel, the fields it holds beside
 * its key — off the record the listing answers, so this module holds no
 * roster and no per-party table.
 */

export type { ConfigurationField };

/**
 * Whether a configuration is usable, in the words a reader is shown.
 *
 * An address is refused where it is parsed rather than later inside a request,
 * so a row never says it is ready while pointing at something that is not an
 * address at all.
 */
export function configurationRefusal(
  party: {
    readonly id: string;
    readonly kind: "service" | "channel";
    readonly fields: readonly ConfigurationField[];
  },
  configuration: Readonly<Record<string, string>>,
): string | null {
  if (party.kind !== "channel") {
    return Object.keys(configuration).length === 0
      ? null
      : `${party.id} takes no configuration.`;
  }
  const unknown = Object.keys(configuration).find(
    (key) => !party.fields.some((field) => field.key === key),
  );
  if (unknown !== undefined) {
    return `${party.id} takes no ${unknown}.`;
  }
  for (const field of party.fields) {
    const value = (configuration[field.key] ?? "").trim();
    if (value === "") {
      return `${field.label} is required.`;
    }
    if (field.check === "address" && !isAddress(value)) {
      return `${field.label} must be an http or https address.`;
    }
    if (field.check === "numeric" && !/^\d+$/u.test(value)) {
      return `${field.label} is the library's numeric id, not its name.`;
    }
  }
  return null;
}

function isAddress(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

/**
 * What a party is. An `apiKey` party takes a secret Calliopa stores and
 * presents; a `status` party takes none and holds only what something else
 * reports about it — which is what the agent's runtimes are, because their
 * credentials live in their own homes and never enter this store.
 */
export const CONNECTION_KINDS = ["apiKey", "status"] as const;
export type ConnectionKind = (typeof CONNECTION_KINDS)[number];

/**
 * What a connection is outside the database. There is no field a secret could
 * travel in: a row carries whether a key is set and its last characters, and
 * that is the whole of what is ever said about one.
 */
export interface ConnectionRecord {
  readonly party: string;
  readonly kind: ConnectionKind;
  /** What the descriptor says the party is, so the surface needs no table of its own. BO_0202_008 */
  readonly label: string;
  readonly purpose: string;
  /** A channel: somewhere the author's work goes, as opposed to a service Calliopa needs to run. */
  readonly channel: boolean;
  /** The fields a channel holds beside its key. Empty for a party that takes none. */
  readonly fields: readonly ConfigurationField[];
  readonly state: ConnectionState;
  readonly keySet: boolean;
  readonly secretSuffix: string | null;
  /**
   * What the party needs beside its secret. Readable, unlike the secret: an
   * address is not a credential and hiding it would make a row unreadable to
   * the person who typed it. Empty for a party that takes none.
   */
  readonly configuration: Readonly<Record<string, string>>;
  readonly lastTestedAt: string | null;
  readonly lastError: string | null;
  /** What a status party reports about itself. Absent for an `apiKey` party. */
  readonly status: RuntimeStatus | null;
  /**
   * What the agent stamped about the start it is running. Only the `hermes`
   * row carries it, and only once the agent has started at all.
   */
  readonly agent: AgentStatus | null;
}

/**
 * What the agent stamped about the start it is running: the runtime that is
 * reasoning, whether it holds a credential for Calliopa's tool surface, and
 * whether the toolset reached its runtimes. The credential is passed to the
 * agent alone, so this is the only account of it the application has.
 */
export interface AgentStatus {
  readonly runtime: string;
  readonly credential: boolean;
  readonly toolset: boolean;
}

/** What the agent container reports about one of its runtimes. */
export interface RuntimeStatus {
  readonly installed: boolean;
  readonly version: string;
  readonly authenticated: boolean;
  readonly billing: string;
}

/**
 * One thing standing between the agent and its work, in the reader's words.
 *
 * A need is not always something to act on here: a runtime that is not signed
 * in is fixed on its own row, and memory is named because a reader deserves to
 * see the whole of what the agent could have, not because it stops anything.
 * CA_0026_003
 */
export interface AgentNeed {
  readonly key: string;
  readonly text: string;
  /** Whether it stops the agent doing its work. Memory does not. */
  readonly blocking: boolean;
  /** A command only a terminal can run, when that is what the need asks for. */
  readonly command?: string;
}

/**
 * Everything standing between the agent and its work, read off the rows the
 * settings surface already holds.
 *
 * The agent's row is the whole picture, so a runtime's sign-in is named here
 * too even though its own row says the same: the state is read in one place and
 * acted on in another, rather than the agent's row growing controls that belong
 * to a runtime. CA_0026_003
 */
export function agentNeeds(
  rows: readonly ConnectionRecord[],
): readonly AgentNeed[] {
  const needs: AgentNeed[] = [];
  const agent = rows.find((row) => row.party === "hermes")?.agent ?? null;
  if (agent === null) {
    return [
      {
        key: "running",
        text: "The agent is not running, so it has reported nothing about itself.",
        blocking: true,
      },
    ];
  }

  const reasoning = rows.find((row) => row.party === agent.runtime) ?? null;
  if (reasoning === null) {
    needs.push({
      key: "runtime",
      text: `The agent reasons on ${agent.runtime}, which nothing reports on.`,
      blocking: true,
    });
  } else if (!(reasoning.status?.authenticated ?? false)) {
    const name = reasoning.label || reasoning.party;
    needs.push({
      key: "signIn",
      text: `${name} reasons for the agent and is not signed in. Its own row is where signing in happens.`,
      blocking: true,
    });
  }

  // The kernel toolset's bearer is generated at install (BO_0089_002), so a
  // missing credential is an install that did not run rather than a step the
  // reader takes; a registration that failed with the credential in hand is
  // the one thing left to report. BO_0207_015
  if (!agent.credential) {
    needs.push({
      key: "credential",
      text: "The agent holds no credential for the kernel's toolset. The stack's bootstrap generates it; the agent's own log says why it was not read.",
      blocking: true,
    });
  } else if (!agent.toolset) {
    needs.push({
      key: "toolset",
      text: "The agent holds a credential, but its toolset was not registered at its last start. The agent's own log says what the registration answered.",
      blocking: true,
    });
  }

  if (!(rows.find((row) => row.party === "honcho")?.keySet ?? false)) {
    needs.push({
      key: "memory",
      text: "The agent's memory has no key. It is optional, and the agent works without it.",
      blocking: false,
    });
  }

  return needs;
}
