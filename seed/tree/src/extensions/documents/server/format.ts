import { call } from "~/server/kernel/client";

/**
 * A code block's source, pretty-printed through the kernel (`BO_0296_015`):
 * `POST /__kernel/code/format` with the language and the source, which the
 * kernel forwards to the code service and the service to the formatter in its
 * own container (`calliopa-bootstrap`'s `code-service.md`, Formatting).
 *
 * The answer is always a source. A fragment that does not parse, a language
 * no formatter knows, a refusal, a timeout, a kernel that serves no code
 * surface and a kernel that cannot be reached each answer the source exactly
 * as it came — so a settled edit is never lost to a service being down, and
 * nothing is said to the person: not formatting is not news (user decision,
 * 2026-09-23).
 */

/** How long a settle waits for the formatter before writing the source as
 * typed: above the formatter's own cap, so its answer arrives first. */
const FORMAT_WAIT_MS = 12_000;

export async function formatSource(source: string, language: string | undefined, waitMs = FORMAT_WAIT_MS): Promise<string> {
  if (language === undefined || language.trim() === "" || source.trim() === "") return source;
  try {
    const answer = await call("/__kernel/code/format", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language, source }),
      signal: AbortSignal.timeout(waitMs),
    });
    if (!answer.ok) return source;
    const body = (await answer.json()) as unknown;
    if (body === null || typeof body !== "object") return source;
    const { formatted, source: written } = body as { formatted?: unknown; source?: unknown };
    if (formatted !== true || typeof written !== "string") return source;
    return written;
  } catch {
    return source;
  }
}
