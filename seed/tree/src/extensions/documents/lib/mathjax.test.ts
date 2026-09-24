import { describe, expect, it } from "vitest";

import { isTypeset, typeset } from "./mathjax";

/**
 * The one renderer both sites draw through (`BO_0290_013`). Each case here is
 * a rule the surfaces rest on: SVG rather than fonts is what keeps an equation
 * from moving the text around it, and unreadable TeX has to be *detected*
 * rather than drawn, because MathJax reports it inside its own output.
 */
describe("typesetting mathematics", () => {
  it("answers SVG, whose glyphs are paths and need no font", () => {
    const outcome = typeset("E = mc^2", true);
    expect(isTypeset(outcome)).toBe(true);
    if (!isTypeset(outcome)) return;
    expect(outcome.svg).toContain("<svg");
    expect(outcome.svg).toContain("<path");
    // Nothing that would arrive later and resize the equation: no font to
    // load, and no address to fetch. The only URLs in the markup are XML
    // namespace names, which name a vocabulary rather than a resource.
    expect(outcome.svg).not.toContain("@font-face");
    const addresses = outcome.svg.match(/https?:\/\/[^"']+/g) ?? [];
    expect(addresses.every((url) => url.startsWith("http://www.w3.org/"))).toBe(true);
    expect(outcome.svg).not.toContain("<image");
  });

  it("sets a display equation and an inline one differently", () => {
    const display = typeset("\\sum_{i=1}^n i", true);
    const inline = typeset("\\sum_{i=1}^n i", false);
    expect(isTypeset(display) && isTypeset(inline)).toBe(true);
    if (!isTypeset(display) || !isTypeset(inline)) return;
    expect(display.svg).toContain('display="true"');
    expect(display.svg).not.toBe(inline.svg);
  });

  it("detects TeX it cannot read, which MathJax reports inside its output rather than by throwing", () => {
    const outcome = typeset("\\frac{1}{", true);
    expect(isTypeset(outcome)).toBe(false);
    if (isTypeset(outcome)) return;
    expect(outcome.failure).toContain("could not be read");
    // The engine's own error rendering never reaches a reader.
    expect(outcome.failure).not.toContain("merror");
  });

  it("refuses an undefined macro rather than quietly drawing it", () => {
    expect(isTypeset(typeset("\\notarealmacro{x}", false))).toBe(false);
  });

  it("says so plainly when there is no source at all", () => {
    const outcome = typeset("   ", false);
    expect(isTypeset(outcome)).toBe(false);
    if (isTypeset(outcome)) return;
    expect(outcome.failure).toBe("This equation has no source.");
  });

  it("carries the packages an author may actually write in", () => {
    // One from `ams`, one from `physics`, one from `mhchem`: a name that is
    // registered renders, and MathJax omits an unregistered package rather
    // than failing, so this is the guard on the import list.
    for (const source of ["\\begin{align}a &= b\\end{align}", "\\bra{\\psi}", "\\ce{H2O}"]) {
      expect(isTypeset(typeset(source, true))).toBe(true);
    }
  });

  it("does not carry the packages that would reach a CDN or hide a failure", () => {
    // `\require` is how an equation pulls a package at render time. Without
    // that package registered it is an undefined macro, which is a failure
    // rather than a fetch.
    expect(isTypeset(typeset("\\require{color}x", false))).toBe(false);
  });

  it("typesets one source once, however often it is read", () => {
    const source = "\\int_0^1 x\\,dx = \\tfrac12";
    const first = typeset(source, true);
    const second = typeset(source, true);
    expect(isTypeset(first)).toBe(true);
    // The same object, not an equal one: the read path pays for an equation
    // the first time a document holds it and never again.
    expect(second).toBe(first);
  });

  it("remembers a failure too, so bad TeX is not re-parsed on every read", () => {
    const first = typeset("\\frac{1}{", false);
    expect(typeset("\\frac{1}{", false)).toBe(first);
  });
});
