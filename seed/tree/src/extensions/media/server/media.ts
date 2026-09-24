import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { call } from "~/server/kernel/client";

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

const configDir = () =>
  process.env.CALLIOPA_MEDIA_CONFIG_DIR ?? "/var/lib/calliopa/media-config";
const loginDir = () => join(configDir(), "login");

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
}

/** The services the instance holds, with what each can make. */
export async function roster(): Promise<readonly ServiceView[]> {
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
  const id = randomUUID();
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
  await mkdir(loginDir(), { recursive: true });
  const temporary = join(loginDir(), "request.json.tmp");
  await writeFile(temporary, JSON.stringify(request), { mode: 0o600 });
  await rename(temporary, join(loginDir(), "request.json"));
}

/**
 * How the sign-in a request started is going, or null while it has not begun.
 * Every state carries its request's id, so a row follows its own flow and never
 * reads an older one's outcome as its own (`BO_0261`).
 */
export async function signInState(id?: string): Promise<SignInState | null> {
  let held: SignInState;
  try {
    held = JSON.parse(await readFile(join(loginDir(), "state.json"), "utf8")) as SignInState;
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
