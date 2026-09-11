import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import {
  nextThemeChoice,
  parseThemeChoice,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemeChoice,
} from "~/lib/theme";
import { Icon, type IconName } from "./icons";

/** The icon that shows each choice, where the word used to. CA_0041_001 */
export const THEME_ICONS: Readonly<Record<ThemeChoice, IconName>> = {
  light: "sun",
  dark: "moon",
  system: "circle-half",
};

export const ThemeToggle = component$(() => {
  const choice = useSignal<ThemeChoice>("system");

  // The pre-paint script exposes the persisted browser-only choice.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    choice.value = parseThemeChoice(
      document.documentElement.getAttribute("data-theme-choice"),
    );
  });

  return (
    <button
      type="button"
      class="theme-toggle"
      data-theme-choice={choice.value}
      aria-label={`Theme: ${choice.value}. Switch theme`}
      onClick$={() => {
        const next = nextThemeChoice(choice.value);
        choice.value = next;
        try {
          localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          // The current page still changes when browser storage is unavailable.
        }
        const html = document.documentElement;
        html.setAttribute(
          "data-theme",
          resolveTheme(
            next,
            window.matchMedia("(prefers-color-scheme: dark)").matches,
          ),
        );
        html.setAttribute("data-theme-choice", next);
      }}
    >
      <Icon name={THEME_ICONS[choice.value]} />
    </button>
  );
});
