import {
  $,
  component$,
  createContextId,
  Slot,
  useContext,
  useContextProvider,
  useStore,
  useTask$,
  useVisibleTask$,
} from "@builder.io/qwik";

import {
  ViewBridgeContext,
  type ViewBarGroup,
} from "~/components/shell/view-bridge";
import type { DocumentDecorationProps } from "~/contract";
import { EditorSurfaceContext } from "~/extensions/documents/views/editor-surface";

import {
  NO_ROLE,
  offeredBy,
  offeredRoles,
  roleState,
  type DocumentRolesView,
  type DocumentRoleView,
  type RolesListing,
} from "../lib/roles";

/**
 * The roles a document's editor draws from (`BO_0299_014`): read once per
 * document — the catalogue and the document's roles — shared with the label
 * on every block through this context, and read again whenever the editor
 * reads the document again. The provider writes the *Roles* group into the
 * shell's decoration bar: *Document role*, and, while a block is active and
 * the document carries a role, *Block role* beside it — the decoration bar
 * and the choice action being the slot, as the profile selector found
 * (`BO_0298_030`). A choice posts and the control shows the answer; a
 * refusal is raised in the route's words and the choice stands.
 */

export interface RolesState {
  loaded: boolean;
  reachable: boolean;
  catalogue: readonly DocumentRoleView[];
  view: DocumentRolesView | null;
  busy: boolean;
}

export const RolesContext = createContextId<RolesState>(
  "doc-block-roles.roles",
);

/** The choice's value for a block role the document's role does not offer
 * any more, or a retired one: shown, and not offered again. */
export const STANDING_ROLE = "standing";

type Answer = {
  outcome: string;
  result?: DocumentRolesView;
  detail?: string;
  failures?: readonly { detail: string }[];
};

const detailOf = (answer: Answer, status: number): string =>
  answer.failures?.map((failure) => failure.detail).join(" ") ??
  answer.detail ??
  `The server answered ${status}.`;

export const RolesProvider = component$<DocumentDecorationProps>(
  ({ documentId }) => {
    const bridge = useContext(ViewBridgeContext);
    const surface = useContext(EditorSurfaceContext);
    const state = useStore<RolesState>({
      loaded: false,
      reachable: false,
      catalogue: [],
      view: null,
      busy: false,
    });
    useContextProvider(RolesContext, state);

    const read$ = $(async (id: string) => {
      const [listing, roles] = await Promise.all([
        fetch("/api/library/doc-block-roles/roles").catch(() => null),
        fetch(
          `/api/x/doc-block-roles/documents/${encodeURIComponent(id)}`,
        ).catch(() => null),
      ]);
      if (listing !== null && listing.ok) {
        const body = (await listing
          .json()
          .catch(() => null)) as RolesListing | null;
        state.reachable = body?.reachable === true;
        state.catalogue = [...(body?.roles ?? [])];
      }
      if (roles !== null && roles.ok) {
        const answer = (await roles
          .json()
          .catch(() => ({ outcome: "refused" }))) as Answer;
        if (answer.outcome === "success" && answer.result !== undefined)
          state.view = answer.result;
      }
      state.loaded = true;
    });

    // eslint-disable-next-line qwik/no-use-visible-task -- the roles are read in the browser with the person's session
    useVisibleTask$(async ({ track }) => {
      const id = track(() => documentId);
      track(() => surface.loaded);
      await read$(id);
    });

    const post$ = $(
      async (path: string, body: Record<string, unknown>, headline: string) => {
        if (state.busy) return;
        state.busy = true;
        try {
          const response = await fetch(path, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          const answer = (await response
            .json()
            .catch(() => ({ outcome: "refused" }))) as Answer;
          if (
            response.ok &&
            answer.outcome === "success" &&
            answer.result !== undefined
          ) {
            state.view = answer.result;
            return;
          }
          await bridge.raiseMessage$({
            headline,
            body: detailOf(answer, response.status),
            answers: [{ id: "ok", label: "OK" }],
          });
        } finally {
          state.busy = false;
        }
      },
    );

    const chooseDocumentRole$ = $(async (value: string) => {
      if (value === STANDING_ROLE) return;
      await post$(
        `/api/x/doc-block-roles/documents/${encodeURIComponent(documentId)}/role`,
        { documentRole: value === NO_ROLE ? null : value },
        "The document's role was not set",
      );
    });

    const chooseBlockRole$ = $(async (value: string) => {
      const blockId = surface.activeBlockId;
      if (value === STANDING_ROLE || blockId === null) return;
      await post$(
        `/api/x/doc-block-roles/documents/${encodeURIComponent(documentId)}/blocks/${encodeURIComponent(blockId)}/role`,
        { blockRole: value === NO_ROLE ? null : value },
        "The block's role was not set",
      );
    });

    useTask$(({ track }) => {
      const loaded = track(() => state.loaded);
      const reachable = track(() => state.reachable);
      const catalogue = track(() => state.catalogue);
      const view = track(() => state.view);
      const activeBlockId = track(() => surface.activeBlockId);
      const others = bridge.decorationBar.groups.filter(
        (group) => group.id !== "roles",
      );
      // No choices while the roles cannot be read: a dropdown offering nothing
      // but No role would say the instance has none.
      if (!loaded || !reachable || view === null) {
        bridge.decorationBar.groups = others;
        return;
      }
      const chosen = view.documentRole;
      const chosenRole =
        chosen === null
          ? null
          : (catalogue.find((role) => role.id === chosen.id) ?? null);
      const standing =
        chosen !== null && (chosen.retired || chosenRole === null);
      const documentChoice: ViewBarGroup["actions"][number] = {
        kind: "choice",
        id: "document-role",
        label: "Document role",
        value: standing ? STANDING_ROLE : (chosen?.id ?? NO_ROLE),
        options: [
          { value: NO_ROLE, label: "No role" },
          ...(standing && chosen !== null
            ? [{ value: STANDING_ROLE, label: `${chosen.name} (retired)` }]
            : []),
          ...offeredRoles(catalogue).map((role) => ({
            value: role.id,
            label: role.name,
          })),
        ],
        run$: chooseDocumentRole$,
      };
      const actions: ViewBarGroup["actions"][number][] = [documentChoice];
      const block =
        activeBlockId === null
          ? undefined
          : view.blocks.find(
              (candidate) => candidate.blockId === activeBlockId,
            );
      if (block !== undefined && chosenRole !== null && !chosenRole.retired) {
        const current = block.blockRole;
        const currentState = current === null ? null : roleState(current);
        actions.push({
          kind: "choice",
          id: "block-role",
          label: "Block role",
          value:
            current === null
              ? NO_ROLE
              : currentState === null
                ? current.id
                : STANDING_ROLE,
          options: [
            { value: NO_ROLE, label: "No role" },
            ...(current !== null && currentState !== null
              ? [
                  {
                    value: STANDING_ROLE,
                    label: `${current.name} (${currentState})`,
                  },
                ]
              : []),
            ...offeredBy(chosenRole).map((role) => ({
              value: role.id,
              label: role.name,
            })),
          ],
          run$: chooseBlockRole$,
        });
      }
      bridge.decorationBar.groups = [
        ...others,
        { id: "roles", label: "Roles", actions },
      ];
    });

    return <Slot />;
  },
);
