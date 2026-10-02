/**
 * The remote capabilities a control may depend on, and each one's state where
 * the shell runs (`docs/system/foundation/device.md`, Capability States): a
 * control whose capability is not `ready` is disabled, says why in these
 * words, and links to the connection that fixes it when one does. On an
 * instance every capability the stack serves reads `ready`. BO_0319_043
 */

export type CapabilityState = "ready" | "needsKey" | "offline" | "unavailable";

export type CapabilityId =
  | "agent:anthropic"
  | "agent:openai"
  | "agent:openrouter"
  | "media:higgsfield"
  | "media:openart"
  | "fetch:record";

export interface Capability {
  readonly id: CapabilityId;
  readonly label: string;
  readonly state: CapabilityState;
  /** Why it is not ready, in words; null when it is. */
  readonly reason: string | null;
  /** The settings connection that makes it ready, when one does. */
  readonly fix: string | null;
}

/** What a disabled control reads before its reason. */
export const STATE_WORDS: Readonly<Record<CapabilityState, string>> = {
  ready: "Ready",
  needsKey: "Needs a key",
  offline: "Offline",
  unavailable: "Unavailable on this device",
};
