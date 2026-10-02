import { call } from "~/server/kernel/client";
import { blobReference, putBlob } from "~/server/ccgw/blobs";
import { withBranch } from "~/server/ccgw/branch-scope";
import { withRunGrant } from "~/server/request-context";
import { composeMediaFill, composeMediaInsert } from "~/extensions/documents/server/documents";

import { anyGeneratorSignedIn } from "./source";
import { pictureAbove, promptOf, startFrame, type ReferenceBytes } from "./make";
import { roster, SERVICES } from "./media";
import { readFormat, type GenerationFormat } from "./format";
import { qualityAxisOf, RATIO_AXES } from "./suggestions";

/**
 * `media.generate` is a spending tool: the kernel admits it only once in a
 * person's Send run. It stages the pending picture or video before starting a
 * job and leaves the job id on that block so a later tool call can collect it.
 */

export interface ToolCall {
  readonly input: Readonly<Record<string, unknown>>;
  /** What the owner set for media, handed with the call. BO_0276_007 */
  readonly settings?: unknown;
  readonly run: {
    readonly id: string;
    readonly group: string;
    readonly pin: number;
    readonly person?: string;
    readonly document?: string;
    /** The instruction the command chose, by id (`calliopa-bootstrap`'s `BO_0336_001`). */
    readonly instruction?: string;
    /** The variation of its format chosen beside Send, by block id. */
    readonly variation?: string;
    /** What the tool's kernel calls present in place of a session. BO_0312_063 */
    readonly grant?: string;
  };
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

const NAMES: Readonly<Record<string, string>> = { higgsfield: "Higgsfield", openart: "OpenArt", codex: "Codex" };

/** What a generation under the run's instruction makes, and with what, or the
 * refusal in words before anything is composed or spent (`BO_0336_022`). */
async function formatToMake(request: ToolCall): Promise<GenerationFormat & { readonly kind: "image" | "video" }> {
  const read = await readFormat(request.run);
  if (!read.ok) throw new ToolRefusal(read.refusal);
  const format = read.format;
  const kind = format.type === "image" || format.type === "video" ? format.type : null;
  if (kind === null) {
    throw new ToolRefusal(`${format.title} makes ${format.type === "" ? "nothing yet" : format.type}, not a picture or a video: choose a format of type image or video on the instruction.`);
  }
  if (format.provider === "") throw new ToolRefusal(`${format.title} names no provider: choose one in the format.`);
  // Codex makes nothing yet, and is never a fallback for anything (BO_0320_014).
  if (format.provider === "codex") throw new ToolRefusal("Image generation through Codex is temporarily unavailable: choose another provider in the format.");
  if (!(SERVICES as readonly string[]).includes(format.provider)) {
    throw new ToolRefusal(`${format.title} names ${format.provider}, which is no generation service here: choose Higgsfield or OpenArt in the format.`);
  }
  const service = (await roster()).find((one) => one.service === format.provider);
  if (service === undefined || !service.signedIn) {
    throw new ToolRefusal(service?.reason ?? `Sign in to ${NAMES[format.provider] ?? format.provider} in Settings before generating.`);
  }
  if (format.model === "") throw new ToolRefusal(`${format.title} names no model: choose one in the format.`);
  return { ...format, kind };
}

/** The format's ratio and quality as the model's axes, under the service's
 * names; a value the model does not take is the vendor's to refuse. */
const optionsOf = (format: GenerationFormat): Record<string, string> => ({
  ...(format.ratio === "" ? {} : { [RATIO_AXES[0] ?? "aspect-ratio"]: format.ratio }),
  ...(format.quality === "" ? {} : { [qualityAxisOf(format.provider, format.model)]: format.quality }),
});

/** The service's own words for a refusal, or these. */
async function refusalOf(response: Response, fallback: string): Promise<string> {
  const said = (await response.json().catch(() => ({}))) as { error?: unknown; message?: unknown };
  const words = typeof said.error === "string" ? said.error : typeof said.message === "string" ? said.message : "";
  return words.trim() === "" ? fallback : words.trim();
}

/**
 * What a generation under the run's instruction would cost, for a run. No session
 * gate, and that is not an oversight: a quote is the adapters' dry run, which
 * spends nothing. What is quoted is what the format would make.
 */
async function quoteGeneration(request: ToolCall): Promise<ToolAnswer> {
  // The extension ships active, so a run may reach for this on an instance
  // where nothing is signed in. It is told what to say rather than meeting a
  // failed call. BO_0273_020
  const held = await anyGeneratorSignedIn();
  if (!held.any) throw new ToolRefusal(held.words);
  const format = await formatToMake(request);
  const prompt = text(request.input["prompt"]);
  if (prompt === "") throw new ToolRefusal("Give the words the picture would be made from.");
  const options = optionsOf(format);
  const answer = await call("/__kernel/media/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service: format.provider, kind: format.kind, model: format.model, prompt, ...(Object.keys(options).length === 0 ? {} : { options }) }),
  });
  if (!answer.ok) throw new ToolRefusal(await refusalOf(answer, "The media service is not answering."));
  return { result: { format: format.title, service: format.provider, model: format.model, ...(await answer.json()) } };
}

/**
 * Start one image or video job and stage its pending block into the person's
 * Send group (`calliopa-bootstrap`'s `BO_0312_041`). What is made, and with
 * what, is the format the run's instruction names, with the variation chosen
 * beside Send (`BO_0336_022`); the run's own arguments name no model and no
 * option. A video animates the nearest picture above the block, as a send to
 * a video model did (`BO_0273_045`). Every refusal comes before the paid
 * request.
 */
