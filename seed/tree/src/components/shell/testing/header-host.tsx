import { component$, useStore } from "@builder.io/qwik";

import type { Person } from "~/server/session";
import { LicenceWarning, PersonMenu } from "../header-disclosure";
import { SaveStatus } from "../save-status";
import { ThemeToggle } from "../theme-toggle";
import type { SaveState, ViewSave } from "../view-bridge";

/**
 * The header's controls wired in real JSX the way the shell wires them: the
 * theme toggle, the save state as a store a view writes after mount, and the
 * person's menu and licence warning from the shell's props. Test support,
 * imported by `header.test.ts` and nothing that ships. CA_0041
 */
export const HeaderHost = component$<{
  person: Person;
  licence: string;
}>((props) => {
  const save = useStore<ViewSave>({ state: null });
  return (
    <header>
      <ThemeToggle />
      <SaveStatus save={save} />
      {(["saving", "saved", "unsaved"] as const satisfies SaveState[]).map(
        (state) => (
          <button
            key={state}
            type="button"
            data-report={state}
            onClick$={() => (save.state = state)}
          >
            {state}
          </button>
        ),
      )}
      <LicenceWarning text={props.licence} />
      <PersonMenu person={props.person} />
    </header>
  );
});
