import { component$ } from "@builder.io/qwik";
import { APP_NAME } from "~/lib/site";

/** The laurel is the wordmark's C; the remaining letters stay live and scalable. */
export const Wordmark = component$(() => (
  <span class="wordmark" role="img" aria-label={APP_NAME}>
    <img
      class="wordmark__laurel"
      src="/laurel.png"
      alt=""
      width={135}
      height={177}
      decoding="async"
    />
    <span class="wordmark__letters" aria-hidden="true">
      {APP_NAME.slice(1)}
    </span>
  </span>
));
