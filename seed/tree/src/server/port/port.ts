/**
 * The one interface the server half reaches the world through
 * (`docs/system/foundation/device.md`, The Port). On an instance the Node
 * adapter answers it with what the server half has always done
 * (`adapters/node-server/port.ts`); in the apps the device adapter answers it
 * over the native bridge to the device cell (`CA_0076`). Nothing here names
 * Node, so a module that reaches the world only through it runs in both.
 * CA_0074_001
 */

/** The environment the frame reads; the kernel hands each to the tree it serves. */
export type PortEnvName =
  | "CALLIOPA_CCGW_URL"
  | "CALLIOPA_KERNEL_URL"
  | "CALLIOPA_KERNEL_SESSION"
  | "CALLIOPA_KERNEL_CALLBACK_SECRET";

/**
 * A value carried through one call and everything it awaits, so no module
 * threads it by hand: the request a server call answers, the branch it works
 * in. On Node it is async-local storage; a WebView has none, so it is the
 * port's to answer.
 */
export interface Scope<T> {
  run<R>(value: T, call: () => Promise<R>): Promise<R>;
  current(): T | undefined;
}

/**
 * The directories the application shares with a service beside it, by name:
 * `agent`, where the application and the agent meet (`agent/adapters.ts`),
 * and `media`, where the media service's sign-in is handed over
 * (`media`'s `server/media.ts`). Where each lives is the adapter's alone.
 */
export type ConfigDirectory = "agent" | "media";

/** The files of one shared directory, named relative to it. */
export interface ConfigFiles {
  /** The file's text, or null when it cannot be read. */
  read(path: string): Promise<string | null>;
  exists(path: string): Promise<boolean>;
  /** Written whole and renamed into place, so a reader never sees half of it. */
  replace(path: string, text: string, mode: number): Promise<void>;
}

export interface Port {
  /**
   * Where the shell runs: on a Calliopa instance, or on a device in the apps'
   * WebView, where the device cell answers the gateway and the kernel. What
   * differs is data — which parties exist, which capabilities stand — never a
   * component of its own (`docs/system/foundation/device.md`). BO_0319_047
   */
  readonly where: "instance" | "device";
  /**
   * Whether the network is there, as the capability states read it: always
   * on an instance, whose shell is served over it; on a device, what the
   * platform says. BO_0319_043
   */
  online(): boolean;
  /** The environment variable's value, or undefined when it is not set. */
  env(name: PortEnvName): string | undefined;
  /** The clock. */
  now(): Date;
  /** A random record identifier. */
  uuid(): string;
  /** Bytes from a cryptographically strong source. */
  randomBytes(size: number): Uint8Array;
  /** Whether two secrets are equal, compared in constant time. */
  sameSecret(presented: string, secret: string): boolean;
  /** A scope of its own for one kind of carried value. */
  scope<T>(): Scope<T>;
  /** The files of a directory shared with a service beside the application. */
  config(directory: ConfigDirectory): ConfigFiles;
  /**
   * The graph gateway, by its route under `CALLIOPA_CCGW_URL`: query, mutate,
   * explain, head, schema and blobs. Throws when the gateway's address is not
   * set.
   */
  gateway(path: string, init?: RequestInit): Promise<Response>;
  /**
   * The kernel, by its route under `CALLIOPA_KERNEL_URL`: sessions,
   * acceptance, proposals, document tools, party records, state records,
   * attachments and runs. Throws when the kernel's address is not set.
   */
  kernel(path: string, init?: RequestInit): Promise<Response>;
  /** Outbound HTTP to anywhere else. */
  fetch(url: string, init?: RequestInit): Promise<Response>;
}
