import type { Capability, CapabilityId, CapabilityState } from "~/lib/capabilities";
import { kernelSecrets } from "~/server/kernel/client";
import { port } from "~/server/port";

/**
 * Each remote capability's state where the shell runs (`~/lib/capabilities`),
 * read from the port — where it runs and whether the network is there — and
 * from the connections the person filled. On an instance every capability
 * the stack serves is `ready`: what an instance's own services say about
 * themselves stays theirs to say. On a device, in order: what the device
 * cannot do at all is `unavailable`, then a missing key is `needsKey`, then a
 * missing network is `offline`. BO_0319_043
 */

interface Declared {
  readonly id: CapabilityId;
  readonly label: string;
  /** The connection whose key it needs, if any. */
  readonly key: string | null;
  /** Why a device cannot do it yet, or null when it can. */
  readonly onDevice: string | null;
}

const RUNS_LATER = "Agent runs come with a later version of the app.";

const DECLARED: readonly Declared[] = [
  { id: "agent:anthropic", label: "Claude (Anthropic)", key: "anthropic", onDevice: RUNS_LATER },
  { id: "agent:openai", label: "OpenAI", key: "openai", onDevice: RUNS_LATER },
  { id: "agent:openrouter", label: "OpenRouter", key: "openrouter", onDevice: RUNS_LATER },
  // Higgsfield's HTTP API with the person's key (calliopa-bootstrap's BO_0319_025).
  { id: "media:higgsfield", label: "Higgsfield", key: "higgsfield", onDevice: null },
  {
    id: "media:openart",
    label: "OpenArt",
    key: null,
    onDevice: "OpenArt offers no API key, so it generates on a Calliopa instance only.",
  },
  { id: "fetch:record", label: "Fill from identifier", key: null, onDevice: null },
];

/** One capability's state, from the place, its key and the network. */
export function stateOf(
  declared: Pick<Declared, "key" | "onDevice">,
  where: "instance" | "device",
  keySet: boolean,
  online: boolean,
): { readonly state: CapabilityState; readonly reason: string | null; readonly fix: string | null } {
  if (where === "instance") return { state: "ready", reason: null, fix: null };
  if (declared.onDevice !== null) return { state: "unavailable", reason: declared.onDevice, fix: null };
  if (declared.key !== null && !keySet) {
    return { state: "needsKey", reason: "This needs a key, entered in Settings.", fix: declared.key };
  }
  if (!online) return { state: "offline", reason: "This needs the network, and the device is offline.", fix: null };
  return { state: "ready", reason: null, fix: null };
}

/** Every capability's state where the shell runs. */
export async function readCapabilities(): Promise<readonly Capability[]> {
  const where = port.where;
  const online = port.online();
  return Promise.all(
    DECLARED.map(async (declared) => {
      const keySet =
        where === "device" && declared.key !== null
          ? ((await kernelSecrets.read(declared.key).catch(() => null))?.secretFields["apiKey"]?.set ?? false)
          : false;
      return { id: declared.id, label: declared.label, ...stateOf(declared, where, keySet, online) };
    }),
  );
}

/** One capability, by id. */
export async function readCapability(id: CapabilityId): Promise<Capability> {
  const found = (await readCapabilities()).find((capability) => capability.id === id);
  if (found === undefined) throw new Error(`no capability ${id}`);
  return found;
}
