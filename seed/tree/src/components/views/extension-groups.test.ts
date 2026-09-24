import { describe, expect, it } from "vitest";
import { candidateHref, gateWords, touchWords } from "./extension-groups";

/**
 * The words the staged-changes panel stands on. A person judges a change by
 * these and never by a diff, so what they say has to be exact: a gate nobody
 * ran must read as not run and never as failed. BO_0282_008
 */
describe("gateWords", () => {
  it("names a gate that was not run as not run, never as failed", () => {
    expect(gateWords({ buildOk: true, checkOk: false, testOk: false })).toBe(
      "build passed, check and tests not run",
    );
  });

  it("says so plainly when every gate passed", () => {
    expect(gateWords({ buildOk: true, checkOk: true, testOk: true })).toBe(
      "build, check and tests passed",
    );
  });

  it("says no gate was run rather than claiming a failure", () => {
    expect(gateWords({ buildOk: false, checkOk: false, testOk: false })).toBe("no gate was run");
  });
});

describe("touchWords", () => {
  it("reads the member counts in a stable order", () => {
    expect(touchWords({ "ext.source": 3, "ext.manifest": 1 })).toBe("1 ext.manifest, 3 ext.source");
  });

  it("says nothing when the group touches no member", () => {
    expect(touchWords(undefined)).toBe("");
  });
});

describe("candidateHref", () => {
  // The kernel states the port alone because the host is whatever the
  // browser used to reach it; the address is completed here.
  it("puts the candidate on the host the browser is already on", () => {
    expect(candidateHref(":8092", { protocol: "https:", hostname: "box.local" })).toBe(
      "https://box.local:8092/",
    );
  });

  it("takes a bare port too", () => {
    expect(candidateHref("8092", { protocol: "http:", hostname: "127.0.0.1" })).toBe(
      "http://127.0.0.1:8092/",
    );
  });
});
