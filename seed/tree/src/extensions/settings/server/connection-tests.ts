import { bunnyLibraryUrl, type ConnectionParty } from "~/lib/connections";

/**
 * What proving a connection means for each party: the smallest real
 * authenticated call to it. Nothing here is mocked and there is no path that
 * reports an outcome without making the call, so a `verified` row means the
 * party accepted the stored key.
 */

const TIMEOUT_MS = 15_000;

/** Never let a service's own words carry the key back into a stored row. */
function withoutSecret(message: string, secret: string): string {
  return secret === "" ? message : message.split(secret).join("[key]");
}

async function errorFrom(response: Response): Promise<string> {
  const body = await response.text();
  try {
    const parsed: unknown = JSON.parse(body);
    const message = (parsed as { error?: { message?: unknown } }).error?.message;
    if (typeof message === "string" && message !== "") {
      return message;
    }
  } catch {
    // Not JSON. The status line below is what the party said.
  }
  return `${response.status} ${response.statusText}`.trim();
}

/**
 * The OpenAI key the agent's memory needs. Listing models is the cheapest call
 * that requires the key and changes nothing.
 */
async function testOpenAiKey(secret: string): Promise<string | null> {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return response.ok ? null : await errorFrom(response);
}

/**
 * The publishing credential for `../homepage`.
 *
 * The author contract sits behind that repository's write guard: it answers
 * with a valid token and homepage's uniform 401 without one, which makes it the
 * smallest real authenticated call to this destination and the only one that
 * changes nothing. Homepage answers a refusal as `{error:{code,message}}`,
 * which is the shape `errorFrom` already reads.
 */
async function testHomepageKey(
  secret: string,
  configuration: Readonly<Record<string, string>>,
): Promise<string | null> {
  const address = configuration.address ?? "";
  const response = await fetch(new URL("/v1/contract/author", address), {
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return response.ok ? null : await errorFrom(response);
}

/**
 * The Bunny Stream key, against the library the channel names.
 *
 * Listing one video is the smallest real authenticated call to a library and
 * changes nothing there. It proves the pair rather than the key alone: a key
 * that is valid for another library answers a refusal here, which is what an
 * author needs told before a publish tries to use it.
 */
async function testBunnyKey(
  secret: string,
  configuration: Readonly<Record<string, string>>,
): Promise<string | null> {
  const libraryId = configuration.libraryId ?? "";
  const response = await fetch(
    `${bunnyLibraryUrl(libraryId)}/videos?itemsPerPage=1`,
    {
      headers: { AccessKey: secret, accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  return response.ok ? null : await errorFrom(response);
}

/**
 * The test each party's key is proven with. It is partial on purpose: a status
 * party holds no key, so there is nothing to prove and no request to make.
 */
type PartyTest = (
  secret: string,
  configuration: Readonly<Record<string, string>>,
) => Promise<string | null>;

const PARTY_TESTS: Readonly<Partial<Record<ConnectionParty, PartyTest>>> = {
  honcho: testOpenAiKey,
  homepage: testHomepageKey,
  bunny: testBunnyKey,
};

/**
 * Runs a party's test and answers what came back: `null` when the party
 * accepted the key, otherwise the message it or the transport gave. A refusal
 * is reported rather than swallowed, so a machine that cannot reach the party
 * says so instead of reporting success.
 */
export async function testConnection(
  party: ConnectionParty,
  secret: string,
  configuration: Readonly<Record<string, string>> = {},
): Promise<string | null> {
  const test = PARTY_TESTS[party];
  if (test === undefined) {
    return `${party} holds no key to test.`;
  }
  try {
    const failure = await test(secret, configuration);
    return failure === null ? null : withoutSecret(failure, secret);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "the request could not be made";
    return withoutSecret(message, secret);
  }
}
