import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { RequestEvent } from "@builder.io/qwik-city";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { onPut } from "~/routes/api/agent/choice";

/**
 * The route that remembers the composer's choice for the instance: it takes
 * one of the three agents and writes it, and refuses anything else in words
 * with nothing written. BO_0228_014
 */
describe("remembering the composer's choice", () => {
  const previous = process.env["CALLIOPA_AGENT_CONFIG_DIR"];
  let dir = "";

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "agent-choice-"));
    process.env["CALLIOPA_AGENT_CONFIG_DIR"] = dir;
  });

  afterEach(() => {
    if (previous === undefined) delete process.env["CALLIOPA_AGENT_CONFIG_DIR"];
    else process.env["CALLIOPA_AGENT_CONFIG_DIR"] = previous;
  });

  const put = async (
    body: string,
  ): Promise<{ status: number; body: unknown }> => {
    const answer = { status: 0, body: null as unknown };
    const event = {
      request: new Request("http://shell/api/agent/choice", {
        method: "PUT",
        body,
      }),
      cacheControl: () => undefined,
      json: (status: number, value: unknown) => {
        answer.status = status;
        answer.body = value;
      },
    } as unknown as RequestEvent;
    await onPut(event);
    return answer;
  };

  const written = () =>
    readFile(join(dir, "agent-choice.json"), "utf8").then(
      JSON.parse,
      () => null,
    );

  it("Given one of the three agents, Then it is written for the instance", async () => {
    expect(await put(JSON.stringify({ agent: "claude-code" }))).toEqual({
      status: 200,
      body: { chosen: "claude-code" },
    });
    expect(await written()).toMatchObject({ agent: "claude-code" });
  });

  it("Given anything else, Then it is refused in words and nothing is written", async () => {
    for (const body of [
      JSON.stringify({ agent: "provider" }),
      JSON.stringify({}),
      "not json",
    ]) {
      const answer = await put(body);
      expect(answer.status).toBe(400);
      expect(answer.body).toEqual({
        error: "agent must be codex, claude-code or hermes",
      });
    }
    expect(await written()).toBeNull();
  });
});
