import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import {
  nextThemeChoice,
  parseThemeChoice,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemeChoice,
} from "~/lib/theme";

export const ThemeToggle = component$(() => {
  const choice = useSignal<ThemeChoice>("system");

  // The pre-paint script exposes the persisted browser-only choice.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    choice.value = parseThemeChoice(
      document.documentElement.dataset.themeChoice,
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
        html.dataset.theme = resolveTheme(
          next,
          window.matchMedia("(prefers-color-scheme: dark)").matches,
        );
        html.dataset.themeChoice = next;
      }}
    >
      {choice.value}
    </button>
  );
});
