import { describe, expect, it } from "vitest";

import { liveLine } from "./live-lines";

/**
 * The lines the send control shows as an execution streams: an error is its
 * whole traceback with the escapes stripped, marked so it is drawn in colour,
 * and falls back to `name: value` when the kernel sent no traceback.
 */
describe("the live line of an event", () => {
  it("shows an error's traceback, escapes stripped, as one error line", () => {
    const line = liveLine({
      event: "error",
      name: "NameError",
      value: "name 'x' is not defined",
      traceback: ["\u001b[0;31mNameError\u001b[0m                                 Traceback (most recent call last)", "Cell \u001b[0;32mIn[1], line 1\u001b[0m", "\u001b[0;31mNameError\u001b[0m: name 'x' is not defined"],
    });
    expect(line).toEqual({
      kind: "error",
      text: "NameError                                 Traceback (most recent call last)\nCell In[1], line 1\nNameError: name 'x' is not defined\n",
    });
  });

  it("says name and value when no traceback came", () => {
    expect(liveLine({ event: "error", name: "KeyboardInterrupt", value: "" })).toEqual({ kind: "error", text: "KeyboardInterrupt: \n" });
  });

  it("shows a stream's text, a result's plain text, a picture and a cut as text, and nothing for the rest", () => {
    expect(liveLine({ event: "stream", name: "stdout", text: "42\n" })).toEqual({ kind: "text", text: "42\n" });
    expect(liveLine({ event: "result", data: { "text/plain": "42" } })).toEqual({ kind: "text", text: "42\n" });
    expect(liveLine({ event: "display", data: { "image/png": "…" } })).toEqual({ kind: "text", text: "a picture\n" });
    expect(liveLine({ event: "cut", reason: "output cap" })).toEqual({ kind: "text", text: "[cut: output cap]\n" });
    expect(liveLine({ event: "started", execution: "x-1" })).toBeNull();
    expect(liveLine({ event: "done", status: "ok" })).toBeNull();
  });
});
