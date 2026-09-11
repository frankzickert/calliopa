import { component$, useContext } from "@builder.io/qwik";

import { StandingContext } from "./use-standing";

/**
 * What the last change of standing did, said to assistive technology. Its own
 * component, out of the flow, so an announcement moves no content and
 * re-renders nothing but itself. BO_0227_012
 */
export const StandingAnnouncement = component$(() => {
  const { store } = useContext(StandingContext);
  return (
    <p class="visually-hidden" role="status" data-standing-said>
      {store.announcement}
    </p>
  );
});
