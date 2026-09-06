/**
 * Connections are the outbound half of credentials: one record per external
 * party Calliopa presents a credential to. The inbound half — who is calling
 * Calliopa — is `src/server/api-clients.mjs` and is unrelated to this.
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

export const CONNECTION_PARTIES = [
  "honcho",
  "hermes",
  "codex",
  "claude-code",
  "homepage",
  "bunny",
] as const;
export type ConnectionParty = (typeof CONNECTION_PARTIES)[number];

/**
 * The channels: destinations the author's work goes to, as opposed to services
 * Calliopa needs to run. A channel is an ordinary connection that also holds
 * configuration, and the split exists because the two read as different things
 * to the person entering credentials for them.
 *
 * This roster is application source like the party list it draws from. A
 * channel arrives with the change that needs it, and holding its credential
 * grants no authority to publish: that is `docs/system/publishing.md`.
 */
export const CHANNEL_PARTIES = ["homepage", "bunny"] as const;
export type ChannelParty = (typeof CHANNEL_PARTIES)[number];

export function isChannelParty(value: string): value is ChannelParty {
  return (CHANNEL_PARTIES as readonly string[]).includes(value);
}

/** One value a channel needs beside its secret, in the reader's words. */
export interface ConfigurationField {
  readonly key: string;
  readonly label: string;
  readonly hint: string;
}

/**
 * What each channel holds besides its key.
 *
 * `homepage` needs the address of the instance this Calliopa publishes to. It
 * is entered rather than fixed because the instances are separate: a
 * development Calliopa points at a development homepage while a production one
 * points at the real site, and a hardcoded address would make a development
 * experiment write to the live site.
 *
 * `bunny` needs the video library its uploads go to. Every call of the channel
 * lives under that library, so an id is what makes the key reach anything at
 * all. The playback hostname is not held here: the destination that plays a
 * video holds its own, and a second copy would be a second thing to keep true.
 */
export const CHANNEL_CONFIGURATION: Readonly<
  Record<ChannelParty, readonly ConfigurationField[]>
> = {
  homepage: [
    {
      key: "address",
      label: "Address",
      hint: "Where this homepage answers, for example http://100.114.122.91:4460",
    },
  ],
  bunny: [
    {
      key: "libraryId",
      label: "Library",
      hint: "The numeric id of the Bunny Stream video library, for example 512345",
    },
  ],
};

/**
 * Whether a configuration is usable, in the words a reader is shown.
 *
 * An address is refused where it is parsed rather than later inside a request,
 * so a row never says it is ready while pointing at something that is not an
 * address at all.
 */
export function configurationRefusal(
  party: string,
  configuration: Readonly<Record<string, string>>,
): string | null {
  if (!isChannelParty(party)) {
    return Object.keys(configuration).length === 0
      ? null
      : `${party} takes no configuration.`;
  }
  const fields = CHANNEL_CONFIGURATION[party];
  const unknown = Object.keys(configuration).find(
    (key) => !fields.some((field) => field.key === key),
  );
  if (unknown !== undefined) {
    return `${party} takes no ${unknown}.`;
  }
  for (const field of fields) {
    const value = (configuration[field.key] ?? "").trim();
    if (value === "") {
      return `${field.label} is required.`;
    }
    if (field.key === "address" && !isAddress(value)) {
      return `${field.label} must be an http or https address.`;
    }
    if (field.key === "libraryId" && !isLibraryId(value)) {
      return `${field.label} is the library's numeric id, not its name.`;
    }
  }
  return null;
}

/**
 * A Bunny library is identified by a number. Refusing anything else here is
 * what stops a name being entered and every later call reaching an address
 * that cannot exist.
 */
export function isLibraryId(value: string): boolean {
  return /^\d+$/.test(value);
}

/** The Stream API root of a library. Every call of the channel lives under it. */
export function bunnyLibraryUrl(libraryId: string): string {
  return `https://video.bunnycdn.com/library/${libraryId}`;
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

export interface PartyDetail {
  readonly name: string;
  readonly purpose: string;
}

/** What a row is called and what its key is for, in the reader's words. */
export const CONNECTION_PARTY_DETAIL: Readonly<
  Record<ConnectionParty, PartyDetail>
> = {
  honcho: {
    name: "Honcho",
    purpose: "OpenAI API key for the agent's memory",
  },
  hermes: {
    name: "Hermes",
    purpose: "The agent Calliopa hands goals to",
  },
  codex: {
    name: "Codex",
    purpose: "Reasons for the agent, on your ChatGPT subscription",
  },
  "claude-code": {
    name: "Claude Code",
    purpose: "Writes code for the agent, on your Claude subscription",
  },
  homepage: {
    name: "Homepage",
    purpose: "Publishing credential for the site this instance writes to",
  },
  bunny: {
    name: "Bunny Stream",
    purpose: "The video host a published film's bytes go to",
  },
};

/**
 * What a connection is outside the database. There is no field a secret could
 * travel in: a row carries whether a key is set and its last characters, and
 * that is the whole of what is ever said about one.
 */
export interface ConnectionRecord {
  readonly party: ConnectionParty;
  readonly kind: ConnectionKind;
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

export function isConnectionParty(value: string): value is ConnectionParty {
  return (CONNECTION_PARTIES as readonly string[]).includes(value);
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
 * The one step the product cannot take for the reader.
 *
 * The application holds no control over the Docker daemon and a token it could
 * write into `.env.dev` would be a secret inside a surface built to hold none,
 * so the command is what it offers instead of the action. The client name is
 * not incidental and nothing may paraphrase it: a run's owner is resolved by
 * the name `hermes`. CA_0026_004
 */
export const AGENT_CREDENTIAL_COMMAND =
  "pnpm run client issue hermes --proposer";

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
    const name =
      CONNECTION_PARTY_DETAIL[reasoning.party]?.name ?? reasoning.party;
    needs.push({
      key: "signIn",
      text: `${name} reasons for the agent and is not signed in. Its own row is where signing in happens.`,
      blocking: true,
    });
  }

  if (!agent.credential) {
    needs.push({
      key: "credential",
      text: "The agent holds no credential for Calliopa's documents, so it can neither read them nor propose changes to them. Issue one at a terminal on this machine, put the token it prints once into `.env.dev` as CALLIOPA_AGENT_TOOLS_TOKEN, and restart the agent, which reads it at start.",
      blocking: true,
      command: AGENT_CREDENTIAL_COMMAND,
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
