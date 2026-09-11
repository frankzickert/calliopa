/** Semantic colors are the only color contract consumed by components. */
export const THEME_TOKENS = [
  "canvas",
  "panel",
  "panel-raised",
  "border",
  "text",
  "text-muted",
  "accent",
  "selection",
  "success",
  "warning",
  "error",
  "running",
  "timeline-track",
  "waveform",
  "playhead",
  // A proposed change's ground and edge, one pair per proposer, so a reader
  // sees who proposed it before reading a word. The face on the block's left
  // border and its accessible name say the same: colour is never the only
  // signal. Body text keeps AA on every ground, which `theme.test.ts`
  // computes. BO_0233_002
  "proposal-codex",
  "proposal-codex-edge",
  "proposal-claude",
  "proposal-claude-edge",
  "proposal-hermes",
  "proposal-hermes-edge",
  "proposal-person",
  "proposal-person-edge",
] as const;

type ThemeToken = (typeof THEME_TOKENS)[number];
export type Theme = Readonly<Record<ThemeToken, string>>;
export type ResolvedTheme = "light" | "dark";
const THEME_CHOICES = ["light", "dark", "system"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];
export const THEME_STORAGE_KEY = "calliopa.theme";

const dark: Theme = {
  canvas: "#141619",
  panel: "#1c1f24",
  "panel-raised": "#24282e",
  border: "#30353d",
  text: "#e6e8eb",
  "text-muted": "#9aa3ad",
  accent: "#35b8e6",
  selection: "#35b8e638",
  success: "#4fc98a",
  warning: "#f2b84b",
  error: "#f2665c",
  running: "#5aa2ff",
  "timeline-track": "#1a2a33",
  waveform: "#3fa9c9",
  playhead: "#ff6b5e",
  "proposal-codex": "#17302a",
  "proposal-codex-edge": "#3fae8c",
  "proposal-claude": "#35251c",
  "proposal-claude-edge": "#d9895b",
  "proposal-hermes": "#2b2339",
  "proposal-hermes-edge": "#a585dc",
  "proposal-person": "#262b33",
  "proposal-person-edge": "#8a95a2",
};

const light: Theme = {
  canvas: "#eceef0",
  panel: "#f5f6f7",
  "panel-raised": "#ffffff",
  border: "#cfd5db",
  text: "#1b1f24",
  "text-muted": "#4d5863",
  accent: "#0b86b5",
  selection: "#0b86b51a",
  success: "#1f8f56",
  warning: "#a86a08",
  error: "#b5322a",
  running: "#1f5fbf",
  "timeline-track": "#dde4ea",
  waveform: "#1f86a8",
  playhead: "#d64545",
  "proposal-codex": "#e2f3ed",
  "proposal-codex-edge": "#2a8466",
  "proposal-claude": "#fbebe1",
  "proposal-claude-edge": "#b35c33",
  "proposal-hermes": "#efe8fa",
  "proposal-hermes-edge": "#7652bd",
  "proposal-person": "#eceff3",
  "proposal-person-edge": "#66717e",
};

export const themes: Readonly<Record<ResolvedTheme, Theme>> = { dark, light };

export function themeCss(): string {
  return (["dark", "light"] as const)
    .map((name) => {
      const declarations = THEME_TOKENS.map(
        (token) => `--${token}:${themes[name][token]}`,
      ).join(";");
      const selector =
        name === "dark"
          ? `:root,:root[data-theme="${name}"]`
          : `:root[data-theme="${name}"]`;
      return `${selector}{${declarations}}`;
    })
    .join("");
}

export function nextThemeChoice(choice: ThemeChoice): ThemeChoice {
  const index = THEME_CHOICES.indexOf(choice);
  return THEME_CHOICES[(index + 1) % THEME_CHOICES.length] ?? "system";
}

export function parseThemeChoice(value: unknown): ThemeChoice {
  return THEME_CHOICES.find((choice) => choice === value) ?? "system";
}

export function resolveTheme(
  choice: ThemeChoice,
  prefersDark: boolean,
): ResolvedTheme {
  return choice === "system" ? (prefersDark ? "dark" : "light") : choice;
}

/** Runs in the head before body paint and mirrors the typed helpers above. */
export const THEME_SCRIPT = `(function(){var c=null;try{c=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}if(c!=="light"&&c!=="dark"){c="system"}var d=c==="system"?window.matchMedia("(prefers-color-scheme: dark)").matches:c==="dark";var h=document.documentElement;h.dataset.theme=d?"dark":"light";h.dataset.themeChoice=c;})();`;
