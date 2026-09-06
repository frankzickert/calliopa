import { describe, expect, it } from "vitest";
import { HttpError } from "./http-error";
import { parseProcessInput, parseTransitionInput } from "./processes";

describe("process input", () => {
  it("Given a titled request for an affected item, Then it is accepted", () => {
    expect(
      parseProcessInput({
        title: "Render opening",
        step: "queued for render",
        itemId: "placeholder-scene",
        itemKind: "storyboard",
      }),
    ).toEqual({
      title: "Render opening",
      step: "queued for render",
      itemId: "placeholder-scene",
      itemKind: "storyboard",
    });
  });

  it("Given an untitled, half-identified, or unknown-kind request, Then it is rejected", () => {
    expect(() => parseProcessInput({ title: "  " })).toThrow(HttpError);
    expect(() => parseProcessInput({ title: "Render", itemId: "a" })).toThrow(
      HttpError,
    );
    expect(() =>
      parseProcessInput({ title: "Render", itemId: "a", itemKind: "sequence" }),
    ).toThrow(HttpError);
  });

  it("Given a transition, Then a failure must carry its error", () => {
    expect(parseTransitionInput({ state: "failed", error: "no renderer" })).toEqual(
      { state: "failed", step: null, error: "no renderer" },
    );
    expect(() => parseTransitionInput({ state: "failed" })).toThrow(HttpError);
    expect(() => parseTransitionInput({ state: "paused" })).toThrow(HttpError);
  });
});
