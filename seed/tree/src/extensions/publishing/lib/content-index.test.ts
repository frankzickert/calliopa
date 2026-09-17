import { describe, expect, it } from "vitest";

import { isAddressed, isSingleton, parseContentIndex, reconcileIndex, routeRefusal, type ContentIndex } from "./content-index";

/**
 * The parser is the refusal rule: a broken index stores nothing and the
 * refusal names the entry and the field; unknown properties are stripped;
 * a key that vanishes is retired while assigned and dropped otherwise.
 * Proven over plain values, without a site. PU_0001_007
 */

const good = () => ({
  version: 1,
  containers: [
    {
      key: "episodes",
      title: "Episode",
      route: "/episodes/{number}",
      fields: [
        { key: "title", title: "Title", type: "line" },
        { key: "premise", title: "Premise", type: "text" },
      ],
      extra: "ignored",
    },
    { key: "about", title: "About", route: "/about" },
  ],
  slots: [
    { key: "scene", title: "Scene", class: "video", container: "episodes", required: true, aspect: "9:16", maxDurationSeconds: 180 },
    { key: "still", title: "Still", class: "image", container: "episodes", formats: ["png", "jpg"], maxCount: 4 },
    { key: "prose", title: "Prose", class: "prose", container: "episodes" },
  ],
  copy: [{ key: "tagline", title: "Tagline", type: "line", group: "Home" }],
});

const refusals = (value: unknown): string[] => {
  const parsed = parseContentIndex(value);
  return parsed.ok ? [] : parsed.refusals.map((found) => `${found.entry}.${found.field}: ${found.message}`);
};

