import type { KindSummary } from "../../lib/library";
import type { Kind } from "./contract";
import { bunnyStream } from "./bunny-stream";
import { website } from "./website";

/**
 * Every kind this extension ships. A file of its own because the contract
 * cannot import its implementations. A kind arrives with the change that
 * builds it: `website` with `PU_0001`, `bunny-stream` with `PU_0004`, YouTube with `PU_0005` after
 * `BO_0252`, the manual kinds with `PU_0006`. PU_0001_003
 */
export const KINDS: readonly Kind[] = [website, bunnyStream];

export const kindOf = (id: string): Kind | undefined => KINDS.find((kind) => kind.id === id);

/** A kind as the browser is handed it. */
export const summarize = (kind: Kind): KindSummary => ({
  id: kind.id,
  label: kind.label,
  fields: kind.fields,
  readsIndex: "fromDestination" in kind.offer,
});
