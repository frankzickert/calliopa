import { deflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { readMediaFacts } from "./media-facts";

/**
 * The fixtures are built to each format's own specification rather than
 * stubbed, so what the reader is proved against is a real PNG, a real JPEG
 * marker sequence, and a real ISO base media box tree.
 */

const be32 = (value: number): number[] => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];

const be16 = (value: number): number[] => [(value >>> 8) & 0xff, value & 0xff];

const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

function crc32(bytes: readonly number[]): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const chunk = (type: string, data: readonly number[]): number[] => {
  const body = [...ascii(type), ...data];
  return [...be32(data.length), ...body, ...be32(crc32(body))];
};

/** A complete, valid PNG of the given size: signature, IHDR, IDAT, IEND. */
function png(width: number, height: number): Uint8Array {
  const raw: number[] = [];
  for (let row = 0; row < height; row += 1) {
    raw.push(0);
    for (let column = 0; column < width; column += 1) raw.push(0, 0, 0);
  }
  const pixels = [...deflateSync(Buffer.from(raw))];
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk("IHDR", [...be32(width), ...be32(height), 8, 2, 0, 0, 0]),
    ...chunk("IDAT", pixels),
    ...chunk("IEND", []),
  ]);
}

/** SOI, a JFIF APP0 segment, then a baseline SOF0 carrying the dimensions. */
function jpeg(width: number, height: number): Uint8Array {
  const app0 = [
    0xff, 0xe0, ...be16(16), ...ascii("JFIF"), 0x00, 1, 1, 0, ...be16(1), ...be16(1),
    0, 0,
  ];
  const sof0 = [
    0xff, 0xc0, ...be16(11), 8, ...be16(height), ...be16(width), 1, 1, 0x11, 0,
  ];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof0, 0xff, 0xd9]);
}

const box = (type: string, payload: readonly number[]): number[] => [
  ...be32(payload.length + 8),
  ...ascii(type),
  ...payload,
];

/** ftyp plus a moov holding an mvhd and a video trak's tkhd. */
function mp4(input: {
  readonly width: number;
  readonly height: number;
  readonly seconds: number;
}): Uint8Array {
  const timescale = 600;
  const mvhd = box("mvhd", [
    0, 0, 0, 0,
    ...be32(0),
    ...be32(0),
    ...be32(timescale),
    ...be32(input.seconds * timescale),
    ...new Array(80).fill(0),
  ]);
  const tkhd = box("tkhd", [
    0, 0, 0, 0,
    ...be32(0),
    ...be32(0),
    ...be32(1),
    ...be32(0),
    ...be32(input.seconds * timescale),
    ...new Array(52).fill(0),
    ...be32(input.width * 65536),
    ...be32(input.height * 65536),
  ]);
  const trak = box("trak", tkhd);
  return new Uint8Array([
    ...box("ftyp", [...ascii("isom"), ...be32(512), ...ascii("isomiso2mp41")]),
    ...box("moov", [...mvhd, ...trak]),
  ]);
}

describe("reading facts off a still", () => {
  it("Given a PNG, Then its dimensions and media type are read off it", () => {
    const facts = readMediaFacts(png(1920, 1080));
    expect(facts).toEqual({
      ok: true,
      facts: { contentType: "image/png", width: 1920, height: 1080 },
    });
  });

  it("Given a vertical PNG, Then the dimensions are not transposed", () => {
    const facts = readMediaFacts(png(1080, 1920));
    expect(facts.ok && facts.facts.width).toBe(1080);
    expect(facts.ok && facts.facts.height).toBe(1920);
  });

  it("Given a JPEG whose frame header follows a metadata segment, Then it is still found", () => {
    const facts = readMediaFacts(jpeg(1600, 900));
    expect(facts).toEqual({
      ok: true,
      facts: { contentType: "image/jpeg", width: 1600, height: 900 },
    });
  });
});

describe("reading facts off a moving picture", () => {
  it("Given an MP4, Then its duration and track dimensions are read off it", () => {
    const facts = readMediaFacts(mp4({ width: 1080, height: 1920, seconds: 62 }));
    expect(facts).toEqual({
      ok: true,
      facts: {
        contentType: "video/mp4",
        width: 1080,
        height: 1920,
        durationSeconds: 62,
      },
    });
  });

  it("Given an MP4 with no movie header, Then it is refused rather than guessed at", () => {
    const headerless = new Uint8Array([
      ...be32(20),
      ...ascii("ftyp"),
      ...ascii("isom"),
      ...be32(512),
      ...ascii("isom"),
    ]);
    const facts = readMediaFacts(headerless);
    expect(facts).toEqual({ ok: false, detail: expect.stringContaining("movie header") });
  });
});

describe("refusing what this build cannot read", () => {
  it("Given a format outside the readable set, Then it is refused naming the set", () => {
    const facts = readMediaFacts(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
    expect(facts.ok).toBe(false);
    expect(!facts.ok && facts.detail).toMatch(/PNG, JPEG, MP4/);
  });

  it("Given a PNG that ends before its header, Then it is refused", () => {
    const truncated = png(8, 8).subarray(0, 16);
    expect(readMediaFacts(truncated).ok).toBe(false);
  });
});
