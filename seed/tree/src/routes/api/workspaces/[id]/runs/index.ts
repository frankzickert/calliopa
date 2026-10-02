import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { readAttachments, readCommandTarget, readGestureTarget, readMode, readPinchTarget, readRunShape } from "~/lib/command-target";
import { writeAttachments } from "~/server/agent/attachments";
import { conductRun, followRun } from "~/server/agent/conductor";
import { isRecordId } from "~/server/uuid";

/**
 * Starts an agent run for a goal through the kernel's agent bridge.
 *
 * The run is followed after the response is sent: the bridge takes a goal
 * quickly, the run takes as long as it takes, and the shell learns how it is
 * going by polling the registry rather than by holding a request open. A
 * refusal is answered with the kernel's reason so the surface that asked can
 * say it in words. BO_0207_015
 *
 * A command from an open document carries what it was aimed at — the
 * document, where its work goes, and what the reader marked — and a shape the
 * composer never sends is refused here by name rather than forwarded.
 * BO_0226_004
 *
 * A command sent from a block names the block and the revision sent, and no
 * goal: the kernel reads its words from that revision. BO_0267_009
 *
 * The files a command carries arrive as the descriptors the upload answered;
 * each becomes one `attachment` node, written as the person before the run
 * starts, and the run is handed their ids. BO_0229_009
 */
export const onPost: RequestHandler = (event) =>
  api(event, async () => {
    const body = (await event.request.json()) as {
      goal?: unknown;
      agent?: unknown;
      speed?: unknown;
      artifact?: unknown;
      delivery?: unknown;
      references?: unknown;
      branch?: unknown;
    options?: unknown;
      attachments?: unknown;
      source?: unknown;
      intention?: unknown;
      mode?: unknown;
      commandOptions?: unknown;
      pinch?: unknown;
      block?: unknown;
    };
    const goal = typeof body.goal === "string" ? body.goal.trim() : "";
    // The shape decides which target is read: a gesture names the document it
    // was made in and nothing else, where a command names the block it was
    // written in and the revision sent. Reading a command's target from a
    // gesture refused it for having no source block, which is the one thing a
    // gesture never has. BO_0258_006
    const shape = readRunShape(body);
    if (!shape.ok) {
      event.json(400, { error: shape.error });
      return;
    }
    // A pinch names the document and its one block, and nothing it was
    // written in. BO_0322_016
    const target = shape.gesture ? readGestureTarget(body) : shape.pinch !== undefined ? readPinchTarget(body) : readCommandTarget(body);
    if (!target.ok) {
      event.json(400, { error: target.error });
      return;
    }
    const intention = shape.gesture ? shape.intention : "";
    const attached = readAttachments(body.attachments);
    if (!attached.ok) {
      event.json(400, { error: attached.error });
      return;
    }
    const written = await writeAttachments(attached.attachments);
    if (!written.ok) {
      event.json(written.status, { error: written.error });
      return;
    }

    const mode = readMode(body.mode);
    // The instruction the command's chip chose, the one option the kernel reads;
    // a gesture carries none. BO_0311_002 BO_0311_030
    const commandOptions = body.commandOptions;
    const chosenInstruction =
      !shape.gesture && commandOptions !== null && typeof commandOptions === "object" ? (commandOptions as Record<string, unknown>)["instruction"] : undefined;
    if (chosenInstruction !== undefined && (typeof chosenInstruction !== "string" || !isRecordId(chosenInstruction))) {
      event.json(400, { error: "a command's instruction is an instruction's id" });
      return;
    }
    // The variation of the instruction's format chosen beside Send; the kernel
    // refuses one that is not the format's. BO_0336_050
    const chosenVariation =
      !shape.gesture && commandOptions !== null && typeof commandOptions === "object" ? (commandOptions as Record<string, unknown>)["variation"] : undefined;
    if (chosenVariation !== undefined && (typeof chosenVariation !== "string" || !isRecordId(chosenVariation))) {
      event.json(400, { error: "a command's variation is a variation block's id" });
      return;
    }
    const started = await conductRun({
      workspaceId: event.params.id ?? "",
      goal,
      ...(typeof body.agent === "string" && body.agent !== "" ? { agent: body.agent } : {}),
      // Fast or thorough; the kernel takes none as fast. BO_0269_015
      ...(body.speed === "fast" || body.speed === "thorough" ? { speed: body.speed } : {}),
      target: target.target,
      // A command from a tab in a branch: the run proposes into it. BO_0250_005
      ...(typeof body.branch === "string" && body.branch !== "" ? { group: body.branch } : {}),
      ...(written.ids.length === 0 ? {} : { attachments: written.ids }),
      // The kernel refuses an intention whose extension is switched off, by
      // name, which is the check a gesture needs when refinement is off.
      // BO_0264_006 BO_0258_006
      ...(intention === "" ? {} : { intention }),
      // The working mode in force on the document the run came from, which
      // the kernel refuses by name when it is not one. BO_0306_017
      ...(mode === undefined ? {} : { mode }),
      ...(chosenInstruction === undefined ? {} : { instruction: chosenInstruction }),
      ...(chosenVariation === undefined ? {} : { variation: chosenVariation }),
      ...(shape.pinch === undefined ? {} : { pinch: shape.pinch }),
    });
    if (!started.ok) {
      event.json(started.reason === "conflict" ? 409 : started.reason === "refused" ? 400 : started.reason === "forbidden" ? 403 : 502, {
        error: started.detail,
      });
      return;
    }

    void followRun(started.process.id, started.runId);
    event.json(201, {
      runId: started.runId,
      processId: started.process.id,
    });
  });
