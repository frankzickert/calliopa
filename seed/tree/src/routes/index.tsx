import { component$ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { HttpError } from "~/server/http-error";
import { Shell } from "~/components/shell/shell";
import { APP_NAME } from "~/lib/site";
import { listProcesses } from "~/server/processes";
import { readLicenceWarning } from "~/server/licence";
import { readLibrary } from "~/server/registry";
import { readSession } from "~/server/session";
import { readDefaultWorkspace } from "~/server/workspaces";

export const useWorkspaceView = routeLoader$(async ({ redirect, url }) => {
  // A page without a session cannot read the workspace the kernel keeps for
  // the person: rather than failing, it goes to sign-in carrying its path —
  // the kernel's own rule, met before the page is rendered. In prod the gate
  // has already sent a browser there; this answers the serve probe and any
  // caller reaching the tree's own port. BO_0209_003
  const workspace = await readDefaultWorkspace().catch((error: unknown) => {
    if (error instanceof HttpError && error.code === "sign_in_required") {
      throw redirect(303, `/__kernel/session/sign-in?return=${encodeURIComponent(url.pathname + url.search)}`);
    }
    throw error;
  });
  return {
    workspace,
    processes: await listProcesses(workspace.id),
    // Every contributed section's reader, by section key. A reader that fails
    // renders its section empty rather than failing the page: the library is
    // one region of a shell that still works without it. BO_0202_005
    library: await readLibrary(),
    // Whose authority the page acts under, and what the licence has to say,
    // both read per request from the kernel and the core. BO_0209_003 BO_0209_005
    person: await readSession(),
    licenceWarning: await readLicenceWarning(),
  };
});

export default component$(() => {
  const view = useWorkspaceView();
  return (
    <Shell
      workspace={view.value.workspace}
      processes={view.value.processes}
      library={view.value.library}
      person={view.value.person}
      licenceWarning={view.value.licenceWarning}
    />
  );
});

export const head: DocumentHead = {
  title: APP_NAME,
};
