import { deflateSync } from "node:zlib";

/**
 * Real files for the behaviour suite, built to each format's own
 * specification rather than stubbed: a valid PNG, and an ISO base media box
 * tree with a movie header and a sized video track. The same builders prove
 * the facts reader in `server/media-facts.test.ts`.
 */

const be32 = (value: number): number[] => [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

function crc32(bytes: readonly number[]): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const chunk = (type: string, data: readonly number[]): number[] => {
  const body = [...ascii(type), ...data];
  return [...be32(data.length), ...body, ...be32(crc32(body))];
};

/** A complete, valid PNG of the given size, its pixels a flat colour so two sizes are two files. */
export function png(width: number, height: number, tone = 0): Uint8Array {
  const raw: number[] = [];
  for (let row = 0; row < height; row += 1) {
    raw.push(0);
    for (let column = 0; column < width; column += 1) raw.push(tone, tone, tone);
  }
  const pixels = [...deflateSync(Buffer.from(raw))];
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk("IHDR", [...be32(width), ...be32(height), 8, 2, 0, 0, 0]),
    ...chunk("IDAT", pixels),
    ...chunk("IEND", []),
  ]);
}

const box = (type: string, payload: readonly number[]): number[] => [...be32(payload.length + 8), ...ascii(type), ...payload];

/** ftyp plus a moov holding an mvhd and a video trak's tkhd. */
export function mp4(input: { readonly width: number; readonly height: number; readonly seconds: number }): Uint8Array {
  const timescale = 600;
  const mvhd = box("mvhd", [0, 0, 0, 0, ...be32(0), ...be32(0), ...be32(timescale), ...be32(input.seconds * timescale), ...new Array(80).fill(0)]);
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
  return new Uint8Array([...box("ftyp", [...ascii("isom"), ...be32(512), ...ascii("isomiso2mp41")]), ...box("moov", [...mvhd, ...box("trak", tkhd)])]);
}