describe("parsing a website's content index", () => {
  it("Given a well-formed index, Then it parses with defaults filled and unknown properties stripped", () => {
    const parsed = parseContentIndex(good());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.index.containers.map((container) => container.key)).toEqual(["episodes", "about"]);
    expect(parsed.index.containers[0]).not.toHaveProperty("extra");
    expect(parsed.index.containers[1]?.fields).toEqual([]);
    expect(parsed.index.slots[0]).toMatchObject({ class: "video", required: true, aspect: "9:16", maxDurationSeconds: 180, formats: [] });
    expect(parsed.index.slots[1]).toMatchObject({ required: false, aspect: null, formats: ["png", "jpg"], maxCount: 4 });
    expect(parsed.index.copy[0]).toMatchObject({ key: "tagline", type: "line", group: "Home" });
  });

  it("Given something that is not an object, Then it is refused as not an index", () => {
    expect(refusals("<html>")).toEqual(["index.: the index must be a JSON object."]);
  });

  it("Given the wrong version, Then the version is named", () => {
    expect(refusals({ ...good(), version: 2 })).toContain("index.version: version must be 1.");
  });

  it("Given every kind of broken entry, Then every refusal is named at once, and the index stores nothing", () => {
    const broken = {
      version: 1,
      containers: [
        { key: "Bad Key", title: "", route: "episodes/{n}" },
        { key: "twice", title: "Twice", route: "/twice" },
        { key: "twice", title: "Twice again", route: "/twice/{parent}" },
      ],
      slots: [
        { key: "scene", title: "Scene", class: "movie", container: "nowhere", aspect: "2:3", maxCount: 0 },
        { key: "scene", title: "Scene", class: "video", container: "twice", formats: [1] },
      ],
      copy: [{ key: "Tag Line", title: "Tagline", type: "date" }],
    };
    const found = refusals(broken);
    expect(found).toEqual(
      expect.arrayContaining([
        "containers[0].key: key must be lowercase letters, digits and hyphens.",
        "containers[0].title: title must not be blank.",
        "containers[0].route: route must start with /.",
        "containers[2].key: key twice is listed twice.",
        "containers[2].route: route names {parent} without {number} or {slug}.",
        "slots[0].class: class must be one of video, image, audio, prose, file.",
        "slots[0].container: container nowhere is not listed.",
        "slots[0].aspect: aspect must be one of 16:9, 9:16, 1:1, 4:5.",
        "slots[0].maxCount: maxCount must be a whole number above zero.",
        "slots[1].key: key scene is listed twice.",
        "slots[1].formats: formats must be a list of names.",
        "copy[0].key: key must be lowercase letters, digits and underscores.",
        "copy[0].type: type must be one of line, text.",
      ]),
    );
    expect(found.length).toBeGreaterThanOrEqual(13);
  });

  it("Given a route, Then its placeholders decide whether the container exists once, per number or per address", () => {
    expect(routeRefusal("/about")).toBeNull();
    expect(isSingleton("/about")).toBe(true);
    expect(routeRefusal("/episodes/{number}")).toBeNull();
    expect(isSingleton("/episodes/{number}")).toBe(false);
    expect(isAddressed("/episodes/{number}")).toBe(false);
    expect(routeRefusal("/episodes/{parent}/parts/{number}")).toBeNull();
    expect(routeRefusal("/episodes/{slug}")).toBeNull();
    expect(isAddressed("/episodes/{slug}")).toBe(true);
    expect(isSingleton("/episodes/{slug}")).toBe(false);
    expect(routeRefusal("/serials/{parent}/episodes/{slug}")).toBeNull();
    expect(routeRefusal("/episodes/{id}")).toBe("route names {id}; only {number}, {slug} and {parent} are placeholders.");
    expect(routeRefusal("/episodes/{number}/{slug}")).toBe(
      "route names both {number} and {slug}; a container is numbered or addressed, not both.",
    );
    expect(routeRefusal("/x/{parent}")).toBe("route names {parent} without {number} or {slug}.");
  });

  it("Given reference and integer fields, slot fields and crops, Then they parse, and a reference may name a container listed later", () => {
    const parsed = parseContentIndex({
      version: 1,
      containers: [
        {
          key: "episodes",
          title: "Episode",
          route: "/episodes/{slug}",
          fields: [
            { key: "home_serial", title: "Home serial", type: "reference", container: "serials" },
            { key: "also_in", title: "Also in", type: "reference", container: "serials", many: true },
            { key: "position", title: "Position", type: "integer" },
          ],
        },
        { key: "serials", title: "Serial", route: "/serials/{slug}" },
      ],
      slots: [
        {
          key: "scene",
          title: "Scene",
          class: "video",
          container: "episodes",
          fields: [
            { key: "transcript", title: "Transcript", type: "text" },
            { key: "host_id", title: "Video id", type: "line" },
          ],
        },
        { key: "teaser", title: "Teaser", class: "image", container: "episodes", required: true, aspects: ["16:9", "9:16", "1:1"] },
      ],
      copy: [],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const episode = parsed.index.containers[0];
    expect(episode?.fields.map((field) => [field.key, field.type, field.container, field.many])).toEqual([
      ["home_serial", "reference", "serials", false],
      ["also_in", "reference", "serials", true],
      ["position", "integer", null, false],
    ]);
    expect(parsed.index.slots[0]?.fields.map((field) => field.key)).toEqual(["transcript", "host_id"]);
    expect(parsed.index.slots[1]).toMatchObject({ aspect: null, aspects: ["16:9", "9:16", "1:1"], fields: [] });
    expect(episode?.fields.every((field) => field.slot === null && !field.required)).toBe(true);
  });

  it("Given an entry field, Then it names a slot of its own container — listed before or after — and may be required or a list", () => {
    const parsed = parseContentIndex({
      version: 1,
      containers: [
        {
          key: "episodes",
          title: "Episode",
          route: "/episodes/{slug}",
          fields: [
            { key: "card_scene", title: "Card scene", type: "entry", slot: "scene" },
            { key: "title", title: "Title", type: "line", required: true },
          ],
        },
        {
          key: "site",
          title: "Site",
          route: "/site",
          fields: [
            { key: "flagship_scene", title: "Flagship scene", type: "entry", slot: "hero", required: true },
            { key: "gallery", title: "Gallery", type: "entry", slot: "hero", many: true },
          ],
        },
      ],
      slots: [
        { key: "scene", title: "Scene", class: "video", container: "episodes" },
        { key: "hero", title: "Hero", class: "image", container: "site" },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.index.containers[0]?.fields.map((field) => [field.type, field.slot, field.required, field.many])).toEqual([
      ["entry", "scene", false, false],
      ["line", null, true, false],
    ]);
    expect(parsed.index.containers[1]?.fields.map((field) => [field.slot, field.required, field.many])).toEqual([
      ["hero", true, false],
      ["hero", false, true],
    ]);
  });

  it("Given an entry field misused, Then each is refused naming the entry and the field", () => {
    const found = refusals({
      version: 1,
      containers: [
        {
          key: "episodes",
          title: "Episode",
          route: "/episodes/{slug}",
          fields: [
            { key: "other", title: "Other", type: "entry", slot: "hero" },
            { key: "none", title: "None", type: "entry" },
            { key: "title", title: "Title", type: "line", slot: "scene" },
          ],
        },
        { key: "site", title: "Site", route: "/site" },
      ],
      slots: [
        { key: "scene", title: "Scene", class: "video", container: "episodes" },
        { key: "hero", title: "Hero", class: "image", container: "site" },
      ],
    });
    expect(found).toEqual(
      expect.arrayContaining([
        "containers[0].fields[0].slot: slot hero is not a slot of this container.",
        "containers[0].fields[1].slot: slot is required.",
        "containers[0].fields[2].slot: slot belongs to an entry field.",
      ]),
    );
  });

  it("Given the widenings misused, Then each is refused naming the entry and the field", () => {
    const found = refusals({
      version: 1,
      containers: [
        {
          key: "episodes",
          title: "Episode",
          route: "/episodes/{slug}",
          fields: [
            { key: "home_serial", title: "Home serial", type: "reference", container: "nowhere" },
            { key: "no_target", title: "No target", type: "reference" },
            { key: "title", title: "Title", type: "line", container: "serials", many: true },
          ],
        },
      ],
      slots: [
        { key: "teaser", title: "Teaser", class: "image", container: "episodes", aspect: "16:9", aspects: ["16:9", "16:9", "2:3"] },
        {
          key: "scene",
          title: "Scene",
          class: "video",
          container: "episodes",
          fields: [
            { key: "a", title: "A", type: "line" },
            { key: "a", title: "A again", type: "line" },
          ],
        },
      ],
      copy: [],
    });
    expect(found).toEqual(
      expect.arrayContaining([
        "containers[0].fields[0].container: container nowhere is not listed.",
        "containers[0].fields[1].container: container is required.",
        "containers[0].fields[2].container: container belongs to a reference field.",
        "containers[0].fields[2].many: many belongs to a reference or entry field.",
        "slots[0].aspects: aspects must be a list of 16:9, 9:16, 1:1, 4:5.",
        "slots[1].fields[1].key: key a is listed twice.",
      ]),
    );
    const twice = refusals({
      version: 1,
      containers: [{ key: "c", title: "C", route: "/c" }],
      slots: [{ key: "s", title: "S", class: "image", container: "c", aspect: "1:1", aspects: ["16:9", "16:9"] }],
    });
    expect(twice).toEqual(
      expect.arrayContaining(["slots[0].aspects: aspects lists an aspect twice.", "slots[0].aspects: aspects and aspect cannot both be declared."]),
    );
  });
});

describe("laying a fresh read over what was stored", () => {
  const fresh = (): ContentIndex => {
    const parsed = parseContentIndex(good());
    if (!parsed.ok) throw new Error("fixture");
    return parsed.index;
  };

  it("Given nothing stored, Then every entry is current and nothing is retired or dropped", () => {
    const result = reconcileIndex(null, fresh(), new Set(), "2026-09-14T10:00:00.000Z");
    expect(result.stored.readAt).toBe("2026-09-14T10:00:00.000Z");
    expect(result.stored.slots.every((kept) => kept.inIndex)).toBe(true);
    expect(result.retired).toEqual([]);
    expect(result.dropped).toEqual([]);
    expect(result.reclassed).toEqual([]);
  });

  it("Given a key the site no longer lists, Then it is retired while assigned and dropped otherwise", () => {
    const first = reconcileIndex(null, fresh(), new Set(), "2026-09-14T10:00:00.000Z");
    const later = fresh();
    const without = { ...later, slots: later.slots.filter((slot) => slot.key === "scene"), copy: [] };
    const result = reconcileIndex(first.stored, without, new Set(["slot:still"]), "2026-09-14T11:00:00.000Z");
    expect(result.retired).toEqual(["slot:still"]);
    expect(result.dropped).toEqual(["slot:prose", "copy:tagline"]);
    expect(result.stored.slots.map((kept) => [kept.entry.key, kept.inIndex])).toEqual([
      ["scene", true],
      ["still", false],
    ]);
    expect(result.stored.copy).toEqual([]);
  });

  it("Given a slot whose class changed, Then it is named so what was assigned to it can be dropped", () => {
    const first = reconcileIndex(null, fresh(), new Set(), "2026-09-14T10:00:00.000Z");
    const later = fresh();
    const changed = { ...later, slots: later.slots.map((slot) => (slot.key === "still" ? { ...slot, class: "video" as const } : slot)) };
    const result = reconcileIndex(first.stored, changed, new Set(), "2026-09-14T11:00:00.000Z");
    expect(result.reclassed).toEqual(["slot:still"]);
  });
});
