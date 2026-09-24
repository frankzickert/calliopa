import { $, component$, useSignal, type QRL } from "@builder.io/qwik";

/**
 * A citation's locator, edited over the citation (`BO_0291_034`): pressing
 * a citation while its block is edited opens this panel — the inline
 * equation's idiom — with the locator it carries, such as *p. 12*. Closing
 * saves, as the equation popover's does: Done, Enter and Escape all keep
 * what was typed, and an empty field takes the locator away. The citation
 * under it keeps its place and its work. It does not take focus as it opens,
 * as the equation popover does not: the editing surface takes focus back
 * whenever it repaints, and a panel reaching for it too loops with it.
 */
export const LocatorPopover = component$<{
  locator: string;
  save$: QRL<(locator: string) => void>;
  close$: QRL<() => void>;
}>(({ locator, save$, close$ }) => {
  const draft = useSignal(locator);


  const commit$ = $(async () => {
    await save$(draft.value.trim());
    await close$();
  });

  return (
    <div
      class="equation-popover locator-popover"
      data-locator-popover
      role="dialog"
      aria-label="Where in the source"
      onKeyDown$={(event) => {
        if (event.key === "Escape" || event.key === "Enter") {
          event.preventDefault();
          void commit$();
        }
      }}
    >
      <label class="equation-popover__label" for="citation-locator">
        Where in the source, such as p. 12
      </label>
      <input
        id="citation-locator"
        class="locator-popover__field"
        data-locator-field
        type="text"
        autocomplete="off"
        value={locator}
        onInput$={(_, element) => {
          draft.value = element.value;
        }}
      />
      <button type="button" class="equation-popover__done" data-locator-done onClick$={commit$}>
        Done
      </button>
    </div>
  );
});
