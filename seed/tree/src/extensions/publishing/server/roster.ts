import type { PartyDescriptor } from "~/contract";
import { allOfType } from "~/server/ccgw/script";
import { typeOf } from "~/server/ccgw/nodes";
import { bareId, contentOf } from "~/server/ccgw/nodes";
import { CHANNEL_TYPE, partyOf } from "./channels";
import { kindOf } from "./kinds/registry";

/**
 * The roster this extension answers through the shell's party roster
 * contribution: one descriptor per established `channel` node — the
 * channel's party id, `kind: "channel"`, the kind's credential, the channel's
 * title as the label, the kind's purpose, its fields and its probe — so the
 * settings extension lists a row for every channel the author made. A
 * channel of a kind the build no longer ships lists with no fields and no
 * probe, so it can still be cleared. CA_0049_002
 */
export async function channelRoster(): Promise<readonly PartyDescriptor[]> {
  const outcome = await allOfType(CHANNEL_TYPE, "channel roster");
  if (outcome.outcome !== "success") return [];
  return outcome.result.nodes
    .filter((node) => typeOf(node) === CHANNEL_TYPE)
    .map((node) => {
      const content = contentOf(node);
      const channelId = bareId(node.id);
      const kind = kindOf(String(content["kind"] ?? ""));
      const title = String(content["title"] ?? channelId);
      if (kind === undefined) {
        return {
          id: partyOf(channelId),
          kind: "channel" as const,
          credential: "apiKey" as const,
          label: title,
          purpose: `A ${String(content["kind"] ?? "")} channel, a kind this build does not ship`,
          fields: [],
        };
      }
      return {
        id: partyOf(channelId),
        kind: "channel" as const,
        // The kind's own credential kind: a key, or an oauth sign-in the
        // settings row runs (BO_0252_007); a manual kind holds no credential.
        credential: kind.credential === "oauth" ? ("oauth" as const) : ("apiKey" as const),
        label: title,
        purpose: kind.purpose,
        fields: kind.fields,
        probe: { authorization: kind.authorization, test: kind.probe },
        ...(kind.provider === undefined ? {} : { provider: kind.provider }),
        ...(kind.paths === undefined ? {} : { paths: kind.paths }),
        ...(kind.fixed === undefined ? {} : { fixed: kind.fixed }),
      };
    });
}
