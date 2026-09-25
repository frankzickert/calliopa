import { component$, useContext } from "@builder.io/qwik";

import type { BlockDecorationProps } from "~/contract";

import { roleState } from "../lib/roles";
import { RolesContext } from "./provider";

/**
 * A block's role while reading (`BO_0299_015`, `BO_0299_Q7`): the role's
 * name as a small label at the block, the idiom the register word and the
 * standing use, saying *not offered* when the document's role changed
 * under it and *retired* when the role was; nothing on a block carrying
 * none. It reads what the provider read once for the document.
 */
export const RoleLabel = component$<BlockDecorationProps>(({ blockId }) => {
  const roles = useContext(RolesContext);
  const block = roles.view?.blocks.find(
    (candidate) => candidate.blockId === blockId,
  );
  const role = block?.blockRole ?? null;
  if (role === null) return null;
  const state = roleState(role);
  return (
    <span
      class="block-role"
      data-block-role={role.id}
      data-role-state={state ?? undefined}
      title={
        state === null
          ? role.description === ""
            ? `Block role: ${role.name}`
            : role.description
          : `${role.name} is ${state}`
      }
    >
      <span class="block-role__name">{role.name}</span>
      {state !== null && <span class="block-role__state">{state}</span>}
    </span>
  );
});
