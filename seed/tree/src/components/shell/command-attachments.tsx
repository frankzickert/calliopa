import { $, component$ } from "@builder.io/qwik";

import { formatSize } from "~/lib/command-target";
import {
  attachFiles,
  attachmentChipName,
  removeAttachment,
  uploadFile,
  type AttachmentHolder,
} from "~/lib/attachments";
import { Icon } from "./icons";

/**
 * The command bar's files (`BO_0229_010`): the paperclip beside the field and
 * the attachment chips along the field's bottom edge, before the reference
 * chips. Its own module so the render harness presses what the shell mounts.
 *
 * Both take the store itself, never `.attachments` of it: a prop written as
 * `object.field` stays reactive only when the object is a store
 * (`qwik-member-props-freeze`). Every attribute is written unconditionally
 * (`BO_0225`'s `Duplicate key "value"`).
 */

/** *Attach files*: a native file picker, each chosen file uploaded at once. */
export const AttachButton = component$<{ holder: AttachmentHolder; disabled: boolean }>(({ holder, disabled }) => {
  const pick$ = $(async (_event: Event, input: HTMLInputElement) => {
    const files = Array.from(input.files ?? []);
    // Cleared first, so choosing the same file again is a change.
    input.value = "";
    await attachFiles(holder, files, uploadFile);
  });
  return (
    <label class="composer__attach" data-attach aria-disabled={disabled ? "true" : "false"}>
      <input
        type="file"
        multiple
        class="visually-hidden"
        aria-label="Attach files"
        data-attach-input
        disabled={disabled}
        onChange$={pick$}
      />
      <Icon name="paperclip" />
    </label>
  );
});

/** What the command carries of files: one chip per file, each with its × . */
export const AttachmentChips = component$<{ holder: AttachmentHolder }>(({ holder }) => {
  if (holder.attachments.length === 0) return null;
  return (
    <ul class="composer__chips composer__attachments" data-attachments aria-label="Files the command carries">
      {holder.attachments.map((chip) => (
        <li key={chip.key}>
          <span
            class="chip chip--attachment"
            data-attachment-chip={chip.filename}
            data-attachment-state={chip.state}
            aria-label={attachmentChipName(chip, formatSize(chip.size))}
            title={chip.error ?? chip.filename}
          >
            {chip.state === "refused" && <Icon name="warning" />}
            <span class="chip__name">{chip.filename}</span>
            <span class="chip__meta">
              {chip.state === "uploading" ? "uploading" : chip.state === "ready" ? formatSize(chip.size) : "refused"}
            </span>
            <button
              type="button"
              class="chip__remove"
              data-attachment-remove={chip.filename}
              aria-label={`Remove «${chip.filename}»`}
              onClick$={() => removeAttachment(holder, chip.key)}
            >
              <Icon name="x" />
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
});
