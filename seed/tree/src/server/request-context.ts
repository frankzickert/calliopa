import { AsyncLocalStorage } from "node:async_hooks";

/**
 * What the request the server is answering carried, for the calls the server
 * makes on its behalf: the session cookie the kernel set, which the bridge
 * verbs resolve the person from (`ui-kernel.md`, `BO_0208_007`). Carried in
 * async-local storage so no module threads it by hand; a call outside a
 * request — the behavior suites — reads `CALLIOPA_KERNEL_SESSION` instead,
 * which the kernel harness sets after signing a test human in.
 */
interface RequestContext {
  readonly cookie: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function withRequestContext<T>(cookie: string, run: () => Promise<T>): Promise<T> {
  return storage.run({ cookie }, run);
}

/** The `Cookie` header to forward to the kernel, or `undefined`. */
export function forwardedCookie(): string | undefined {
  const cookie = storage.getStore()?.cookie;
  if (cookie !== undefined && cookie !== "") return cookie;
  const session = process.env["CALLIOPA_KERNEL_SESSION"];
  return session === undefined || session === "" ? undefined : `calliopa_session=${session}`;
}
