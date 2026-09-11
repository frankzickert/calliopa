import { component$ } from "@builder.io/qwik";

import { Icon, type IconName } from "./icons";
import { SAVE_WORD } from "./inspector";
import type { SaveState, ViewSave } from "./view-bridge";

/** The icon a phone shows for each save state, where the desktop has the
 * word. CA_0041_006 */
export const SAVE_ICONS: Readonly<Record<SaveState, IconName>> = {
  saving: "cloud-arrow-up",
  saved: "cloud-check",
  unsaved: "cloud-warning",
};

/**
 * The active tab's save state, in the header.
 *
 * Its own component for the reason the inspector contribution is one: a save
 * state changing must not re-render the shell, because re-rendering the shell
 * rebuilds the mounted view, and for an editing surface that means rebuilding
 * the element the caret is in. A view that reports nothing renders nothing.
 *
 * Both the icon and the word are always rendered, and the stylesheet shows one
 * per form factor. The icon is `aria-hidden` and the word is only ever hidden
 * visually, so assistive technology hears the word once either way.
 * CA_0041_006
 */
export const SaveStatus = component$<{ save: ViewSave }>(({ save }) =>
  save.state === null ? null : (
    <p
      class="save-status"
      role="status"
      aria-label="Save state"
      data-save-status={save.state}
    >
      <Icon name={SAVE_ICONS[save.state]} />
      <span class="save-status__word">{SAVE_WORD[save.state]}</span>
    </p>
  ),
);
