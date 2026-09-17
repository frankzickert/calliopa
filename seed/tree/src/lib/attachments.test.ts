import { describe, expect, it } from "vitest";

import { readAttachments, deliveredWords, formatSize, type AttachmentDescriptor } from "./command-target";
import {
  admitFiles,
  attachFiles,
  readyDescriptors,
  removeAttachment,
  stillUploading,
  uploadingNames,
  type AttachmentHolder,
  type UploadAnswer,
} from "./attachments";

/** What a run request carries of files, and how the bar takes them. BO_0229_009 BO_0229_010 BO_0229_013 */
const hash = `sha256:${"a".repeat(64)}`;
const descriptor: AttachmentDescriptor = { hash, size: 7, mediaType: "text/markdown", filename: "plan.md", text: null, textStatus: "text" };

describe("reading a run request's attachments", () => {
  it("Given none, a coherent list, or one with extracted text, Then they are read as sent", () => {
    expect(readAttachments(undefined)).toEqual({ ok: true, attachments: [] });
    expect(readAttachments([descriptor])).toEqual({ ok: true, attachments: [descriptor] });
    const extracted = { ...descriptor, filename: "plan.docx", textStatus: "extracted", text: { hash: `sha256:${"b".repeat(64)}`, size: 12 } };
    expect(readAttachments([extracted])).toEqual({ ok: true, attachments: [extracted] });
  });

  it("Given a list the upload never answers, Then it is refused by name", () => {
    const refused = (value: unknown) => {
      const read = readAttachments(value);
      return read.ok ? null : read.error;
    };
    expect(refused("plan.md")).toBe("Attachments must be a list of the files the upload answered.");
    expect(refused(Array.from({ length: 11 }, () => descriptor))).toBe("A command carries at most 10 files; this one carries 11.");
    expect(refused([descriptor, { ...descriptor, hash: "abc" }])).toBe("Attachment 2 is missing its hash.");
    expect(refused([{ ...descriptor, size: -1 }])).toBe("Attachment 1 is missing its size.");
    expect(refused([{ ...descriptor, mediaType: "" }])).toBe("Attachment 1 is missing its media type.");
    expect(refused([{ ...descriptor, filename: " " }])).toBe("Attachment 1 is missing its name.");
    expect(refused([{ ...descriptor, textStatus: "maybe" }])).toBe("Attachment 1 is missing what a run can read of it.");
    expect(refused([{ ...descriptor, text: { hash: "x" } }])).toBe("Attachment 1 names its text without a hash and size.");
    expect(refused([null])).toBe("Attachment 1 is not a file the upload answered.");
  });

  it("Given sizes and deliveries, Then they read in the chip's and the process detail's words", () => {
    expect([formatSize(7), formatSize(2048), formatSize(3 * 1024 * 1024)]).toEqual(["7 B", "2 KB", "3.0 MB"]);
    expect(["text", "image", "metadata"].map(deliveredWords)).toEqual(["read as text", "seen as an image", "name, type and size only"]);
  });
});

describe("taking files into the bar", () => {
  it("Given files past the bound and past the tenth, Then admission refuses them in words and takes the rest", () => {
    expect(admitFiles(0, [{ name: "a", size: 1 }, { name: "big", size: 10 * 1024 * 1024 + 1 }, { name: "b", size: 10 * 1024 * 1024 }])).toEqual({
      admitted: [0, 2],
      refusals: ["big is larger than 10 MB, the most a command can carry per file."],
    });
    expect(admitFiles(9, [{ name: "ninth", size: 1 }, { name: "eleventh", size: 1 }])).toEqual({
      admitted: [0],
      refusals: ["eleventh was not attached: a command carries at most 10 files."],
    });
  });

  it("Given uploads answered and one refused, Then chips move from uploading to ready or refused, and only ready files are posted", async () => {
    const holder: AttachmentHolder = { attachments: [], attachNotice: null };
    const answers = new Map<string, (answer: UploadAnswer) => void>();
    const attached = attachFiles(
      holder,
      [new File(["# Plan\n"], "plan.md"), new File(["x"], "broken.txt"), new File([new Uint8Array(10 * 1024 * 1024 + 1)], "huge.bin")],
      (file) => new Promise((resolve) => answers.set(file.name, resolve)),
    );
    expect(holder.attachNotice).toBe("huge.bin is larger than 10 MB, the most a command can carry per file.");
    expect(holder.attachments.map((chip) => [chip.filename, chip.state])).toEqual([["plan.md", "uploading"], ["broken.txt", "uploading"]]);
    expect(uploadingNames(holder.attachments)).toEqual(["plan.md", "broken.txt"]);
    expect(stillUploading(uploadingNames(holder.attachments))).toBe("Wait for «plan.md», «broken.txt» to finish uploading.");
    answers.get("plan.md")?.({ ok: true, descriptor });
    answers.get("broken.txt")?.({ ok: false, error: "broken.txt could not be read" });
    await attached;
    expect(holder.attachments.map((chip) => [chip.filename, chip.state, chip.error])).toEqual([
      ["plan.md", "ready", null],
      ["broken.txt", "refused", "broken.txt could not be read"],
    ]);
    expect(readyDescriptors(holder.attachments)).toEqual([descriptor]);
  });

  it("Given a chip taken off while it uploads, Then its answer does not bring it back", async () => {
    const holder: AttachmentHolder = { attachments: [], attachNotice: "an old refusal" };
    let answer: (value: UploadAnswer) => void = () => undefined;
    const attached = attachFiles(holder, [new File(["x"], "gone.txt")], () => new Promise((resolve) => (answer = resolve)));
    expect(holder.attachNotice).toBeNull();
    removeAttachment(holder, holder.attachments[0]?.key ?? "");
    answer({ ok: true, descriptor });
    await attached;
    expect(holder.attachments).toEqual([]);
  });

  it("Given an upload that throws, Then its chip is refused with the reason", async () => {
    const holder: AttachmentHolder = { attachments: [], attachNotice: null };
    await attachFiles(holder, [new File(["x"], "offline.txt")], () => Promise.reject(new Error("network down")));
    expect(holder.attachments[0]?.state).toBe("refused");
    expect(holder.attachments[0]?.error).toBe("offline.txt did not upload: Error: network down");
  });
});
