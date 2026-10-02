import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { suggestionSources } from "~/server/registry";

/**
 * The suggestion sources the build answers (`calliopa-bootstrap`'s
 * `BO_0336_052`): what a person may pick from when giving their own field
 * suggestions, as `{source, label}` with the source qualified
 * `<extension>:<name>`.
 */
export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    event.json(200, { sources: suggestionSources() });
  });
