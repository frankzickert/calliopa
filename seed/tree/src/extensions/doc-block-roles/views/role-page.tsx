import {
  $,
  component$,
  useContext,
  useStore,
  useVisibleTask$,
} from "@builder.io/qwik";

import { Icon } from "~/components/shell/icons";
import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { ViewProps } from "~/components/shell/view-host";

import type { DocumentRoleView } from "../lib/roles";
import "./roles.css";

/**
 * A document role's page (`BO_0299_012`): its name and description, and the
 * block roles it offers — each renamed, described, moved up or down, retired
 * and restored in place — and the role itself retired or restored. Every act
 * is one truth write through this extension's commands route, as the
 * signed-in person (`BO_0299_Q2`); the page shows what the route answered.
 * Retired roles stay readable here, because a role is never deleted
 * (`BO_0299_Q4`).
 */

type Answer = {
  outcome: string;
  result?: DocumentRoleView;
  detail?: string;
  failures?: readonly { detail: string }[];
};

const detailOf = (answer: Answer, status: number): string =>
  answer.failures?.map((failure) => failure.detail).join(" ") ??
  answer.detail ??
  `The server answered ${status}.`;

export const RolePage = component$<ViewProps>(({ tab }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<{
    role: DocumentRoleView | null;
    notice: string;
    busy: boolean;
    draft: string;
  }>({ role: null, notice: "", busy: false, draft: "" });

  const read$ = $(async (id: string) => {
    const response = await fetch(
      `/api/x/doc-block-roles/roles/${encodeURIComponent(id)}`,
    ).catch(() => null);
    const answer = ((await response?.json().catch(() => null)) ?? {
      outcome: "refused",
    }) as Answer;
    if (
      response === null ||
      !response.ok ||
      answer.outcome !== "success" ||
      answer.result === undefined
    ) {
      state.role = null;
      state.notice = detailOf(answer, response?.status ?? 0);
      return;
    }
    state.role = answer.result;
    state.notice = "";
  });

  // eslint-disable-next-line qwik/no-use-visible-task -- the role is read in the browser with the person's session
  useVisibleTask$(({ track }) => {
    const id = track(() => tab.itemId);
    if (id !== null && id !== "") void read$(id);
  });

  const act$ = $(async (command: Record<string, unknown>) => {
    const role = state.role;
    if (role === null || state.busy) return;
    state.busy = true;
    try {
      const response = await fetch(
        `/api/x/doc-block-roles/roles/${encodeURIComponent(role.id)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(command),
        },
      );
      const answer = (await response
        .json()
        .catch(() => ({ outcome: "refused" }))) as Answer;
      if (
        !response.ok ||
        answer.outcome !== "success" ||
        answer.result === undefined
      ) {
        state.notice = detailOf(answer, response.status);
        return;
      }
      state.notice = "";
      const renamed = answer.result.name !== role.name;
      const retiredChanged = answer.result.retired !== role.retired;
      state.role = answer.result;
      if (renamed) await bridge.setTitle$(answer.result.name);
      if (renamed || retiredChanged) await bridge.targetChanged$();
    } finally {
      state.busy = false;
    }
  });

  const move$ = $(async (blockRoleId: string, by: -1 | 1) => {
    const role = state.role;
    if (role === null) return;
    const ids = role.blockRoles.map((blockRole) => blockRole.id);
    const at = ids.indexOf(blockRoleId);
    const to = at + by;
    if (at < 0 || to < 0 || to >= ids.length) return;
    ids.splice(at, 1);
    ids.splice(to, 0, blockRoleId);
    await act$({ command: "reorder", blockRoles: ids });
  });

  const add$ = $(async () => {
    const name = state.draft.trim();
    if (name === "") return;
    await act$({ command: "addBlockRole", name });
    state.draft = "";
  });

  const role = state.role;
  if (role === null) {
    return (
      <section class="role-page">
        {state.notice !== "" && <p role="alert">{state.notice}</p>}
      </section>
    );
  }
  return (
    <section
      class="role-page"
      data-role-page={role.id}
      data-retired={role.retired ? "true" : undefined}
    >
      <header class="role-page__head">
        <label class="role-page__field">
          <span class="role-page__label">Document role</span>
          <input
            type="text"
            class="role-page__name"
            value={role.name}
            aria-label="Name of the document role"
            data-role-name
            disabled={state.busy}
            onChange$={(_, element) =>
              act$({ command: "rename", name: element.value })
            }
          />
        </label>
        <label class="role-page__field">
          <span class="role-page__label">Description</span>
          <textarea
            class="role-page__description"
            value={role.description}
            rows={2}
            aria-label="Description of the document role"
            data-role-description
            disabled={state.busy}
            onChange$={(_, element) =>
              act$({ command: "describe", description: element.value })
            }
          />
        </label>
        <p class="role-page__standing" data-role-standing>
          {role.retired
            ? "Retired: not offered any more, assignments kept."
            : "Offered on every document."}{" "}
          <button
            type="button"
            class="role-page__button"
            disabled={state.busy}
            data-role-retire
            onClick$={() =>
              act$({ command: role.retired ? "restore" : "retire" })
            }
          >
            {role.retired ? "Restore" : "Retire"}
          </button>
        </p>
      </header>
      {state.notice !== "" && (
        <p class="role-page__notice" role="alert" data-role-notice>
          {state.notice}
        </p>
      )}
      <h3 class="role-page__heading">Block roles</h3>
      {role.blockRoles.length === 0 ? (
        <p class="role-page__empty" data-block-roles-empty>
          No block roles yet. A block of a document carrying this role can take
          one of the block roles listed here.
        </p>
      ) : (
        <ol class="role-page__block-roles" data-block-roles>
          {role.blockRoles.map((blockRole, index) => (
            <li
              key={blockRole.id}
              class="role-page__block-role"
              data-block-role-row={blockRole.id}
              data-retired={blockRole.retired ? "true" : undefined}
            >
              <input
                type="text"
                class="role-page__block-role-name"
                value={blockRole.name}
                aria-label={`Name of block role ${index + 1}`}
                disabled={state.busy}
                onChange$={(_, element) =>
                  act$({
                    command: "renameBlockRole",
                    blockRole: blockRole.id,
                    name: element.value,
                  })
                }
              />
              <input
                type="text"
                class="role-page__block-role-description"
                value={blockRole.description}
                placeholder="What a block of this role does"
                aria-label={`Description of block role ${index + 1}`}
                disabled={state.busy}
                onChange$={(_, element) =>
                  act$({
                    command: "describeBlockRole",
                    blockRole: blockRole.id,
                    description: element.value,
                  })
                }
              />
              <span class="role-page__block-role-controls">
                <button
                  type="button"
                  class="role-page__icon-button"
                  aria-label={`Move ${blockRole.name} up`}
                  disabled={state.busy || index === 0}
                  onClick$={() => move$(blockRole.id, -1)}
                >
                  <Icon name="arrows-out-line-vertical" />
                </button>
                <button
                  type="button"
                  class="role-page__icon-button"
                  aria-label={`Move ${blockRole.name} down`}
                  disabled={state.busy || index === role.blockRoles.length - 1}
                  onClick$={() => move$(blockRole.id, 1)}
                >
                  <Icon name="arrows-in-line-vertical" />
                </button>
                <button
                  type="button"
                  class="role-page__button"
                  data-block-role-retire={blockRole.id}
                  disabled={state.busy}
                  onClick$={() =>
                    act$({
                      command: blockRole.retired
                        ? "restoreBlockRole"
                        : "retireBlockRole",
                      blockRole: blockRole.id,
                    })
                  }
                >
                  {blockRole.retired ? "Restore" : "Retire"}
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
      <form class="role-page__add" preventdefault:submit onSubmit$={add$}>
        <input
          type="text"
          class="role-page__add-name"
          value={state.draft}
          placeholder="New block role"
          aria-label="Name of a new block role"
          data-new-block-role
          disabled={state.busy}
          onInput$={(_, element) => {
            state.draft = element.value;
          }}
        />
        <button
          type="submit"
          class="role-page__button"
          disabled={state.busy || state.draft.trim() === ""}
          data-add-block-role
        >
          Add block role
        </button>
      </form>
    </section>
  );
});
