import { component$, useContext } from "@builder.io/qwik";

import type { BlockDecorationProps } from "~/contract";

import { roleState, type TakenRole } from "../lib/roles";
import { RolesContext } from "./provider";
import "./roles.css";

/**
 * A block's roles while reading (`BO_0299_Q7`, one per role since
 * `BO_0309_021`): each role's name as a small pill at the block, the idiom
 * the register word and the standing use, saying *not offered* when the role
 * above it went, *not allowed on a block* when blocks may no longer take it
 * (`BO_0332_013`) and *retired* when the role was, marked when a required value
 * is missing, and *proposed* while a run's proposal of it waits for the
 * person. Pressing a pill opens the chip's role control at that role. Nothing
 * on a block carrying none. It reads what the provider read once for the
 * document.
 */

/** What a pill says beside the role's name, or nothing. */
export function pillNote(role: TakenRole): string | null {
  if (role.proposed === "role") return "proposed";
  const state = roleState(role);
  if (state !== null) return state;
  if (role.proposed === "values") return "values proposed";
  return null;
}

/** The pill's title: what the role is, and what it lacks. */
export function pillTitle(role: TakenRole): string {
  const lacking = role.fields
    .filter((field) => role.missing.includes(field.key))
    .map((field) => field.name);
  const note = pillNote(role);
  return [
    note === null ? (role.description === "" ? `Role: ${role.name}` : role.description) : `${role.name} is ${note}`,
    ...(lacking.length === 0 ? [] : [`Missing: ${lacking.join(", ")}`]),
  ].join(". ");
}

export const RolePills = component$<{ roles: readonly TakenRole[]; subject: string }>(({ roles, subject }) => {
  const state = useContext(RolesContext);
  if (roles.length === 0) return null;
  return (
    <span class="block-roles" data-block-roles-of={subject}>
      {roles.map((role) => {
        const note = pillNote(role);
        return (
          <button
            key={role.id}
            type="button"
            class="block-role"
            data-block-role={role.id}
            data-role-state={note ?? undefined}
            data-role-missing={role.missing.length > 0 ? "true" : undefined}
            title={pillTitle(role)}
            aria-label={pillTitle(role)}
            // A pill opens the chip's control at its role. The press goes on
            // to the row, whose own press starts editing the block, and the
            // chip that then stands under it opens where the pill asked.
            onClick$={() => {
              state.opening = { subject, role: role.id };
            }}
          >
            <span class="block-role__name">{role.name}</span>
            {role.missing.length > 0 && (
              <span class="block-role__missing" aria-hidden="true">
                !
              </span>
            )}
            {note !== null && <span class="block-role__state">{note}</span>}
          </button>
        );
      })}
    </span>
  );
});

export const RoleLabel = component$<BlockDecorationProps>(({ blockId }) => {
  const roles = useContext(RolesContext);
  const block = roles.view?.blocks.find((candidate) => candidate.blockId === blockId);
  if (block === undefined || block.roles.length === 0) return null;
  return <RolePills roles={block.roles} subject={blockId} />;
});
