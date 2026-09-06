import { homepage } from "./homepage";
import type { Destination } from "./destinations";

/**
 * Every destination this instance has an adapter for.
 *
 * It is a file of its own because the contract cannot hold it: `destinations.ts`
 * declares what a destination is and each adapter imports that, so a list of
 * adapters there would be the contract importing its own implementations.
 */
export const DESTINATIONS: readonly Destination<unknown, unknown>[] = [
  homepage as unknown as Destination<unknown, unknown>,
];

/** The destinations that show a front, which is what the library lists. */
export const frontChannels = (): readonly string[] =>
  DESTINATIONS.filter((destination) => destination.units.includes("front")).map(
    (destination) => destination.channel,
  );
