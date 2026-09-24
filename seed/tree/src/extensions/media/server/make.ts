import { call } from "~/server/kernel/client";
import { createProcess, moveProcess } from "~/server/processes";
import { putBlob, blobHash, readBlob } from "~/server/ccgw/blobs";
import { withBranch } from "~/server/ccgw/branch-scope";
import { readSession } from "~/server/session";
import { runsText } from "~/lib/runs";
import { fillMediaBlock, readDocument } from "~/extensions/documents/server/documents";

import { proposeGeneration } from "./propose";

/**
 * Making a picture (`BO_0273_017b`). **This is the only path in Calliopa that
 * spends money, and it runs only from a person's press.**
 *
 * The press does four things in order, and the order is what makes a failure
 * survivable: it stages the picture as a pending block, so there is something
 * to look at and to reject; it opens a process, so a generation that fails
 * leaves something the reader can watch fail rather than a button that did
 * nothing; it starts the job and **keeps the job id on the process**, so a
 * failure after the job exists is collected rather than paid for twice; and
 * only then does it follow the job, uploading what comes back as a blob and
 * filling the block that is already standing.
 *
 * The prompt is the block's own words, read here rather than taken from the
 * caller: the picture is made from what the document says.
 */

export interface MakeRequest {
  readonly workspaceId: string;
  readonly documentId: string;
  /** The block whose words are the prompt. */
  readonly blockId: string;
  readonly service: string;
  readonly model: string;
  readonly kind: string;
  /**
   * What the person chose on the model's axes, by axis name. An axis absent
   * from here was not chosen and is not sent, so the vendor applies its own
   * default. BO_0279_012
   */
  readonly options?: Readonly<Record<string, string>>;
}

export interface Making {
  readonly ok: boolean;
  readonly processId?: string;
  readonly group?: string;
  readonly blockId?: string;
  readonly refusal?: string;
}

/**
 * The words a block carries, or the empty string when it carries none. The
 * prompt is read here rather than taken from the caller, for the quote and for
 * the making alike: the picture is made from what the document says.
 */
/**
 * Why the generator would not take a job, in its own words (`BO_0273_040`).
 *
 * The refusal used to be thrown away and reported as *the generator did not
 * take the job*, which said nothing and hid a body the service had explained
 * perfectly well.
 */
async function refusalOf(response: Response, fallback: string): Promise<string> {
  try {
    const said = (await response.json()) as { error?: unknown };
    return typeof said.error === "string" && said.error !== "" ? said.error : fallback;
  } catch {
    return fallback;
  }
}

/**
 * What a picture is, on its way to the generator: the bytes themselves, since
 * nothing in the service holds a graph credential and the adapters take a
 * file. `role: "start"` marks it the clip's first frame rather than material
 * the prompt may name. BO_0273_045
 */
export interface ReferenceBytes {
  readonly alias: string;
  readonly role: "start";
  readonly mediaType: string;
  /** Base64, which is how the service takes bytes over JSON. */
  readonly bytes: string;
}

/** Reads the picture's bytes for the generator, or null when they will not come. */
async function startFrame(
  picture: { readonly objectId: string; readonly mediaType: string },
): Promise<ReferenceBytes | null> {
  try {
    const bytes = await readBlob(`sha256:${picture.objectId}`);
    return {
      alias: "start",
      role: "start",
      mediaType: picture.mediaType,
      bytes: Buffer.from(bytes).toString("base64"),
    };
  } catch {
    return null;
  }
}

/**
 * The picture a video send animates: the nearest one above the block whose
 * words are the prompt (`BO_0273_045`, user decision 2026-09-22).
 *
 * **Neither video generator makes a clip from words alone** — both refuse with
 * *at least one image, video, or audio reference is required* — so a send from
 * a block with nothing above it to animate is refused here, before a press can
 * spend. A picture made and still proposed counts: the reader can see it, so
 * they can mean it.
 */
export async function pictureAbove(
  documentId: string,
  blockId: string,
): Promise<{ readonly objectId: string; readonly mediaType: string } | null> {
  const read = await readDocument(documentId);
  if (read.outcome !== "success") return null;
  const blocks = read.result.blocks;
  const at = blocks.findIndex((candidate) => candidate.blockId === blockId);
  if (at < 0) return null;
  for (let step = at - 1; step >= 0; step -= 1) {
    const block = blocks[step];
    if (block === undefined || block.kind !== "image") continue;
    // A picture not made yet has no bytes to animate.
    if (block.objectId === undefined) continue;
    return { objectId: block.objectId, mediaType: block.mediaType ?? "image/png" };
  }
  return null;
}

export async function promptOf(documentId: string, blockId: string): Promise<string> {
  const read = await readDocument(documentId);
  if (read.outcome !== "success") return "";
  const block = read.result.blocks.find((candidate) => candidate.blockId === blockId);
  return block !== undefined && block.kind === "text" ? runsText(block.runs).trim() : "";
}

