import { describe, expect, it } from "vitest";
import {
  nextThemeChoice,
  parseThemeChoice,
  resolveTheme,
  THEME_SCRIPT,
  THEME_STORAGE_KEY,
  THEME_TOKENS,
  themeCss,
  themes,
} from "./theme";

describe("theme configuration", () => {
  it("Given both themes, Then every semantic token has a value", () => {
    for (const token of THEME_TOKENS) {
      expect(themes.dark[token]).toMatch(/^#/);
      expect(themes.light[token]).toMatch(/^#/);
    }
  });

  it("Given generated CSS, Then both themes declare every token", () => {
    const css = themeCss();
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain(':root[data-theme="light"]');
    for (const token of THEME_TOKENS) {
      expect(css.split(`--${token}:`)).toHaveLength(3);
    }
  });
});

describe("theme choice", () => {
  it("Given the toggle order, Then light, dark and system repeat", () => {
    expect(nextThemeChoice("light")).toBe("dark");
    expect(nextThemeChoice("dark")).toBe("system");
    expect(nextThemeChoice("system")).toBe("light");
  });

  it("Given persisted input, Then only known choices survive", () => {
    expect(parseThemeChoice("dark")).toBe("dark");
    expect(parseThemeChoice("sepia")).toBe("system");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("Given the pre-paint script, Then it uses the shared key and theme attributes", () => {
    expect(THEME_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_SCRIPT).toContain("dataset.theme=");
    expect(THEME_SCRIPT).toContain("prefers-color-scheme: dark");
  });
});

/**
 * A proposal's ground carries body text, and its edge carries the face's and
 * the icons' rings, so each is held to WCAG's contrast: 4.5:1 for the text on
 * the ground, 3:1 for the edge against the ground it bounds. Computed, so a
 * value changed later is refused rather than eyeballed. BO_0233_002
 */
describe("the proposal colours", () => {
  const luminance = (hex: string): number => {
    const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
    const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string): number => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (high + 0.05) / (low + 0.05);
  };

  for (const name of ["dark", "light"] as const) {
    for (const proposer of ["codex", "claude", "hermes", "person"] as const) {
      it(`Given the ${name} theme, Then ${proposer}'s ground carries body text and its edge stands out`, () => {
        const theme = themes[name];
        const ground = theme[`proposal-${proposer}`];
        const edge = theme[`proposal-${proposer}-edge`];
        expect(contrast(theme.text, ground)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(edge, ground)).toBeGreaterThanOrEqual(3);
      });
    }
  }
});

/**
 * Code is drawn in six colours over whichever ground the block sits on, so
 * each is held to 4.5:1 against the canvas, the panel and the raised panel in
 * both themes — computed, as the proposal colours are. BO_0296_019
 */
describe("the code colours", () => {
  const luminance = (hex: string): number => {
    const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
    const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string): number => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (high + 0.05) / (low + 0.05);
  };

  for (const name of ["dark", "light"] as const) {
    for (const token of ["code-keyword", "code-string", "code-comment", "code-number", "code-name", "code-type"] as const) {
      it(`Given the ${name} theme, Then ${token} reads on every ground`, () => {
        const theme = themes[name];
        for (const ground of ["canvas", "panel", "panel-raised"] as const) {
          expect(contrast(theme[token], theme[ground]), `${token} on ${ground}`).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  }
});