async function generate(request: ToolCall): Promise<ToolAnswer> {
  const documentId = request.run.document ?? "";
  const blockId = text(request.input["block"]);
  const format = await formatToMake(request);
  const { kind } = format;
  if (documentId === "" || blockId === "" || request.run.group === "") {
    throw new ToolRefusal(`A ${kind} generation needs the document and prompt block from this Send.`);
  }
  const prompt = text(request.input["words"]) || await promptOf(documentId, blockId);
  if (prompt === "") throw new ToolRefusal(`This block has no words to make ${kind === "video" ? "a video" : "an image"} from.`);

  // A video opens on a picture: neither generator makes a clip from words
  // alone. BO_0273_045
  let references: readonly ReferenceBytes[] = [];
  if (kind === "video") {
    const picture = await pictureAbove(documentId, blockId);
    if (picture === null) {
      throw new ToolRefusal("A video is made from a picture, and there is none above this block to animate. Make a picture first.");
    }
    const bytes = await startFrame(picture);
    if (bytes === null) throw new ToolRefusal("The picture above this block could not be read.");
    references = [bytes];
  }

  const service = format.provider;
  const { model } = format;
  // Compose before the paid request, so an invalid placement never spends,
  // and in the run's group, as the kernel stages it there: composed against
  // truth the CREATE names itself established, which a proposal refuses, and
  // the job would be paid for with nowhere to land (BO_0312_042's walk).
  const plan = await withBranch(request.run.group, () => composeMediaInsert({
    documentId,
    block: { kind, alt: prompt, source: { extension: "media", service, model, prompt, pending: true } },
    placement: { after: blockId },
  }));
  if (!plan.ok) throw new ToolRefusal(plan.refusal);
  const options = optionsOf(format);
  const started = await call("/__kernel/media/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service,
      kind,
      model,
      prompt,
      ...(references.length === 0 ? {} : { references }),
      ...(Object.keys(options).length === 0 ? {} : { options }),
    }),
  });
  // A value the vendor does not take is refused in the vendor's own words.
  if (!started.ok) throw new ToolRefusal(await refusalOf(started, `The media service refused the ${kind} job.`));
  const job = (await started.json()) as { id?: string };
  if (typeof job.id !== "string" || job.id === "") throw new ToolRefusal("The media service returned no job id.");
  plan.parameters["b_source"] = {
    extension: "media", service, model, prompt, job: job.id,
    format: format.id, ...(format.variation === undefined ? {} : { variation: format.variation }),
    ...(Object.keys(options).length === 0 ? {} : { options }),
    proposedAt: new Date().toISOString(),
  };
  return {
    result: { status: "running", kind, job: job.id, block: plan.blockId, format: format.title, model },
    stage: [{ statement: plan.statement, parameters: plan.parameters, rationale: `stage ${kind} generation job ${job.id}` }],
  };
}

/** Collect a completed job without spending again and stage its bytes on the pending picture or video. */
async function collectGeneration(request: ToolCall): Promise<ToolAnswer> {
  const documentId = request.run.document ?? "";
  const blockId = text(request.input["block"]);
  const jobId = text(request.input["job"]);
  if (documentId === "" || blockId === "" || jobId === "") throw new ToolRefusal("Name the pending block and its generation job.");
  const held = await call(`/__kernel/media/generations/${encodeURIComponent(jobId)}`, { method: "GET" });
  if (!held.ok) throw new ToolRefusal("That generation job could not be read.");
  const job = (await held.json()) as { state?: string; result?: { error?: { message?: unknown } }; service?: string; model?: string };
  if (job.state === "running") return { result: { status: "running", job: jobId } };
  if (job.state !== "completed") {
    const message = job.result?.error?.message;
    throw new ToolRefusal(typeof message === "string" && message !== "" ? message : "The generation job did not complete.");
  }
  const made = await call(`/__kernel/media/generations/${encodeURIComponent(jobId)}/file`, { method: "GET" });
  if (!made.ok) throw new ToolRefusal("The completed generation could not be retrieved.");
  const mediaType = made.headers.get("Content-Type") ?? "image/png";
  // A picture comes back as PNG, a video as the generator's video type.
  if (mediaType !== "image/png" && !mediaType.startsWith("video/")) throw new ToolRefusal("The backend returned an unsupported format.");
  const bytes = new Uint8Array(await made.arrayBuffer());
  const uploaded = await putBlob(bytes);
  if (uploaded.outcome !== "success") throw new ToolRefusal("What was generated could not be stored.");
  const service = text(job.service);
  const model = text(job.model);
  const source = { extension: "media", service, model, job: jobId, madeAt: new Date().toISOString(), ...(service === "codex" ? { cost: "unavailable" } : {}) };
  const plan = await withBranch(request.run.group, () => composeMediaFill({
    documentId,
    blockId,
    jobId,
    reference: blobReference(uploaded.result.hash.replace(/^sha256:/u, ""), mediaType, uploaded.result.size),
    source,
  }));
  if (!plan.ok) throw new ToolRefusal(plan.refusal);
  return {
    result: { status: "completed", job: jobId, block: blockId, cost: service === "codex" ? "unavailable" : undefined },
    stage: [{ statement: plan.statement, parameters: plan.parameters, rationale: `fill the block from generation job ${jobId}` }],
  };
}

export const TOOLS = {
  quote_generation: quoteGeneration,
  generate,
  collect_generation: collectGeneration,
} as const;

/**
 * Answers one tool the kernel called, under the run's grant: a callback holds
 * no person's session, so every kernel call the tool makes presents the grant
 * instead, or the prod gate reads it as anonymous and every generator as
 * signed out (`calliopa-bootstrap`'s `BO_0312_063`).
 */
export function answerTool(name: keyof typeof TOOLS, request: ToolCall): Promise<ToolAnswer> {
  return withRunGrant(text(request.run.grant), () => TOOLS[name](request));
}