/**
 * Makes the same picture again, from what made it the first time
 * (`BO_0273_019`). A fresh press and a fresh cost: nothing is reused but the
 * words, and the block it fills is the one already standing.
 */
export async function remakeGeneration(input: {
  readonly workspaceId: string;
  readonly documentId: string;
  readonly blockId: string;
}): Promise<Making> {
  const person = await readSession();
  if (person === null || person.class !== "human") {
    return { ok: false, refusal: "Only a signed-in person can make a picture." };
  }
  const read = await readDocument(input.documentId);
  if (read.outcome !== "success") return { ok: false, refusal: "That document could not be read." };
  const block = read.result.blocks.find((candidate) => candidate.blockId === input.blockId);
  if (block === undefined || (block.kind !== "image" && block.kind !== "video")) {
    return { ok: false, refusal: "That block holds no picture." };
  }
  const source = block.source ?? {};
  const named = (name: string) => (typeof source[name] === "string" ? (source[name] as string).trim() : "");
  const prompt = named("prompt");
  if (prompt === "" || named("service") === "" || named("model") === "") {
    return { ok: false, refusal: "Nothing is recorded about how this picture was made." };
  }

  const process = await createProcess(
    input.workspaceId,
    {
      title: `Making a ${block.kind === "video" ? "moving picture" : "picture"} again`,
      step: "asking the generator",
      itemId: input.documentId,
      itemKind: "documents:document",
    },
    undefined,
    person.name,
  );
  const started = await call("/__kernel/media/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service: named("service"), kind: block.kind, model: named("model"), prompt }),
  });
  if (!started.ok) {
    await moveProcess(process.id, {
      state: "failed",
      step: null,
      error: await refusalOf(started, "the generator did not take the job"),
    });
    return { ok: true, processId: process.id };
  }
  const job = (await started.json()) as { id?: string };
  if (typeof job.id !== "string") {
    await moveProcess(process.id, { state: "failed", step: null, error: "the generator named no job" });
    return { ok: true, processId: process.id };
  }
  await moveProcess(process.id, { state: "running", step: `job ${job.id}`, error: null });
  void follow({
    processId: process.id,
    jobId: job.id,
    // Its own group: a second picture is a second proposal to answer.
    group: `node:media-again-${job.id}`,
    documentId: input.documentId,
    blockId: input.blockId,
  });
  return { ok: true, processId: process.id, blockId: input.blockId };
}

export async function makeGeneration(input: MakeRequest): Promise<Making> {
  const person = await readSession();
  if (person === null || person.class !== "human") {
    // The gate is the route's kind — a run reaches only callback routes — and
    // it is stated here too, where the spending happens.
    return { ok: false, refusal: "Only a signed-in person can make a picture." };
  }
  if (input.service.trim() === "" || input.model.trim() === "") {
    return { ok: false, refusal: "Choose a model first." };
  }
  const prompt = await promptOf(input.documentId, input.blockId);
  if (prompt === "") {
    return { ok: false, refusal: "This block has no words to make a picture from." };
  }

  // A video opens on a picture. Refused before the block is proposed and before
  // the press can spend, in the words that say what to do about it.
  const kind = input.kind === "video" ? "video" : "image";
  let references: readonly ReferenceBytes[] = [];
  if (kind === "video") {
    const picture = await pictureAbove(input.documentId, input.blockId);
    if (picture === null) {
      return {
        ok: false,
        refusal:
          "A video is made from a picture, and there is none above this block to animate. " +
          "Make a picture first, then write what should happen and send that to a video model.",
      };
    }
    const bytes = await startFrame(picture);
    if (bytes === null) {
      return { ok: false, refusal: "The picture above this block could not be read." };
    }
    references = [bytes];
  }

  const proposed = await proposeGeneration({
    documentId: input.documentId,
    afterBlockId: input.blockId,
    service: input.service,
    model: input.model,
    kind: input.kind,
    prompt,
  });
  if (!proposed.ok || proposed.group === undefined || proposed.blockId === undefined) {
    return { ok: false, refusal: proposed.refusal ?? "The picture could not be proposed." };
  }

  const process = await createProcess(
    input.workspaceId,
    {
      title: `Making a ${kind === "video" ? "moving picture" : "picture"}`,
      step: "asking the generator",
      itemId: input.documentId,
      itemKind: "documents:document",
    },
    undefined,
    person.name,
  );

  const started = await call("/__kernel/media/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service: input.service,
      kind,
      model: input.model,
      prompt,
      ...(references.length === 0 ? {} : { references }),
      ...(input.options === undefined || Object.keys(input.options).length === 0
        ? {}
        : { options: input.options }),
    }),
  });
  if (!started.ok) {
    await moveProcess(process.id, {
      state: "failed",
      step: null,
      error: await refusalOf(started, "the generator did not take the job"),
    });
    return { ok: true, processId: process.id, group: proposed.group, blockId: proposed.blockId };
  }
  const job = (await started.json()) as { id?: string };
  if (typeof job.id !== "string") {
    await moveProcess(process.id, { state: "failed", step: null, error: "the generator named no job" });
    return { ok: true, processId: process.id, group: proposed.group, blockId: proposed.blockId };
  }

  // The job id is the only thing that can collect a paid job without paying
  // again, so it is on the process before anything can go wrong after it.
  await moveProcess(process.id, { state: "running", step: `job ${job.id}`, error: null });

  // Followed after the answer is sent: handing over the goal is quick and the
  // making is not, and the reader watches the process rather than a held
  // request. The same posture the agent run takes.
  void follow({
    processId: process.id,
    jobId: job.id,
    group: proposed.group,
    documentId: input.documentId,
    blockId: proposed.blockId,
  });

  return { ok: true, processId: process.id, group: proposed.group, blockId: proposed.blockId };
}

