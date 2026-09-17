import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  type AttachmentDescriptor,
} from "./command-target";

/**
 * The files the command bar holds for the next command (`BO_0229_010`): each
 * uploaded the moment it is chosen and shown as a chip until *Run* sends it or
 * the reader takes it off. What *Run* posts is the ready descriptors, read
 * from this list at the press.
 */

export type AttachmentState = "uploading" | "ready" | "refused";

export interface AttachmentChip {
  readonly key: string;
  readonly filename: string;
  readonly size: number;
  readonly state: AttachmentState;
  /** The refusal in words, for a chip whose upload was refused. */
  readonly error: string | null;
  readonly descriptor: AttachmentDescriptor | null;
}

/** The store the bar's attachments live on: the shell's run store. */
export interface AttachmentHolder {
  attachments: AttachmentChip[];
  /** A file refused before any upload — past the bound or the tenth — said beside the paperclip. */
  attachNotice: string | null;
}

export type UploadAnswer =
  | { readonly ok: true; readonly descriptor: AttachmentDescriptor }
  | { readonly ok: false; readonly error: string };

export type Upload = (file: File) => Promise<UploadAnswer>;

/** A file as admission reads it. */
export interface Offered {
  readonly name: string;
  readonly size: number;
}

/**
 * Which of the offered files the bar takes, given how many it holds: one
 * over 10 MB is refused, and so is one past the tenth, in words and without an
 * upload. A refused chip still counts toward ten until it is taken off, since
 * it stands in the bar.
 */
export function admitFiles(
  held: number,
  offered: readonly Offered[],
): { readonly admitted: readonly number[]; readonly refusals: readonly string[] } {
  const admitted: number[] = [];
  const refusals: string[] = [];
  let count = held;
  offered.forEach((file, index) => {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      refusals.push(`${file.name} is larger than 10 MB, the most a command can carry per file.`);
    } else if (count >= MAX_ATTACHMENTS) {
      refusals.push(`${file.name} was not attached: a command carries at most ${MAX_ATTACHMENTS} files.`);
    } else {
      admitted.push(index);
      count += 1;
    }
  });
  return { admitted, refusals };
}

let sequence = 0;

/**
 * Takes the chosen files into the bar: refuses what admission refuses, shows
 * each admitted file as *uploading*, and uploads them at once, each chip
 * becoming *ready* or its refusal. A chip taken off while its upload runs is
 * not brought back by the answer.
 */
export async function attachFiles(holder: AttachmentHolder, files: readonly File[], upload: Upload): Promise<void> {
  const { admitted, refusals } = admitFiles(holder.attachments.length, files);
  holder.attachNotice = refusals.length === 0 ? null : refusals.join(" ");
  const started = admitted.map((index) => {
    const file = files[index] as File;
    sequence += 1;
    const chip: AttachmentChip = {
      key: `attachment-${Date.now()}-${sequence}`,
      filename: file.name,
      size: file.size,
      state: "uploading",
      error: null,
      descriptor: null,
    };
    holder.attachments = [...holder.attachments, chip];
    return { file, key: chip.key };
  });
  await Promise.all(
    started.map(async ({ file, key }) => {
      let answer: UploadAnswer;
      try {
        answer = await upload(file);
      } catch (error) {
        answer = { ok: false, error: `${file.name} did not upload: ${String(error)}` };
      }
      holder.attachments = holder.attachments.map((chip) =>
        chip.key !== key
          ? chip
          : answer.ok
            ? { ...chip, state: "ready", descriptor: answer.descriptor }
            : { ...chip, state: "refused", error: answer.error },
      );
    }),
  );
}

/** Takes one chip off the bar. */
export function removeAttachment(holder: AttachmentHolder, key: string): void {
  holder.attachments = holder.attachments.filter((chip) => chip.key !== key);
  holder.attachNotice = null;
}

/** The descriptors *Run* posts: the ready files, in the order they were chosen. */
export const readyDescriptors = (chips: readonly AttachmentChip[]): AttachmentDescriptor[] =>
  chips.flatMap((chip) => (chip.state === "ready" && chip.descriptor !== null ? [chip.descriptor] : []));

/** The files still uploading, by name, which *Run* waits for. */
export const uploadingNames = (chips: readonly AttachmentChip[]): string[] =>
  chips.filter((chip) => chip.state === "uploading").map((chip) => chip.filename);

/** The refusal *Run* answers while a file is still uploading. */
export const stillUploading = (names: readonly string[]): string =>
  `Wait for ${names.map((name) => `«${name}»`).join(", ")} to finish uploading.`;

/** A chip's accessible name: the file, its size and its state. */
export function attachmentChipName(chip: AttachmentChip, size: string): string {
  switch (chip.state) {
    case "uploading":
      return `${chip.filename}, ${size}, uploading`;
    case "ready":
      return `${chip.filename}, ${size}, attached`;
    default:
      return `${chip.filename}, refused: ${chip.error ?? "not attached"}`;
  }
}

/** The upload the bar uses in the browser: the shell's own route. BO_0229_008 */
export const uploadFile: Upload = async (file) => {
  const response = await fetch("/api/attachments", {
    method: "POST",
    headers: {
      "content-type": file.type === "" ? "application/octet-stream" : file.type,
      "x-calliopa-filename": encodeURIComponent(file.name),
    },
    body: file,
  });
  const answered = (await response.json().catch(() => null)) as (AttachmentDescriptor & { error?: string }) | null;
  if (!response.ok || answered === null) {
    return { ok: false, error: answered?.error ?? `${file.name} did not upload: the shell answered ${response.status}.` };
  }
  return { ok: true, descriptor: answered };
};
