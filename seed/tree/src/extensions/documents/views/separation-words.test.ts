import { describe, expect, it } from "vitest";

import { describeOutcome, requiresProposal } from "./documents-client";

/**
 * The core's separation-of-duties refusals as the editor says them: an
 * acceptance by whoever proposed or asked for it, in words rather than the
 * core's code, wherever the refusal arrives; a refused direct write known for
 * what it is, so the tab enters the proposal. BO_0212_011 BO_0212_012
 */
describe("separation of duties in words", () => {
  it("Given an acceptance refused as the person's own, Then it says someone else has to accept it", () => {
    const core = "separation_of_duties_refused: ann staged or asked for proposal node:branch-doc-1-ann, which touches the content of \"documents\" under separation of duties: someone else accepts it";
    const words = "Someone else has to accept this: you proposed it, or asked an agent to.";
    expect(describeOutcome({ outcome: "validationFailure", failures: [{ operation: null, rule: "accept_refused", detail: core }] })).toBe(words);
    expect(describeOutcome({ outcome: "refused", detail: core })).toBe(words);
    expect(describeOutcome({ outcome: "storageError", detail: `the kernel answered 422: ${core}` })).toBe(words);
    expect(describeOutcome({ outcome: "refused", detail: "the kernel keeps this decision behind its confirmation" })).toBe("the kernel keeps this decision behind its confirmation");
  });

  it("Given a direct write refused under the policy, Then it is known to need a proposal; any other refusal is not", () => {
    expect(requiresProposal({ outcome: "validationFailure", failures: [{ operation: null, rule: "write_refused", detail: "separation_of_duties_requires_proposal: node:x is content of \"documents\"" }] })).toBe(true);
    expect(requiresProposal({ outcome: "validationFailure", failures: [{ operation: null, rule: "separation_of_duties_requires_proposal", detail: "node:x" }] })).toBe(true);
    expect(requiresProposal({ outcome: "validationFailure", failures: [{ operation: null, rule: "write_refused", detail: "dangling_blob_reference" }] })).toBe(false);
    expect(requiresProposal({ outcome: "success", result: {} })).toBe(false);
  });
});
