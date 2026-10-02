import { $, component$, useStore, useVisibleTask$ } from "@builder.io/qwik";

import { Icon } from "~/components/shell/icons";
import type { BlockDecorationProps } from "~/contract";

import { orderedChoices, PROFILE_OPTION, type ProfileChoice, type ProfileChoices } from "../lib/profiles";
import "./profiles.css";

/**
 * The profile in the command chip (`calliopa-bootstrap`'s `BO_0311_011`): a
 * compass in the chip of the block being edited, opening *No profile* and
 * every profile by title — those carrying a role the block or its document
 * takes first. The choice is the command's: it sets the command's `profile`
 * option, which *Send* carries, and nothing is written on the document
 * (`BO_0308_Q7`). A new command starts with the profile the person last sent
 * with in this document, which the kernel keeps for that person alone; a
 * profile document's own chip starts at *No profile* (`BO_0298_Q9`). Nothing
 * is drawn while the profiles cannot be read or the instance has none.
 */

export const ProfileChip = component$<BlockDecorationProps>(({ documentId, blockId, setOption$ }) => {
  const state = useStore<{ loaded: boolean; choices: ProfileChoices | null; chosen: string | null; open: boolean }>({
    loaded: false,
    choices: null,
    chosen: null,
    open: false,
  });

  const choose$ = $(async (profile: string | null) => {
    state.chosen = profile;
    state.open = false;
    if (setOption$ !== undefined) await setOption$(PROFILE_OPTION, profile);
  });

  // eslint-disable-next-line qwik/no-use-visible-task -- read in the browser with the person's session, once the chip is shown
  useVisibleTask$(async ({ track }) => {
    const document = track(() => documentId);
    const block = track(() => blockId);
    const response = await fetch(`/api/x/profiles/documents/${encodeURIComponent(document)}/blocks/${encodeURIComponent(block)}/choices`).catch(() => null);
    const choices = response !== null && response.ok ? ((await response.json().catch(() => null)) as ProfileChoices | null) : null;
    state.choices = choices;
    state.loaded = true;
    // The command starts with the person's last, while it is still a profile.
    const last = choices?.last ?? null;
    if (last !== null && choices?.profiles.some((profile) => profile.id === last) === true) await choose$(last);
  });

  const choices = state.choices;
  if (!state.loaded || choices === null || !choices.reachable || choices.profiles.length === 0) return null;
  const ordered = orderedChoices(choices.profiles);
  const chosen: ProfileChoice | undefined = ordered.find((profile) => profile.id === state.chosen);
  const name = chosen === undefined ? "No profile" : `Profile: ${chosen.title}`;
  const matching = ordered.filter((profile) => profile.matches);
  const rest = ordered.filter((profile) => !profile.matches);
  const option = (profile: ProfileChoice) => (
    <li key={profile.id}>
      <button
        type="button"
        class="profile-chip__option"
        data-profile-option={profile.id}
        aria-pressed={state.chosen === profile.id ? "true" : "false"}
        preventdefault:mousedown
        onClick$={() => choose$(profile.id)}
      >
        {profile.title.trim() === "" ? "Untitled profile" : profile.title}
      </button>
    </li>
  );
  return (
    <span class="profile-chip" data-profile-chip data-chosen={chosen === undefined ? undefined : chosen.id} stoppropagation:click>
      <button
        type="button"
        class="profile-chip__toggle"
        aria-label={name}
        title={name}
        aria-expanded={state.open ? "true" : "false"}
        data-profile-toggle
        // Keeps the caret where it is: the block stays edited while the
        // chip's control is pressed.
        preventdefault:mousedown
        onClick$={() => {
          state.open = !state.open;
        }}
      >
        <Icon name="compass" />
      </button>
      {state.open && (
        <div class="profile-chip__popover" role="dialog" aria-label="Profile for this command" data-profile-popover stoppropagation:keydown>
          <ul class="profile-chip__options">
            <li>
              <button
                type="button"
                class="profile-chip__option"
                data-profile-option=""
                aria-pressed={chosen === undefined ? "true" : "false"}
                preventdefault:mousedown
                onClick$={() => choose$(null)}
              >
                No profile
              </button>
            </li>
          </ul>
          {matching.length > 0 && (
            <>
              <span class="profile-chip__heading">For this block's roles</span>
              <ul class="profile-chip__options" data-profile-matching>
                {matching.map(option)}
              </ul>
            </>
          )}
          {rest.length > 0 && (
            <>
              {matching.length > 0 && <span class="profile-chip__heading">Other profiles</span>}
              <ul class="profile-chip__options" data-profile-rest>
                {rest.map(option)}
              </ul>
            </>
          )}
        </div>
      )}
    </span>
  );
});
