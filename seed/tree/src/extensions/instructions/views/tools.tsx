import { $, component$, createContextId, Slot, useContext, useContextProvider, useStore, useTask$, useVisibleTask$ } from "@builder.io/qwik";

import type { BlockDecorationProps, DocumentDecorationProps } from "~/contract";
import { ViewBridgeContext, type ViewAction, type ViewBarGroup } from "~/components/shell/view-bridge";

import { TOOL_STATE_WORDS, type InstructionTools } from "../lib/instructions";
import "./instructions.css";

/**
 * An instruction's tools on its document (`calliopa-bootstrap`'s `BO_0311_012`):
 * each code block's headline says the tool it is and whether it is granted,
 * changed since the grant, or offline — or that it cannot run, while the
 * instruction is connected to no runtime — for everyone who reads it; and the
 * owner alone finds the grant in the document's bar: *Outside reach*, on to
 * grant every code block as it stands and off to revoke, one toggle per
 * named secret the grant may read, and *Grant again* once a block changed
 * since the grant. The kernel holds the grant and refuses anyone else
 * (`BO_0311_005`); a refusal is raised in its words. A document that is no
 * instruction draws nothing.
 */

export interface ToolsState {
  loaded: boolean;
  tools: InstructionTools;
  /** The secrets the next grant names, while none is granted. */
  secrets: string[];
  busy: boolean;
}

export const ToolsContext = createContextId<ToolsState>("instructions.tools");

const GROUP = "instruction-tools";

const read = async (state: ToolsState, documentId: string): Promise<void> => {
  const response = await fetch(`/api/x/instructions/documents/${encodeURIComponent(documentId)}/tools`).catch(() => null);
  const tools = response !== null && response.ok ? ((await response.json().catch(() => null)) as InstructionTools | null) : null;
  state.tools = tools ?? { instruction: false };
  if (state.tools.instruction && state.tools.grant?.granted === true) state.secrets = [...(state.tools.grant.secrets ?? [])];
  state.loaded = true;
};

export const InstructionToolsProvider = component$<DocumentDecorationProps>(({ documentId }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<ToolsState>({ loaded: false, tools: { instruction: false }, secrets: [], busy: false });
  useContextProvider(ToolsContext, state);

  // eslint-disable-next-line qwik/no-use-visible-task -- read in the browser with the person's session
  useVisibleTask$(async ({ track }) => {
    await read(state, track(() => documentId));
  });

  const write$ = $(async (method: "PUT" | "DELETE", secrets: readonly string[]) => {
    if (state.busy) return;
    state.busy = true;
    try {
      const response = await fetch(`/api/x/instructions/documents/${encodeURIComponent(documentId)}/grant`, {
        method,
        headers: { "content-type": "application/json" },
        ...(method === "PUT" ? { body: JSON.stringify({ secrets }) } : {}),
      }).catch(() => null);
      if (response === null || !response.ok) {
        const answer = response === null ? {} : ((await response.json().catch(() => ({}))) as { error?: string; detail?: string });
        await bridge.raiseMessage$({
          headline: method === "PUT" ? "The instruction was not granted" : "The grant was not revoked",
          body: answer.error ?? answer.detail ?? (response === null ? "The server could not be reached." : `The server answered ${response.status}.`),
          answers: [{ id: "ok", label: "OK" }],
        });
      }
      await read(state, documentId);
    } finally {
      state.busy = false;
    }
  });

  const reach$ = $((on: boolean) => write$(on ? "PUT" : "DELETE", state.secrets));
  const secret$ = $(async (name: string, on: boolean) => {
    state.secrets = on ? [...state.secrets.filter((held) => held !== name), name] : state.secrets.filter((held) => held !== name);
    if (state.tools.instruction && state.tools.grant?.granted === true) await write$("PUT", state.secrets);
  });
  const again$ = $(() => write$("PUT", state.secrets));

  useTask$(({ track }) => {
    const tools = track(() => state.tools);
    const secrets = track(() => state.secrets);
    const others = bridge.decorationBar.groups.filter((group) => group.id !== GROUP);
    if (!tools.instruction || !tools.owner || tools.grant === null || tools.grant.tools.length === 0) {
      bridge.decorationBar.groups = others;
      return;
    }
    const granted = tools.grant.granted;
    const actions: ViewAction[] = [
      { kind: "toggle", id: "instruction-grant", label: "Outside reach", icon: "globe", name: granted ? "Revoke this instruction's outside reach" : "Grant this instruction outside reach", on: granted, run$: reach$ },
      ...tools.secrets
        .filter((secret) => secret.set)
        .map(
          (secret): ViewAction => ({
            kind: "toggle",
            id: `instruction-secret-${secret.name}`,
            label: secret.name,
            name: `The grant may read the secret ${secret.name}`,
            on: secrets.includes(secret.name),
            run$: $((on: boolean) => secret$(secret.name, on)),
          }),
        ),
      ...(granted && tools.grant.tools.some((tool) => tool.state === "changed")
        ? [{ kind: "button", id: "instruction-grant-again", label: "Grant again", name: "Grant the changed code blocks again", run$: again$ } satisfies ViewAction]
        : []),
    ];
    const group: ViewBarGroup = { id: GROUP, label: "Instruction tools", actions };
    bridge.decorationBar.groups = [...others, group];
  });

  return <Slot />;
});

/** A code block's headline on an instruction: its tool name and state. */
export const ToolHeadline = component$<BlockDecorationProps>(({ blockId }) => {
  const state = useContext(ToolsContext, null);
  if (state === null || !state.loaded || !state.tools.instruction || state.tools.grant === null) return null;
  const tool = state.tools.grant.tools.find((candidate) => candidate.block === blockId);
  if (tool === undefined) return null;
  const words = state.tools.grant.runtime === null ? "cannot run: the instruction is connected to no runtime" : TOOL_STATE_WORDS[tool.state];
  return (
    <span class="instruction-tool" data-instruction-tool={tool.name} data-tool-state={state.tools.grant.runtime === null ? "no-runtime" : tool.state} title={tool.description}>
      <span class="instruction-tool__name">{tool.name}</span>
      <span class="instruction-tool__state">{words}</span>
    </span>
  );
});
