import { $, component$, useStore } from "@builder.io/qwik";

import type { Layout } from "~/lib/layout";
import { LearnedSection } from "../learned";

/**
 * *What Hermes learned* mounted as the shell mounts it in the right panel.
 * Test support, imported by `learned.test.ts` and nothing that ships.
 * BO_0350_023
 */
export const LearnedHost = component$(() => {
  const layout = useStore<Layout>({ sections: {} } as unknown as Layout);
  return <LearnedSection layout={layout} onToggle$={$(() => undefined)} />;
});
