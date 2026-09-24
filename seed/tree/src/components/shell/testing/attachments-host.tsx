import { component$, useStore } from "@builder.io/qwik";

import {
  attachFiles,
  readyDescriptors,
  uploadingNames,
  type AttachmentChip,
  type UploadAnswer,
} from "~/lib/attachments";
import { AttachButton, AttachmentChips } from "../command-attachments";

/**
 * The paperclip and its chips wired in real JSX over a holder the host owns,
 * as a block's command control mounts them (`command-control.tsx`). Test
 * support, imported by `command-attachments.test.ts` and nothing that ships.
 * BO_0229_010 CA_0058_002
 *
 * Real JSX is the point. The optimizer compiles a prop written as
 * `object.field` through `_wrapProp`, which stays reactive only when the
 * object is a store; a test that builds its elements with `jsx()` never meets
 * that, which is how two lists froze in the served shell while every such
 * test passed.
 */
/**
 * The host's upload: it answers each file when the test releases it, with the
 * descriptor the kernel answers for text — the file's real SHA-256 — or the
 * refusal a released name asks for. The native picker cannot be filled in this
 * DOM, so the host hands `attachFiles`, the function the picker's change calls,
 * files it builds; what the chips and the post show is the component's own.
 * BO_0229_013
 */
const pending: { name: string; answer: (refusal: string | null) => void }[] = [];

const hostUpload = (file: File): Promise<UploadAnswer> =>
  new Promise((resolve) => {
    pending.push({
      name: file.name,
      answer: (refusal) => {
        if (refusal !== null) {
          resolve({ ok: false, error: refusal });
          return;
        }
        void file.arrayBuffer().then(async (bytes) => {
          const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
          const hash = `sha256:${Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("")}`;
          resolve({
            ok: true,
            descriptor: { hash, size: file.size, mediaType: file.type || "text/plain", filename: file.name, text: null, textStatus: "text" },
          });
        });
      },
    });
  });

/** Forgets uploads a test left held, so none answers into the next mount. */
export const resetUploads = (): void => {
  pending.length = 0;
};

/** Answers the oldest held upload: with its descriptor, or refused. */
export const releaseUpload = (refusal: string | null = null): void => {
  pending.shift()?.answer(refusal);
};

export const AttachmentsHost = component$(() => {
  const holder = useStore<{ attachments: AttachmentChip[]; attachNotice: string | null }>({
    attachments: [],
    attachNotice: null,
  });
  const state = useStore({ sending: false });
  return (
    <div>
      <div class="block-command__line">
        <AttachButton holder={holder} disabled={state.sending} />
        <AttachmentChips holder={holder} />
      </div>
      {/* A file refused before its upload is said beside the paperclip, as
          the control that holds them says it. BO_0229_010 */}
      {holder.attachNotice !== null && (
        <p class="block-command__notice" role="status" data-attach-refusal>
          {holder.attachNotice}
        </p>
      )}
      <button
        type="button"
        data-sending
        onClick$={() => {
          state.sending = !state.sending;
        }}
      >
        sending
      </button>
      <button
        type="button"
        data-host-attach
        onClick$={() => {
          // Two small files, and one past the 10 MB bound. Not awaited: the
          // uploads wait on the test's release.
          void attachFiles(
            holder,
            [
              new File(["# Plan\n"], "plan.md", { type: "text/markdown" }),
              new File(["notes"], "notes.txt", { type: "text/plain" }),
              new File([new Uint8Array(10 * 1024 * 1024 + 1)], "huge.bin"),
            ],
            hostUpload,
          );
        }}
      >
        attach
      </button>
      <button
        type="button"
        data-host-attach-many
        onClick$={() => {
          void attachFiles(
            holder,
            Array.from({ length: 11 }, (_, index) => new File([`file ${index}`], `f${index}.txt`, { type: "text/plain" })),
            hostUpload,
          );
        }}
      >
        attach eleven
      </button>
      <output data-attachments-sent>{JSON.stringify(readyDescriptors(holder.attachments).map((chip) => chip.filename))}</output>
      <output data-attachments-uploading>{JSON.stringify(uploadingNames(holder.attachments))}</output>
    </div>
  );
});
