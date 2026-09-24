import { describe, expect, it } from "vitest";

import { project } from "./project";
import { document, works } from "./testing/fixture";

/**
 * The projection against the real typesetting service (`BO_0293_019`,
 * `BO_0293_001`): the fixture document holding every kind of block, projected
 * and posted to a running service with the picture's bytes, typeset as a
 * generic article and as IEEE. Nothing stands in for the engine: this runs
 * only when `CALLIOPA_TYPESET_TEST_URL` names a running service and
 * `CALLIOPA_TYPESET_TEST_BEARER` its bearer, and is skipped otherwise.
 */
const url = process.env["CALLIOPA_TYPESET_TEST_URL"];
const bearer = process.env["CALLIOPA_TYPESET_TEST_BEARER"] ?? "";

const pixel = (): string => {
  // A two-by-two PNG with its real chunks and checksums.
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes: Uint8Array) => {
    let c = 0xffffffff;
    for (const byte of bytes) c = (crcTable[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (kind: string, data: Uint8Array) => {
    const body = new Uint8Array([...new TextEncoder().encode(kind), ...data]);
    const length = new Uint8Array(4);
    new DataView(length.buffer).setUint32(0, data.length);
    const sum = new Uint8Array(4);
    new DataView(sum.buffer).setUint32(0, crc(body));
    return new Uint8Array([...length, ...body, ...sum]);
  };
  const header = new Uint8Array([0, 0, 0, 2, 0, 0, 0, 2, 8, 2, 0, 0, 0]);
  const raw = new Uint8Array([0, 255, 0, 0, 0, 0, 255, 0, 0, 0, 0, 255, 255, 255, 255]);
  // A stored (uncompressed) zlib stream: header, one final block, the data, adler32.
  let a = 1;
  let b = 0;
  for (const byte of raw) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  const zlib = new Uint8Array([0x78, 0x01, 0x01, raw.length & 0xff, raw.length >> 8, ~raw.length & 0xff, (~raw.length >> 8) & 0xff, ...raw, b >> 8, b & 0xff, a >> 8, a & 0xff]);
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...chunk("IHDR", header), ...chunk("IDAT", zlib), ...chunk("IEND", new Uint8Array())]);
  return Buffer.from(png).toString("base64");
};

describe.skipIf(url === undefined)("the projection, typeset by the real service", () => {
  for (const venue of ["generic", "ieee"]) {
    it(`typesets the fixture as ${venue}, with its figures, table, equation and references`, async () => {
      const projected = project(document, works, 2186);
      const files = Object.fromEntries(projected.files.map((file) => [file.name, pixel()]));
      const answered = await fetch(`${url}/v1/manuscripts`, {
        method: "POST",
        headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
        body: JSON.stringify({ venue, ast: projected.ast, references: projected.references, files }),
      });
      expect(answered.status).toBe(200);
      const body = (await answered.json()) as { outcome: string; tex: string; bib: string; pdf?: string; log: string[] };
      expect(body.outcome, body.log.join("\n")).toBe("ok");
      expect(Buffer.from(body.pdf ?? "", "base64").subarray(0, 4).toString()).toBe("%PDF");
      expect(body.tex).toContain("\\label{fig:out}");
      // The first citation carries its locator; bibtex resolves the key.
      expect(body.tex).toMatch(/\\citep\[[^\]]*p\.[^\]]*3\]\{w1\}/u);
      expect(body.bib).toContain("w1");
      expect(body.tex).toContain("Supplementary Material");
      if (process.env["CALLIOPA_TYPESET_TEST_KEEP"] !== undefined) {
        const { writeFileSync } = await import("node:fs");
        writeFileSync(`${process.env["CALLIOPA_TYPESET_TEST_KEEP"]}/fixture-${venue}.pdf`, Buffer.from(body.pdf ?? "", "base64"));
      }
    });
  }
});
