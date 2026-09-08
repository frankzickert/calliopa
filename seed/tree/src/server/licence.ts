import { graphEnv } from "./ccgw/env";
import { licenceWarning } from "~/lib/licence";

/**
 * The expiry warning for the header, from `licenceExpiresAt` beside the epoch
 * on the head route (`ccgw.md`, `BO_0213_006`), which anyone reads: the words
 * are `src/lib/licence.ts`'s. Nothing is held; a head that cannot be read says
 * nothing rather than failing the page. BO_0209_005
 */
export async function readLicenceWarning(now: Date = new Date()): Promise<string | null> {
  try {
    const response = await fetch(`${graphEnv().ccgwUrl}/v1/head`);
    if (!response.ok) return null;
    const head = (await response.json()) as { licenceExpiresAt?: unknown };
    return licenceWarning(typeof head.licenceExpiresAt === "string" ? head.licenceExpiresAt : null, now);
  } catch {
    return null;
  }
}
