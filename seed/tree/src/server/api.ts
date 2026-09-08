import type { RequestEvent } from "@builder.io/qwik-city";
import { HttpError } from "./http-error";

export async function api(
  event: RequestEvent,
  handler: () => Promise<unknown>,
): Promise<void> {
  event.cacheControl({ noCache: true, public: false });
  try {
    await handler();
  } catch (error) {
    if (error instanceof HttpError) {
      event.json(error.status, { error: error.message, ...(error.code === undefined ? {} : { code: error.code }) });
      return;
    }
    throw error;
  }
}
