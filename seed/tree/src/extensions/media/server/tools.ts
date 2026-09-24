import { call } from "~/server/kernel/client";

import { anyGeneratorSignedIn } from "./source";

/**
 * What an agent may reach (`BO_0273_018`).
 *
 * One tool, and it does not spend. **The gate is the route's kind**: it is a
 * `kernelCallback` route, the only kind a run can reach, and nothing that
 * bills is answered by one — the press that spends is an ordinary
 * human-session route a run cannot call at all.
 *
 * **`propose_generation` went** (`BO_0273_038`, user decision 2026-09-22). It
 * staged a picture that was not made yet, to be completed by a press of its
 * own; sending a block to a model is that press now, so the tool proposed into
 * a state nothing completes. An agent writes the words as an ordinary block
 * and names the model it would use, in its own answer, and the person sends
 * that block — one press, which spends, and always theirs. Nothing in a
 * document is a picture-not-made-yet any more except a generation already
 * running.
 *
 * A tool answers the kernel with what the run reads back and the statements to
 * stage; the kernel stages them into the run's group as the run, because
 * nothing an extension does may write on a run's behalf.
 */

export interface ToolCall {
  readonly input: Readonly<Record<string, unknown>>;
  readonly run: { readonly id: string; readonly group: string; readonly pin: number; readonly person?: string };
}

export interface ToolAnswer {
  readonly result: unknown;
  readonly stage?: readonly {
    readonly statement: string;
    readonly parameters: Record<string, unknown>;
    readonly rationale: string;
  }[];
  readonly conclusion?: string;
}

/** A tool refused: the run reads the reason and nothing is staged. */
export class ToolRefusal extends Error {}

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * What a generation would cost, for a run. No session gate, and that is not an
 * oversight: a quote is the adapters' dry run, which spends nothing, and the
 * boundary that matters is that no tool reaches the route that does.
 */
async function quoteGeneration(request: ToolCall): Promise<ToolAnswer> {
  const service = text(request.input["service"]);
  const model = text(request.input["model"]);
  const kind = text(request.input["kind"]) === "video" ? "video" : "image";
  const prompt = text(request.input["prompt"]);
  if (service === "" || model === "") throw new ToolRefusal("Name the service and the model to quote.");
  // The extension ships active, so a run may reach for this on an instance
  // where nothing is signed in. It is told what to say rather than meeting a
  // failed call. BO_0273_020
  const held = await anyGeneratorSignedIn();
  if (!held.any) throw new ToolRefusal(held.words);
  if (prompt === "") throw new ToolRefusal("Give the words the picture would be made from.");

  const answer = await call("/__kernel/media/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service, kind, model, prompt }),
  });
  if (!answer.ok) throw new ToolRefusal("The media service is not answering.");
  return { result: await answer.json() };
}

export const TOOLS = {
  quote_generation: quoteGeneration,
} as const;
