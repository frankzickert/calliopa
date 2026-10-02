import type { RequestHandler } from "@builder.io/qwik-city";
import { qualify } from "~/registry";
import { api } from "~/server/api";
import { suggest } from "~/server/registry";

/**
 * One source's suggestions (`calliopa-bootstrap`'s `BO_0336_052`): the frame
 * asks the extension that answers it, so the extension drawing the field
 * knows nothing of what the values mean. The subject's values arrive as the
 * query, one parameter per field key. A source nothing in the build answers —
 * its extension switched off — is a 404.
 */
export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const source = qualify(event.params["ext"] ?? "", event.params["name"] ?? "");
    const values: Record<string, string> = {};
    for (const [key, value] of new URL(event.request.url).searchParams) values[key] = value;
    const answer = await suggest(source, values);
    if (answer === undefined) {
      event.json(404, { error: `no extension answers the suggestion source ${source}` });
      return;
    }
    event.json(200, answer);
  });
