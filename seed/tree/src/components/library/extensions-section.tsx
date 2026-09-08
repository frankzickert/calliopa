import { $, component$, useContext, useStore } from "@builder.io/qwik";
import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { SectionProps } from "~/contract";
import type { ExtensionListing } from "~/server/extensions";

/**
 * The Extensions section's body, contributed by `ui.shell` as a component
 * because its shape is not the uniform row: two groups — *Core* (`bundled`)
 * and *Yours* (`individual`) — each row the extension id and version, with a
 * dot when newer truth than the served pin waits for promotion, and the
 * reason when the graph could not be read. The reader's answer arrives as
 * the section's data; the re-read control asks the host's library route for
 * it again. BO_0201_005 BO_0202_003
 */
export const ExtensionsSection = component$<SectionProps>(({ data, activeItemId }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<{ listing: ExtensionListing; reads: number }>({
    listing:
      (data as ExtensionListing | null) ?? { reachable: false, detail: "not read", extensions: [] },
    reads: 0,
  });
  const refresh$ = $(async () => {
    const response = await fetch("/api/library/ui.shell/extensions");
    if (!response.ok) return;
    state.listing = (await response.json()) as ExtensionListing;
    state.reads += 1;
  });
  // The item identity is the network's node id, so a topic or a change
  // opened from inside the document is found by the same rule and revealed
  // rather than duplicated. BO_0201_007
  const open$ = $((id: string) =>
    bridge.openTarget$({ kind: "ui.shell:extension", itemId: `ext:${id}`, title: id }),
  );
  const listing = state.listing;
  return (
    <>
      <button
        type="button"
        class="library-action library-action--body"
        aria-label="Re-read extensions"
        data-refresh-extensions
        onClick$={refresh$}
      >
        ↻
      </button>
      {!listing.reachable ? (
        <p class="library-empty" data-library-empty="extensions">
          Graph not reachable
        </p>
      ) : listing.extensions.length === 0 ? (
        <p class="library-empty" data-library-empty="extensions">
          The graph holds no extensions
        </p>
      ) : (
        (["bundled", "individual"] as const).map((category) => {
          const group = listing.extensions.filter((extension) => extension.category === category);
          if (group.length === 0) return null;
          return (
            <div key={category} data-library-group={category}>
              <h3 class="library-group">{category === "bundled" ? "Core" : "Yours"}</h3>
              <ul class="library-list" key={state.reads}>
                {group.map((extension) => {
                  const id = extension.id;
                  const current = activeItemId === `ext:${id}`;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        class="library-entry"
                        data-extension-id={id}
                        data-ahead={extension.ahead ? "true" : undefined}
                        data-current={current ? "true" : undefined}
                        aria-current={current ? "true" : undefined}
                        onClick$={() => open$(id)}
                      >
                        <span class="library-entry__label">{id}</span>
                        <span class="library-entry__version">{extension.version}</span>
                        {extension.ahead && (
                          <span
                            class="library-entry__ahead"
                            title={`Newer truth at ${extension.newestRevision} waits for promotion`}
                            aria-label="newer truth waits for promotion"
                          />
                        )}
                        {current && <span class="library-entry__marker" aria-hidden="true" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })
      )}
    </>
  );
});
