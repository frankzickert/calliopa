import type { RequestHandler } from "@builder.io/qwik-city";

import { graphEnv } from "~/server/ccgw/env";
import { healthResponse, probe, reachUrl } from "~/server/health";

/**
 * The operational readiness probe: the one graph and the kernel, reached
 * rather than assumed. The shell holds no store to probe since `BO_0207_016`.
 */
export const onGet: RequestHandler = async ({ cacheControl, json }) => {
  cacheControl({ noCache: true, public: false });

  const [ccgw, kernel] = await Promise.all([
    probe(() => reachUrl(`${graphEnv().ccgwUrl}/healthz`)),
    probe(() => reachUrl(`${graphEnv().kernelUrl}/__kernel/agent/health`)),
  ]);

  const response = healthResponse(ccgw, kernel);
  json(response.statusCode, response.report);
};
