import { describe, expect, it } from "vitest";

import { candidates, check, parseReleases } from "./releases";

/**
 * The release check over a captured list, since GitHub cannot be told what to
 * answer: the three types above an installed release, one release under one
 * type only, nothing above the newest, and every release with the installed
 * one findable. BO_0223_015
 */

const row = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  published_at: `2026-09-0${tag.length % 9}T00:00:00Z`,
  html_url: `https://github.com/frankzickert/calliopa/releases/tag/${tag}`,
  draft: false,
  prerelease: false,
  ...extra,
});

const captured = [
  row("v0.3.1"),
  row("v0.3.3"),
  row("v0.3.2"),
  row("v0.3.5"),
  row("v0.4.0"),
  row("v0.4.2"),
  row("v1.0.0"),
  row("v1.1.0"),
  row("v1.2.0-rc1"),
  row("v2.0.0", { prerelease: true }),
  row("v2.0.1", { draft: true }),
  row("nightly"),
];

describe("the release check", () => {
  it("Given GitHub's list, Then drafts, prereleases and unparseable tags are dropped and the rest is newest first", () => {
    const releases = parseReleases(captured);
    expect(releases.map((r) => r.version)).toEqual(["1.1.0", "1.0.0", "0.4.2", "0.4.0", "0.3.5", "0.3.3", "0.3.2", "0.3.1"]);
    expect(releases[0]?.url).toContain("/tag/v1.1.0");
  });

  it("Given an installed 0.3.3, Then the newest patch, minor and major above it are the candidates, highest type first", () => {
    const found = candidates("0.3.3", parseReleases(captured));
    expect(found.map((c) => [c.type, c.release.version])).toEqual([
      ["major", "1.1.0"],
      ["minor", "0.4.2"],
      ["patch", "0.3.5"],
    ]);
  });

  it("Given a release that is both the newest minor and the newest patch, Then it is listed once under its highest type", () => {
    const list = parseReleases([row("v0.3.3"), row("v0.3.4")]);
    expect(candidates("0.3.3", list).map((c) => [c.type, c.release.version])).toEqual([["patch", "0.3.4"]]);
    const across = parseReleases([row("v0.3.3"), row("v0.4.0"), row("v1.0.0")]);
    expect(candidates("0.4.0", across).map((c) => [c.type, c.release.version])).toEqual([["major", "1.0.0"]]);
  });

  it("Given the installed release is the newest, Then there is no candidate; given an unparseable installed version, none either", () => {
    expect(candidates("1.1.0", parseReleases(captured))).toEqual([]);
    expect(candidates("", parseReleases(captured))).toEqual([]);
    expect(candidates("local", parseReleases(captured))).toEqual([]);
  });

  it("Given the whole answer, Then every release is there for the all-versions list with the installed one findable", () => {
    const result = check("0.3.3", captured);
    expect(result.releases.some((r) => r.version === "0.3.3")).toBe(true);
    expect(result.releases.filter((r) => r.major === 0 && r.minor === 3 && r.patch < 3).map((r) => r.version)).toEqual([
      "0.3.2",
      "0.3.1",
    ]);
    expect(result.candidates.length).toBe(3);
  });

  it("Given something that is not a list, Then nothing is a release", () => {
    expect(parseReleases({ message: "rate limited" })).toEqual([]);
    expect(parseReleases(null)).toEqual([]);
  });
});
