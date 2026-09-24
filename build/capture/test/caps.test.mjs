// The caps: a value that is not given keeps its default, a value that is
// given replaces it. Found on the first standalone run, where unset
// environment variables arrived as undefined and every file was dropped for
// not finishing "within undefined ms". BO_0277_002
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CAPS, limitsOf } from "../lib/capture.mjs";

test("an unset cap keeps its default and a set one replaces it", () => {
  const limits = limitsOf({ loadMs: undefined, renderMs: null, maxBytes: 10 });
  assert.equal(limits.loadMs, DEFAULT_CAPS.loadMs);
  assert.equal(limits.renderMs, DEFAULT_CAPS.renderMs);
  assert.equal(limits.maxBytes, 10);
  assert.equal(limits.maxTextChars, DEFAULT_CAPS.maxTextChars);
  assert.deepEqual(limitsOf(), DEFAULT_CAPS);
});
