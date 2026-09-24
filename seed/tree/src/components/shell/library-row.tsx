import { component$, type QRL } from "@builder.io/qwik";

import type { LibraryItem, OpenTarget } from "~/contract";
import { AGENT_FACES } from "~/lib/agent-menu";
import { Icon, type IconName } from "./icons";

/**
 * One row of a library section the shell renders uniformly: the label, the
 * glyph for a document's derived state (`BO_0248_012`), the badge, and — for
 * an item nobody has taken yet, a document a run started — the proposer's
 * face where a glyph stands, with *proposed by* in the row's name
 * (`BO_0251_012`). A row with no target is named and not opened.
 *
 * A row the listing marks unnamed draws its label muted (`DO_0012_007`). Its
 * accessible name stays the label, because the label already says the item is
 * untitled: the muting repeats what the words say rather than carrying the
 * fact in colour alone.
 *
 * Its own component so the render harness presses the row the shell draws
 * (`testing/library-row-host.tsx`). The item is passed whole, never as
 * `item.field`, so a re-read listing reaches the row (`qwik-member-props-freeze`).
 */
export const LibraryRow = component$<{
  item: LibraryItem;
  current: boolean;
  onOpen$: QRL<(target: OpenTarget) => void>;
}>(({ item, current, onOpen$ }) => {
  const open = item.open;
  const parts = (
    <>
      {item.proposedBy !== undefined && <ProposerFace agent={item.proposedBy.agent} />}
      <span class="library-entry__label" data-unnamed={item.unnamed === true ? "true" : "false"}>
        {item.label}
      </span>
      {item.proposedBy !== undefined && (
        <span class="visually-hidden">, proposed by {item.proposedBy.name}</span>
      )}
      {item.glyph !== undefined && (
        <span class="library-entry__glyph" data-glyph={item.glyph.icon} title={item.glyph.label}>
          <Icon name={item.glyph.icon as IconName} size={12} />
          <span class="visually-hidden">{item.glyph.label}</span>
        </span>
      )}
      {item.badge !== undefined && <span class="library-entry__badge">{item.badge}</span>}
    </>
  );
  if (open === undefined) {
    // Named and not opened: no view presents it on its own, and a control
    // that opened nothing would say there is somewhere to go.
    return (
      <span
        class="library-entry library-entry--inert"
        data-item-id={item.id}
        data-proposed={item.proposedBy === undefined ? undefined : ""}
      >
        {parts}
      </span>
    );
  }
  return (
    <button
      type="button"
      class="library-entry"
      data-item-id={item.id}
      data-item-kind={open.kind}
      data-badge={item.badge}
      data-proposed={item.proposedBy === undefined ? undefined : ""}
      data-current={current ? "true" : undefined}
      aria-current={current ? "true" : undefined}
      onClick$={() => onOpen$(open)}
    >
      {parts}
      {/* The marker is the sighted reader's non-colour signal. `aria-current`
          above already says the same thing, so naming the marker too would
          append it to the entry's name. */}
      {current && <span class="library-entry__marker" aria-hidden="true" />}
    </button>
  );
});

/** An agent's character face, or a neutral figure for a person or an agent
 * without one; the row's name says who, so the face is decoration. */
const ProposerFace = component$<{ agent: string | null }>(({ agent }) =>
  agent !== null && Object.hasOwn(AGENT_FACES, agent) ? (
    <img
      class="library-entry__face"
      data-proposer-face={agent}
      src={AGENT_FACES[agent as keyof typeof AGENT_FACES]}
      alt=""
      width={16}
      height={16}
    />
  ) : (
    <span class="library-entry__face" data-proposer-face={agent === null ? "person" : "agent"} aria-hidden="true">
      <Icon name={agent === null ? "user" : "robot"} size={12} />
    </span>
  ),
);
