import { call } from "~/server/kernel/client";
import { blobReference, putBlob } from "~/server/ccgw/blobs";
import { withBranch } from "~/server/ccgw/branch-scope";
import { withRunGrant } from "~/server/request-context";
import { composeMediaFill, composeMediaInsert } from "~/extensions/documents/server/documents";

import { anyGeneratorSignedIn } from "./source";
import { pictureAbove, promptOf, startFrame, type ReferenceBytes } from "./make";
import { roster } from "./media";
import { offeredFrom, offeredRoster } from "./offered";

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
    readonly profileType?: string;
    readonly imageBackend?: string;
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

const stringOptions = (value: unknown): Record<string, string> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
};

/** The backends each kind of profile may name: Codex makes pictures only. */
const BACKENDS: Readonly<Record<"image" | "video", readonly string[]>> = {
  image: ["higgsfield", "openart", "codex"],
  video: ["higgsfield", "openart"],
};

/**
 * Start one image or video job and stage its pending block into the person's
 * Send group (`calliopa-bootstrap`'s `BO_0312_041`). What is made is the
 * profile's kind — an image or a video profile, its backend saved with it
 * (`BO_0320`); no *Format* is read (`BO_0332_034`). A video animates
 * the nearest picture above the block, as a send to a video model did
 * (`BO_0273_045`). Every refusal comes before the paid request.
 */
async function generate(request: ToolCall): Promise<ToolAnswer> {
  const documentId = request.run.document ?? "";
  const blockId = text(request.input["block"]);
  const backend = text(request.run.imageBackend);
  if (backend === "codex") {
    throw new ToolRefusal("Image generation is temporarily unavailable for this profile.");
  }
  const kind = request.run.profileType === "image" || request.run.profileType === "video" ? request.run.profileType : null;
  if (kind === null || !BACKENDS[kind].includes(backend)) {
    throw new ToolRefusal("Choose an image- or video-generation profile with its backend before generating.");
  }
  if (documentId === "" || blockId === "" || request.run.group === "") {
    throw new ToolRefusal(`A ${kind} generation needs the document and prompt block from this Send.`);
  }
  // The profile says what is made, an image or a video; no Format is read,
  // since Format is what a whole document is produced as (calliopa-bootstrap's
  // BO_0332_034).
  const all = await roster();
  const service = all.find((one) => one.service === backend);
  if (service === undefined || !service.signedIn) {
    throw new ToolRefusal(service?.reason ?? `Sign in to ${backend} in Settings before generating.`);
  }
  const offered = backend === "codex" ? service.models : (await offeredRoster(offeredFrom(request.settings))).find((one) => one.service === backend)?.models ?? [];
  const requestedModel = text(request.input["model"]);
  if (backend === "codex" && requestedModel !== "" && requestedModel !== "codex-image") {
    throw new ToolRefusal("The Codex image profile uses the codex-image model.");
  }
  const model = backend === "codex"
    ? "codex-image"
    : requestedModel === ""
      ? offered.find((one) => one.kind === kind && one.default)?.model ?? offered.find((one) => one.kind === kind)?.model ?? ""
      : offered.some((one) => one.model === requestedModel && one.kind === kind)
        ? requestedModel
        : "";
  if (model === "" || !service.models.some((one) => one.model === model && one.kind === kind)) {
    throw new ToolRefusal(`No offered ${kind} model is available for ${backend}.`);
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

  // Compose before the paid request, so an invalid placement never spends.
  const plan = await composeMediaInsert({
    documentId,
    block: { kind, alt: prompt, source: { extension: "media", service: backend, model, prompt, pending: true } },
    placement: { after: blockId },
  });
  if (!plan.ok) throw new ToolRefusal(plan.refusal);
  const options = stringOptions(request.input["options"]);
  if (backend === "codex" && Object.keys(options).length > 0) {
    throw new ToolRefusal("Codex image generation does not take model options; follow the image profile instead.");
  }
  const started = await call("/__kernel/media/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service: backend,
      kind,
      model,
      prompt,
      ...(references.length === 0 ? {} : { references }),
      ...(Object.keys(options).length === 0 ? {} : { options }),
    }),
  });
  if (!started.ok) throw new ToolRefusal(`The media service refused the ${kind} job.`);
  const job = (await started.json()) as { id?: string };
  if (typeof job.id !== "string" || job.id === "") throw new ToolRefusal("The media service returned no job id.");
  plan.parameters["b_source"] = {
    extension: "media", service: backend, model, prompt, job: job.id,
    cost: backend === "codex" ? "unavailable" : undefined,
    proposedAt: new Date().toISOString(),
  };
  return {
    result: { status: "running", kind, job: job.id, block: plan.blockId, ...(backend === "codex" ? { cost: "unavailable" } : {}) },
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
