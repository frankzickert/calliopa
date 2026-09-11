import type { RequestHandler } from "@builder.io/qwik-city";
import { withRequestContext } from "~/server/request-context";

/**
 * Every request runs inside its own context, so the kernel calls the server
 * makes for it forward the browser's session cookie: the bridge acts as the
 * signed-in person, never as a kernel-held principal. BO_0208_007
 * The context carries the host the browser reached, from the
 * `X-Forwarded-Host` the kernel's proxy sets, so a confirmation link names
 * it. BO_0241_006
 */
export const onRequest: RequestHandler = async ({ request, next }) => {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  await withRequestContext(request.headers.get("cookie") ?? "", next, host);
};
