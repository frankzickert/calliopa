/**
 * Reading an export's machine facts off the file itself.
 *
 * The facts are read rather than typed, because a number a human retypes is a
 * number that can be wrong about the bytes beside it. A format this build
 * cannot read is refused naming what it can, rather than accepting the
 * caller's word for its dimensions.
 */

export interface MediaFacts {
  readonly contentType: string;
  readonly width: number;
  readonly height: number;
  /** Present for a moving picture, absent for a still. */
  readonly durationSeconds?: number;
}

export type MediaFactsOutcome =
  | { readonly ok: true; readonly facts: MediaFacts }
  | { readonly ok: false; readonly detail: string };

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  signature.every((byte, index) => bytes[index] === byte);

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function readPng(bytes: Uint8Array): MediaFactsOutcome {
  // The IHDR chunk is fixed at offset 8 and carries width then height as
  // big-endian 32-bit integers, so a PNG's size is readable without inflating
  // anything.
  if (bytes.length < 24) return { ok: false, detail: "The PNG ends before its header." };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    ok: true,
    facts: {
      contentType: "image/png",
      width: view.getUint32(16),
      height: view.getUint32(20),
    },
  };
}

/**
 * JPEG carries its size in a start-of-frame marker, which sits after any
 * number of metadata segments, so the segments are walked rather than assumed
 * to be absent. Every SOF marker but the four that are not frames carries the
 * same five-byte payload.
 */
function readJpeg(bytes: Uint8Array): MediaFactsOutcome {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return { ok: false, detail: "The JPEG's segments do not line up." };
    }
    const marker = bytes[offset + 1] as number;
    const length = view.getUint16(offset + 2);

    const isFrame = marker >= 0xc0 && marker <= 0xcf;
    const isNotAFrame = marker === 0xc4 || marker === 0xc8 || marker === 0xcc;
    if (isFrame && !isNotAFrame) {
      return {
        ok: true,
        facts: {
          contentType: "image/jpeg",
          height: view.getUint16(offset + 5),
          width: view.getUint16(offset + 7),
        },
      };
    }
    offset += 2 + length;
  }
  return { ok: false, detail: "The JPEG carries no frame header." };
}

const asciiAt = (bytes: Uint8Array, offset: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));

/**
 * Walks an ISO base media file's boxes to `mvhd` for the duration and to the
 * first video `tkhd` for the dimensions. Both are top-level-then-nested, so
 * the walk is a recursion over the container boxes that hold them.
 */
function readIsoBaseMedia(bytes: Uint8Array): MediaFactsOutcome {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const containers = new Set(["moov", "trak", "mdia"]);
  let duration: number | null = null;
  let width: number | null = null;
  let height: number | null = null;

  const walk = (start: number, end: number): void => {
    let offset = start;
    while (offset + 8 <= end) {
      const size = view.getUint32(offset);
      const type = asciiAt(bytes, offset + 4, 4);
      const box = size === 0 ? end - offset : size;
      if (box < 8 || offset + box > end) return;

      if (containers.has(type)) {
        walk(offset + 8, offset + box);
      } else if (type === "mvhd" && duration === null) {
        // version 0 stores 32-bit timescale and duration, version 1 stores
        // 64-bit creation stamps ahead of them.
        const version = bytes[offset + 8];
        const base = offset + 12 + (version === 1 ? 16 : 8);
        const timescale = view.getUint32(base);
        const ticks =
          version === 1 ? Number(view.getBigUint64(base + 4)) : view.getUint32(base + 4);
        if (timescale > 0) duration = ticks / timescale;
      } else if (type === "tkhd" && width === null) {
        const version = bytes[offset + 8];
        // After version and flags: the stamps, track id, reserved and
        // duration (20 bytes at version 0, 32 at version 1), then reserved,
        // layer, alternate group, volume and the 9-entry matrix, which is 52.
        const base = offset + 12 + (version === 1 ? 32 : 20) + 52;
        // Width and height are 16.16 fixed point at the end of the box.
        const trackWidth = view.getUint32(base) / 65536;
        const trackHeight = view.getUint32(base + 4) / 65536;
        if (trackWidth > 0 && trackHeight > 0) {
          width = Math.round(trackWidth);
          height = Math.round(trackHeight);
        }
      }
      offset += box;
    }
  };

  walk(0, bytes.length);

  if (duration === null || width === null || height === null) {
    return {
      ok: false,
      detail: "The video carries no movie header or no sized video track.",
    };
  }
  return {
    ok: true,
    facts: {
      contentType: "video/mp4",
      width,
      height,
      durationSeconds: duration,
    },
  };
}

/** What this build can read facts from. Widening it is an ordinary change. */
export const READABLE_MEDIA = ["PNG", "JPEG", "MP4"] as const;

/**
 * The facts a file states about itself. A file whose format this build does
 * not read is refused rather than stored with facts nobody checked.
 */
export function readMediaFacts(bytes: Uint8Array): MediaFactsOutcome {
  if (startsWith(bytes, PNG_SIGNATURE)) return readPng(bytes);
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return readJpeg(bytes);
  if (bytes.length > 12 && asciiAt(bytes, 4, 4) === "ftyp") {
    return readIsoBaseMedia(bytes);
  }
  return {
    ok: false,
    detail: `This file is not one this build reads facts from (${READABLE_MEDIA.join(", ")}).`,
  };
}
