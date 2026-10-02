import { describe, expect, it } from "vitest";

import { sourceAnswer } from "./works";

/**
 * A source's routes answer a document that is no source as an ordinary
 * answer, so opening one logs no failed request; every other outcome answers
 * as before. BI_0001_001
 */
describe("a source's read as its routes answer it", () => {
  it("Given a document that is no source, Then the answer is 200 with noResult and the refusal's words", () => {
    const answer = sourceAnswer({ outcome: "validationFailure", failures: [{ operation: null, rule: "unknownWork", detail: "node:x is not a source." }] });
    expect(answer).toEqual({ status: 200, body: { outcome: "noResult", detail: "node:x is not a source." } });
  });

  it("Given a source, another refusal or a storage error, Then each answers as before", () => {
    expect(sourceAnswer({ outcome: "success", result: { title: "A source" } }).status).toBe(200);
    expect(sourceAnswer({ outcome: "validationFailure", failures: [{ operation: null, rule: "requestShape", detail: "no" }] }).status).toBe(400);
    expect(sourceAnswer({ outcome: "storageError", detail: "CCGW is unreachable" }).status).toBe(500);
  });
});
