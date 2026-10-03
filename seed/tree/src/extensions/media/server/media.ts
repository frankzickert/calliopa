import { port } from "~/server/port";

import { call } from "~/server/kernel/client";
import { readCapabilities } from "~/server/capabilities";

/**
 * What this extension knows of the media service.
 *
 * Two paths, and they are different on purpose. The **roster and every call
 * that spends** go through the kernel, which holds the service's bearer: the
 * tree is handed CCGW's address and the kernel's and nothing else
 * (`BO_0207_026`'s surface, `BO_0273_026`). **Signing in** goes nowhere near a
 * network: the flow's two files live on a volume both containers mount and
 * this writes and reads them directly, the way the agent's sign-in already
 * does (`src/server/agent/adapters.ts`, `BO_0273_025`).
 */

const files = port.config("media");

export type GeneratorService = "higgsfield" | "openart";

export const SERVICES: readonly GeneratorService[] = ["higgsfield", "openart"];

export interface OfferedModel {
  readonly model: string;
  readonly kind: "image" | "video";
  readonly default: boolean;
}

export interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly plan: string | null;
  readonly credits: number | null;
  readonly selected: boolean;
}

export interface ServiceView {
  readonly service: string;
  readonly signedIn: boolean;
  readonly reason: string | null;
  readonly models: readonly OfferedModel[];
  readonly openSet: Readonly<Record<string, boolean>>;
  /**
   * The account's workspaces, for a service that submits into one, or null for
   * one that has no such thing. Higgsfield refuses a generation without a
   * workspace selected, and the id is only knowable once signed in, so the
   * choice is offered here rather than asked for before the login that reveals
   * it. BO_0273_042
   */
  readonly workspaces: readonly Workspace[] | null;
  /** The vendor cannot be reached where the shell runs — a device, for a
   * vendor whose way in is an instance's — so nothing signs in to it; its
   * reason is why. BO_0319_043 */
  readonly unavailable?: boolean;
  /** Made with a key the person entered under Connections, so nothing signs
   * in to it: a device's Higgsfield (`calliopa-bootstrap`'s BO_0319_025). */
  readonly byKey?: boolean;
}

/** The services the instance holds, with what each can make. */
export async function roster(): Promise<readonly ServiceView[]> {
  // On a device the cell answers Higgsfield, through its API with the
  // person's key, and each generator is as its capability stands: one that
  // is not ready says why and offers nothing. BO_0319_043 BO_0319_025
  if (port.where === "device") {
    const [capabilities, answered] = await Promise.all([
      readCapabilities(),
      call("/__kernel/media/services", { method: "GET" })
        .then(async (response) => (response.ok ? ((await response.json()) as { services?: readonly ServiceView[] }).services ?? [] : []))
        .catch(() => [] as readonly ServiceView[]),
    ]);
    return SERVICES.map((service) => {
      const capability = capabilities.find((candidate) => candidate.id === `media:${service}`);
      const ready = capability?.state === "ready";
      const held = answered.find((candidate) => candidate.service === service);
      if (ready && held !== undefined) return { ...held, byKey: true };
      return {
        service,
        signedIn: false,
        reason: ready ? "The generator is not answering on this device." : (capability?.reason ?? "This generator is not available here."),
        models: [],
        openSet: {},
        workspaces: null,
        unavailable: true,
        // Higgsfield is made with a key on a device, set or not yet.
        ...(service === "higgsfield" ? { byKey: true } : {}),
      };
    });
  }
  const response = await call("/__kernel/media/services", { method: "GET" });
  if (!response.ok) {
    // An unreachable generator is an ordinary outcome carried back as words:
    // the section says the service is not answering rather than failing to
    // render.
    return [];
  }
  const answered = (await response.json()) as { services?: readonly ServiceView[] };
  return answered.services ?? [];
}

/** One axis a model takes, as the service reports it. BO_0279_001 */
export interface ModelAxis {
  readonly axis: string;
  readonly vendorKey: string;
  readonly takes: string;
  readonly values: readonly string[];
  readonly default: string | null;
}

export interface ModelOptions {
  readonly service: string;
  readonly model: string;
  readonly kind: string;
  readonly axes: readonly ModelAxis[];
  /** Why the axes are empty, when the vendor would not say. BO_0279_014 */
  readonly reason?: string;
}

/**
 * What one model takes, asked of the vendor through the service.
 *
 * Free — a description, never a generation — and asked when the owner sets a
 * model up rather than when a menu opens, so nothing calls a vendor on the
 * path of a press. A vendor that will not answer leaves the axes empty with
 * its own words, and the model is offered anyway. BO_0279_011 BO_0279_014
 */
export async function modelOptions(service: string, model: string): Promise<ModelOptions> {
  const path = `/__kernel/media/models/${encodeURIComponent(service)}/${encodeURIComponent(model)}`;
  const response = await call(path, { method: "GET" });
  if (!response.ok) {
    return { service, model, kind: "image", axes: [], reason: "The media service is not answering." };
  }
  return (await response.json()) as ModelOptions;
}

export interface SignInState {
  readonly service?: string;
  readonly status?: string;
  readonly id?: string;
  readonly url?: string;
  readonly callbackPort?: number;
  readonly output?: string;
  readonly previous?: { readonly id?: string; readonly status?: string };
}

/**
 * Starts a vendor CLI's own browser login. The flow belongs to the runtime and
 * its credential lives in the runtime's own home; neither passes through here.
 */
export async function requestSignIn(service: GeneratorService): Promise<string> {
  const id = port.uuid();
  await write({ service, id });
  return id;
}

/**
 * Selects the workspace a service submits into. It spends nothing — the
 * service checks the id against the account's own listing before the CLI takes
 * it, because that CLI accepts any string at all and a typo would then refuse
 * every generation in the same words an empty selection does. BO_0273_042
 */
export async function chooseWorkspace(
  service: GeneratorService,
  workspace: string,
): Promise<{ ok: true } | { ok: false; refusal: string }> {
  const response = await call("/__kernel/media/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service, workspace }),
  });
  if (response.ok) return { ok: true };
  const said = (await response.json().catch(() => ({}))) as { error?: string };
  return { ok: false, refusal: said.error ?? "The workspace was not taken." };
}

/**
 * Hands back the redirect a Higgsfield login waits for. It is written where the
 * broker reads it and never answered back: it is a one-time code, and a surface
 * that could read it again would be a place it could be taken from.
 */
export async function handBackRedirect(
  service: GeneratorService,
  id: string,
  code: string,
  state: string,
): Promise<void> {
  await write({ service, id, code, state });
}

async function write(request: Record<string, string>): Promise<void> {
  await files.replace("login/request.json", JSON.stringify(request), 0o600);
}

/**
 * How the sign-in a request started is going, or null while it has not begun.
 * Every state carries its request's id, so a row follows its own flow and never
 * reads an older one's outcome as its own (`BO_0261`).
 */
export async function signInState(id?: string): Promise<SignInState | null> {
  let held: SignInState;
  try {
    const text = await files.read("login/state.json");
    if (text === null) return null;
    held = JSON.parse(text) as SignInState;
  } catch {
    return null;
  }
  if (id !== undefined && held.id !== id) {
    // Not this flow's. What replaced it says so, so the row can stop following.
    if (held.previous?.id !== id) return null;
    return {
      ...held.previous,
      ...(held.service === undefined ? {} : { service: held.service }),
    };
  }
  return held;
}
