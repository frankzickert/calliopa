import { $, component$, useSignal, useStore, useVisibleTask$ } from "@builder.io/qwik";
import { moreBeyond } from "~/lib/scroll-edges";
import { Icon } from "./icons";
import type { RunChip, ViewAnswerAll, ViewToggleRun } from "./view-bridge";

/** Whether the reader asked for stillness, asked at the moment something
 * would move; false where no page can say. CA_0062_004 */
const stillness = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The open run groups on the active tab's target, one chip each on a line
 * directly below the view bar, newest first: whose run by its face, one line
 * of what it is doing or did, and — once the run has ended — *Reject all* and
 * *Accept all*. The chip itself shows or hides its change's proposals and
 * reads as pressed while they are shown. The chips are the view's to report
 * and the shell's to draw; a press is the view's to answer, through
 * `answerAll` and `toggleRun` (`reveal`'s way). BO_0265_008 CA_0055_001
 * CA_0055_002
 *
 * The reader's own proposal sessions stand on the same line, one chip each
 * (`session`): their answers stand at once, the chip's press shows or hides
 * the proposal as a run's does, a pencil beside it works in the proposal,
 * and under separation of duties *Someone else accepts it.* stands in place
 * of *Accept all*. A shown chip takes its proposer's ground, and the one the
 * tab works in the accent. CA_0057_003 CA_0057_014 CA_0057_015
 *
 * The line pushes the content down: it publishes its height on the region as
 * `--view-chips-height`, which a view adds to what it keeps clear of the bar,
 * and takes it back to nothing when it goes.
 *
 * It is one row whatever it carries, scrolling sideways with nothing held at
 * an edge, so what it costs the document is one height however many runs there
 * are. An end with chips beyond it fades, drawn from `data-more-start` and
 * `data-more-end`, which the line reads off itself on a scroll and on a
 * resize; and a chip that becomes the expanded one without a press is scrolled
 * into view. CA_0062_001 CA_0062_002 CA_0062_004
 */
export const RunChips = component$<{
  itemId: string;
  chips: readonly RunChip[];
  answerAll: ViewAnswerAll;
  toggleRun: ViewToggleRun;
}>(({ itemId, chips, answerAll, toggleRun }) => {
  const line = useSignal<HTMLElement>();
  const more = useStore({ start: false, end: false });
  // What the line has shown, and the chip the reader last pressed: a chip that
  // becomes the expanded one without a press is the one scrolled into view.
  // CA_0062_004
  const turned = useStore<{ shown: string[]; pressed: string | null }>({ shown: [], pressed: null });
  const read$ = $(() => {
    const node = line.value;
    if (node == null) return;
    const beyond = moreBeyond(node.scrollLeft, node.scrollWidth, node.clientWidth);
    more.start = beyond.start;
    more.end = beyond.end;
  });
  const answer$ = $((group: string, answer: "accepted" | "rejected") => {
    answerAll.itemId = itemId;
    answerAll.group = group;
    answerAll.answer = answer;
    answerAll.seq += 1;
  });
  const toggle$ = $((key: string, work = false) => {
    // The chip under the reader's hand needs no scrolling to. CA_0062_004
    turned.pressed = key;
    toggleRun.itemId = itemId;
    toggleRun.key = key;
    toggleRun.work = work;
    toggleRun.seq += 1;
  });
  useVisibleTask$(({ cleanup }) => {
    const element = line.value;
    const region = element?.parentElement;
    if (element === undefined || region == null) return;
    // The render harness's DOM cannot parse a custom property; the line is
    // simply not measured there.
    const set = (value: string) => {
      try {
        region.style.setProperty("--view-chips-height", value);
      } catch {
        // Nothing to publish in a DOM without a CSS object model.
      }
    };
    const publish = () => {
      set(`${element.offsetHeight ?? 0}px`);
      // The room the line has is the room the fade is drawn from, so the one
      // pass answers both. CA_0062_002
      void read$();
    };
    publish();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(publish);
    observer?.observe(element);
    cleanup(() => {
      observer?.disconnect();
      set("0px");
    });
  });
  // A chip that becomes the expanded one without the reader pressing it — a
  // run ending, the bar's toggle expanding the newest, a document opening with
  // its proposals shown — is scrolled into view, so the reader can see whose
  // changes are on the page. CA_0062_004
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const shown = track(() =>
      chips
        .filter((chip) => chip.shown)
        .map((chip) => chip.key)
        .join("|"),
    );
    void read$();
    const keys = shown === "" ? [] : shown.split("|");
    const fresh = keys.filter((key) => !turned.shown.includes(key) && key !== turned.pressed);
    turned.shown = keys;
    turned.pressed = null;
    const key = fresh[0];
    if (key === undefined) return;
    const chip = line.value?.querySelector(`[data-run-chip="${key}"]`) as HTMLElement | null | undefined;
    if (chip == null || typeof chip.scrollIntoView !== "function") return;
    // `nearest` both ways: the line moves sideways and the page stays where it
    // is.
    chip.scrollIntoView({ inline: "nearest", block: "nearest", behavior: stillness() ? "auto" : "smooth" });
  });
  return (
    <ul
      ref={line}
      class="run-chips"
      data-run-chips
      // From the second chip on, a chip that is not the expanded one stands
      // minimized: the face, its number and its two signs. The words and the
      // labels go by CSS, so a chip is drawn one way whatever the line holds.
      // CA_0061_001
      data-run-chips-several={chips.length > 1 ? "true" : undefined}
      // An end with chips beyond it fades: the line reads its own scroll,
      // since no stylesheet can see one. CA_0062_002
      data-more-start={more.start ? "" : undefined}
      data-more-end={more.end ? "" : undefined}
      onScroll$={read$}
      aria-label="Agent runs on this document"
    >
      {chips.map((chip) => (
        <li
          key={chip.key}
          class="run-chip"
          data-run-chip={chip.key}
          data-run-chip-tone={chip.tone}
          data-run-chip-ended={chip.ended ? "true" : undefined}
          data-run-chip-shown={chip.shown ? "true" : undefined}
          data-run-chip-session={chip.session === true ? "true" : undefined}
          data-run-chip-working={chip.working === true ? "true" : undefined}
        >
          <button
            type="button"
            class="run-chip__toggle"
            data-run-chip-toggle={chip.key}
            aria-pressed={chip.shown}
            aria-label={
              chip.session === true
                ? `${chip.shown ? "Hide" : "Show"} ${chip.text}`
                : `${chip.shown ? "Hide" : "Show"} ${chip.name}'s proposals: ${chip.text}`
            }
            // A run that has staged nothing has nothing to show or hide, and
            // the session the tab works in is the document it reads.
            disabled={chip.group === null || chip.working === true}
            onClick$={() => toggle$(chip.key)}
          >
            <span class="run-chip__face" aria-hidden="true">
              {chip.face.kind === "image" ? (
                <img class="run-chip__portrait" src={chip.face.src} alt="" width={20} height={20} draggable={false} />
              ) : (
                <Icon name={chip.face.icon} size={12} />
              )}
            </span>
            <span class="run-chip__text" data-run-chip-text>
              {chip.text}
            </span>
            {chip.count !== undefined && (
              // The number the words count, drawn in their place while the
              // chip is minimized. The toggle's name still says them.
              // CA_0061_001 CA_0061_002
              <span class="run-chip__count" data-run-chip-count={chip.key} aria-hidden="true">
                {chip.count}
              </span>
            )}
          </button>
          {chip.session === true && (
            <button
              type="button"
              class="run-chip__work"
              data-run-chip-work={chip.key}
              aria-pressed={chip.working === true}
              aria-label={`${chip.working === true ? "Stop working in" : "Work in"} ${chip.text}`}
              title={chip.working === true ? "Stop working in this proposal" : "Work in this proposal"}
              onClick$={() => toggle$(chip.key, true)}
            >
              <Icon name="pencil-simple" size={14} />
            </button>
          )}
          {chip.ended && chip.group !== null && (
            <span class="run-chip__answers">
              <button
                type="button"
                class="run-chip__answer"
                data-run-reject-all={chip.group}
                aria-label={chip.session === true ? `Reject all of ${chip.text}` : `Reject all of ${chip.name}'s proposals`}
                onClick$={() => answer$(chip.group as string, "rejected")}
              >
                <Icon name="x" size={14} />
                <span>Reject all</span>
              </button>
              {chip.accepts === "others" ? (
                <>
                  <span class="run-chip__note" data-run-accepts-others={chip.group}>
                    Someone else accepts it.
                  </span>
                  {/* Minimized there is no room for the words, so the sign
                      stands in the accept's place and the words are left to
                      the eye's absence, not the reader's. CA_0061_001 */}
                  <span
                    class="run-chip__note-sign"
                    data-run-accepts-sign={chip.group}
                    title="Someone else accepts it."
                    aria-hidden="true"
                  >
                    <Icon name="warning" size={14} />
                  </span>
                </>
              ) : (
                <button
                  type="button"
                  class="run-chip__answer"
                  data-run-accept-all={chip.group}
                  aria-label={chip.session === true ? `Accept all of ${chip.text}` : `Accept all of ${chip.name}'s proposals`}
                  onClick$={() => answer$(chip.group as string, "accepted")}
                >
                  <Icon name="checks" size={14} />
                  <span>Accept all</span>
                </button>
              )}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
});
