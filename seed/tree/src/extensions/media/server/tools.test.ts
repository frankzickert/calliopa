import { afterEach, describe, expect, it, vi } from "vitest";

import { TOOLS, ToolRefusal } from "./tools";

/**
 * What an agent may reach. One tool, and it does not spend.
 *
 * `propose_generation` went with `BO_0273_038`: it staged a picture that was
 * not made yet, to be completed by a press of its own, and sending a block to
 * a model is that press now. An agent writes the words and names the model it
 * would use; the person sends the block.
 */
const kernel = vi.hoisted(() => ({ calls: [] as string[], ok: true, signedIn: true }));

vi.mock("~/server/kernel/client", () => ({
  call: async (path: string) => {
    kernel.calls.push(path);
    if (path === "/__kernel/media/services") {
      return {
        ok: true,
        json: async () => ({
          services: [{ service: "higgsfield", signedIn: kernel.signedIn, reason: null, models: [], openSet: {} }],
        }),
      };
    }
    return { ok: kernel.ok, json: async () => ({ status: "ok", cost: "$0.42" }) };
  },
}));

const run = { id: "arun-1", group: "node:run-1", pin: 7, person: "frankzickert" };

afterEach(() => {
  kernel.calls = [];
  kernel.ok = true;
  kernel.signedIn = true;
});

describe("what an agent may reach", () => {
  it("quotes without spending, and without a session", async () => {
    const answer = await TOOLS.quote_generation({
      input: { service: "openart", model: "byte-plus-seedream-5-pro", prompt: "a laurel" },
      run,
    });
    expect(answer.result).toEqual({ status: "ok", cost: "$0.42" });
    // The quote route and nothing that bills: the roster is read first, to
    // know whether anything can make a picture at all.
    expect(kernel.calls).toEqual(["/__kernel/media/services", "/__kernel/media/quote"]);
    expect(answer.stage).toBeUndefined();
  });

  it("refuses a quote without a service or a model", async () => {
    await expect(TOOLS.quote_generation({ input: { prompt: "x" }, run })).rejects.toBeInstanceOf(ToolRefusal);
  });

  it("refuses a quote with no words to make a picture from", async () => {
    await expect(
      TOOLS.quote_generation({ input: { service: "openart", model: "m" }, run }),
    ).rejects.toBeInstanceOf(ToolRefusal);
  });

  it("tells a run what to say when nothing is signed in, rather than failing", async () => {
    // The extension ships active, so a run may reach for this on an instance
    // where no generator is signed in. BO_0273_020
    kernel.signedIn = false;
    await expect(
      TOOLS.quote_generation({ input: { service: "openart", model: "m", prompt: "a laurel" }, run }),
    ).rejects.toThrow(/Sign in to Higgsfield or OpenArt/);
  });

  it("offers nothing that proposes a picture, and nothing that spends", () => {
    // The press that spends is a human-session route a run cannot call at all,
    // and the tool that staged a picture-not-made-yet went with BO_0273_038:
    // there is no longer a state for a second press to complete.
    expect(Object.keys(TOOLS)).toEqual(["quote_generation"]);
  });
});