interface Following {
  readonly processId: string;
  readonly jobId: string;
  readonly group: string;
  readonly documentId: string;
  readonly blockId: string;
}

/** How long a generation is waited on, and how often it is asked after. */
export interface Pace {
  readonly patienceMs: number;
  readonly betweenMs: number;
}

const PACE: Pace = { patienceMs: 15 * 60 * 1000, betweenMs: 5000 };

/**
 * Watches one job, and fills the block it was made for.
 *
 * It asks before it waits: a job may already be done, and a first look costs
 * nothing while a first sleep costs everyone the wait.
 */
export async function follow(work: Following, pace: Pace = PACE): Promise<void> {
  const until = Date.now() + pace.patienceMs;
  let first = true;
  while (Date.now() < until) {
    if (!first) await new Promise((wake) => setTimeout(wake, pace.betweenMs));
    first = false;
    const response = await call(`/__kernel/media/generations/${encodeURIComponent(work.jobId)}`, { method: "GET" });
    if (!response.ok) continue;
    const held = (await response.json()) as {
      state?: string;
      result?: { error?: { message?: unknown } };
    };
    if (held.state === "running") continue;
    if (held.state !== "completed") {
      // What the generator said, which is the whole of what a reader can act
      // on: the first two real sends failed with a message the job record held
      // and the process did not show. The job id stays in the words either
      // way — it is what collects a paid job again. BO_0273_041
      const said = held.result?.error?.message;
      const why = typeof said === "string" && said !== "" ? said : "it did not finish";
      await moveProcess(work.processId, {
        state: "failed",
        step: null,
        error: `${why} (job ${work.jobId})`,
      });
      return;
    }
    await land(work);
    return;
  }
  await moveProcess(work.processId, {
    state: "failed",
    step: null,
    error: `job ${work.jobId} did not finish in time; it can be collected by its id`,
  });
}

/** Takes the bytes, stores them, and fills the block already standing. */
async function land(work: Following): Promise<void> {
  await moveProcess(work.processId, { state: "running", step: "storing what was made", error: null });
  const made = await call(`/__kernel/media/generations/${encodeURIComponent(work.jobId)}/file`, { method: "GET" });
  if (!made.ok) {
    await moveProcess(work.processId, { state: "failed", step: null, error: "the generator made nothing to store" });
    return;
  }
  const mediaType = made.headers.get("Content-Type") ?? "application/octet-stream";
  const bytes = new Uint8Array(await made.arrayBuffer());
  const stored = await putBlob(bytes);
  if (stored.outcome !== "success") {
    await moveProcess(work.processId, { state: "failed", step: null, error: "the bytes could not be stored" });
    return;
  }

  const read = await withBranch(work.group, () => readDocument(work.documentId));
  if (read.outcome !== "success") {
    await moveProcess(work.processId, { state: "failed", step: null, error: "the document could not be read back" });
    return;
  }
  const pending = read.result.blocks.find((block) => block.blockId === work.blockId);
  if (pending === undefined) {
    // Rejected while it was being made. The bytes stay in the store, referenced
    // by nothing, and the staging GC takes them: nothing is forced back into a
    // document the reader has already answered.
    await moveProcess(work.processId, { state: "completed", step: null, error: null });
    return;
  }

  const filled = await withBranch(work.group, () =>
    fillMediaBlock({
      documentId: work.documentId,
      blockId: work.blockId,
      baseRevisionId: pending.revisionId,
      reference: { _kind: "blob", hash: blobHash(stored.result.hash.replace(/^sha256:/, "")), mediaType, size: stored.result.size },
    }),
  );
  await moveProcess(work.processId, {
    state: filled.outcome === "success" ? "completed" : "failed",
    step: null,
    error: filled.outcome === "success" ? null : "the picture could not be put in the document",
  });
}
