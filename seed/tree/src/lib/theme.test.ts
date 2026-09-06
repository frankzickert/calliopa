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
