import { component$ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { Shell } from "~/components/shell/shell";
import { APP_NAME } from "~/lib/site";
import { db } from "~/server/db";
import { listDocuments } from "~/server/documents/documents";
import {
  listEpisodes,
  listStandingAssets,
} from "~/server/production/production";
import { listFronts } from "~/server/publishing/front-api";
import { listProcesses } from "~/server/processes";
import { readDefaultWorkspace } from "~/server/workspaces";

export const useWorkspaceView = routeLoader$(async () => {
  const workspace = await readDefaultWorkspace();
  const documents = await listDocuments(db());
  const episodes = await listEpisodes(db());
  const standing = await listStandingAssets(db());
  const fronts = await listFronts(db());
  return {
    workspace,
    processes: await listProcesses(workspace.id),
    // A refused listing renders an empty category rather than failing the
    // page: the library is one region of a shell that still works without it.
    documents: documents.outcome === "success" ? documents.result : [],
    episodes: episodes.outcome === "success" ? episodes.result : [],
    standing:
      standing.outcome === "success"
        ? standing.result.map((asset) => ({
            assetId: asset.assetId,
            label: asset.label,
            role: asset.role,
            medium: asset.medium,
          }))
        : [],
    fronts: fronts.body.outcome === "success" ? fronts.body.result : [],
  };
});

export default component$(() => {
  const view = useWorkspaceView();
  return (
    <Shell
      workspace={view.value.workspace}
      processes={view.value.processes}
      documents={view.value.documents}
      episodes={view.value.episodes}
      standing={view.value.standing}
      fronts={view.value.fronts}
    />
  );
});

export const head: DocumentHead = {
  title: APP_NAME,
};
