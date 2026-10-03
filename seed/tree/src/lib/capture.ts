import type { Captured } from "~/server/port/port";

/**
 * What a document's *Capture* group reaches (`docs/system/foundation/device.md`,
 * BO_0319_050): on a device the camera and the host's file picker through the
 * shell's capture routes, on an instance the browser's own file picker alone.
 * What is captured arrives as files, whatever the host handed over.
 */

export interface CaptureReach {
  readonly camera: boolean;
  /** Whether files are picked by the host rather than the browser. */
  readonly hostFiles: boolean;
}

const BROWSER: CaptureReach = { camera: false, hostFiles: false };

export async function captureReach(): Promise<CaptureReach> {
  const response = await fetch("/api/x/ui.shell/capture").catch(() => null);
  return response?.ok ? ((await response.json()) as CaptureReach) : BROWSER;
}

/** A captured file as a browser File; null for a text or an address. */
export function capturedFile(item: Captured): File | null {
  if (item.kind !== "file") return null;
  const binary = atob(item.data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], item.name, { type: item.mimeType });
}

async function answered<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? `the capture answered ${response.status}`);
  return body;
}

/** A photo through the device's camera, as a file; null when the person cancelled. */
export async function takePhoto(): Promise<File | null> {
  const { item } = await answered<{ item: Captured | null }>(await fetch("/api/x/ui.shell/capture/photo", { method: "POST" }));
  return item === null ? null : capturedFile(item);
}

/** Files through the device's picker, in the order picked. */
export async function pickHostFiles(): Promise<File[]> {
  const { items } = await answered<{ items: readonly Captured[] }>(await fetch("/api/x/ui.shell/capture/files", { method: "POST" }));
  return items.map(capturedFile).filter((file): file is File => file !== null);
}
