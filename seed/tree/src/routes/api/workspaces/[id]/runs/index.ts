import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { readAttachments, readCommandTarget, readGestureTarget, readRunShape } from "~/lib/command-target";
import { writeAttachments } from "~/server/agent/attachments";
import { conductRun, followRun } from "~/server/agent/conductor";
import { senderExtension, sendToSender } from "~/server/registry";

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
    const target = shape.gesture ? readGestureTarget(body) : readCommandTarget(body);
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

    // A command sent to a contributed sender is not a run: the extension that
    // offered it does the work and answers a process to watch, as a run
    // answers one. The press on *Send* is the whole gesture either way.
    // BO_0273_035
    const chosen = typeof body.agent === "string" ? body.agent : "";
    const given = body.options;
    const options =
      given !== null && typeof given === "object" && !Array.isArray(given)
        ? Object.fromEntries(
            Object.entries(given as Record<string, unknown>)
              .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
          )
        : null;
    if (chosen !== "" && senderExtension(chosen) !== null) {
      const sent = await sendToSender({
        workspaceId: event.params.id ?? "",
        sender: chosen,
        documentId: target.target.artifact,
        // A command is always written in a block, and a sender makes what it
        // makes from that block's words.
        blockId: target.target.source?.block ?? "",
        // What the reader chose on the sender's axes, kept as strings: the
        // sender decides what an axis means and refuses what it does not
        // offer. BO_0279_010
        ...(options === null ? {} : { options }),
      });
      if (!sent.ok) {
        event.json(400, { error: sent.error ?? "That could not be sent." });
        return;
      }
      event.json(201, { processId: sent.processId, sender: chosen });
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
