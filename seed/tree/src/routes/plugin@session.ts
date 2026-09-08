import type { RequestHandler } from "@builder.io/qwik-city";
import { withRequestContext } from "~/server/request-context";

/**
 * Every request runs inside its own context, so the kernel calls the server
 * makes for it forward the browser's session cookie: the bridge acts as the
 * signed-in person, never as a kernel-held principal. BO_0208_007
 */
export const onRequest: RequestHandler = async ({ request, next }) => {
  await withRequestContext(request.headers.get("cookie") ?? "", next);
};
