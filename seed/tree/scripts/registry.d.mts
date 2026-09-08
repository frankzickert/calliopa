export class RegistryScanError extends Error {
  readonly code: string;
}
export interface ScannedExtension {
  readonly id: string;
  readonly dir: string;
  readonly manifest: Record<string, unknown>;
  readonly client: string | null;
  readonly server: string | null;
}
export function scanExtensions(root: string): ScannedExtension[];
export function emitClient(entries: readonly ScannedExtension[]): string;
export function emitServer(entries: readonly ScannedExtension[]): string;
export function writeRegistry(root: string): {
  readonly entries: ScannedExtension[];
  readonly written: string[];
};
/** Whether a version satisfies a dependency range, in the grammar the kernel's flip check reads. BO_0219_007 */
export function satisfies(version: string, range: string): boolean;
