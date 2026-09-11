import { component$, Slot, useId, useSignal } from "@builder.io/qwik";

import type { Person } from "~/server/session";
import { Icon, type IconName } from "./icons";

/**
 * An icon button on the header's line that shows what it holds under it:
 * the signed-in person's menu and the licence warning. The line holds one
 * row as tall as the wordmark, so what used to be words beside the controls
 * is one press away, not gone. CA_0041_003 CA_0041_004
 *
 * A disclosure rather than an ARIA menu: the panel says who is signed in and
 * what the licence says, and a `role="menu"` may hold nothing but its items.
 * Focus stays on the button; Tab reaches the panel, which follows it. A press
 * outside, Escape anywhere in it, or the button pressed again closes it, and
 * Escape brings focus back to the button. Its own component so the render
 * harness can press it (`BO_0224_009`).
 */
export const HeaderDisclosure = component$<{
  kind: "person" | "licence";
  icon: IconName;
  label: string;
}>(({ kind, icon, label }) => {
  const panelId = useId();
  const root = useSignal<HTMLElement>();
  const button = useSignal<HTMLButtonElement>();
  const open = useSignal(false);

  return (
    <div
      class={`header-disclosure header-disclosure--${kind}`}
      ref={root}
      data-open={open.value ? "true" : "false"}
      document:onPointerDown$={(event) => {
        // A press outside closes it, as the agent menu's does (BO_0228_011).
        if (open.value && !root.value?.contains(event.target as Node))
          open.value = false;
      }}
      onKeyDown$={(event) => {
        if (event.key !== "Escape" || !open.value) return;
        open.value = false;
        button.value?.focus();
      }}
    >
      <button
        type="button"
        ref={button}
        class="header-disclosure__button"
        aria-expanded={open.value ? "true" : "false"}
        aria-controls={panelId}
        aria-label={label}
        data-disclosure={kind}
        onClick$={() => (open.value = !open.value)}
      >
        <Icon name={icon} />
      </button>
      <div class="header-disclosure__panel" id={panelId} hidden={!open.value}>
        <Slot />
      </div>
    </div>
  );
});

/**
 * The signed-in person, at the very right of the header's line: a `user`
 * button whatever the person's class, whose name says who is signed in
 * before they act — acting as the wrong person is the mistake multi-party
 * review exists to make visible — and whose panel holds the name, what the
 * class lets them do, and the way out. Sign-out is the kernel's; the reload
 * that follows lands on its sign-in page. BO_0209_003 CA_0041_003
 */
export const PersonMenu = component$<{ person: Person }>(({ person }) => (
  <span
    class="identity"
    data-identity={person.name}
    data-identity-class={person.class}
  >
    <HeaderDisclosure
      kind="person"
      icon="user"
      label={`Signed in as ${person.name}. Account`}
    >
      <p class="identity__name">{person.name}</p>
      <p class="identity__class">
        {person.class === "human" ? "may establish" : "proposes"}
      </p>
      <button
        type="button"
        class="sign-out"
        onClick$={async () => {
          await fetch("/__kernel/session/sign-out", { method: "POST" });
          window.location.assign("/__kernel/session/sign-in");
        }}
      >
        Sign out
      </button>
    </HeaderDisclosure>
  </span>
));

/**
 * The licensor's word, not a toast: it stays until the licence does, as a
 * `warning` button named by the word and opening onto it, so a long warning
 * cannot take the header's line from the tabs. BO_0209_005 CA_0041_004
 */
export const LicenceWarning = component$<{ text: string }>(({ text }) => (
  <span class="licence-warning" role="status" data-licence-warning>
    <HeaderDisclosure kind="licence" icon="warning" label={text}>
      <p class="licence-warning__text">{text}</p>
    </HeaderDisclosure>
  </span>
));
