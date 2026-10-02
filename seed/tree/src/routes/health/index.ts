import type { RequestHandler } from "@builder.io/qwik-city";

import { healthResponse, probe, reach } from "~/server/health";
import { port } from "~/server/port";

/**
 * The operational readiness probe: the one graph and the kernel, reached
 * rather than assumed. The shell holds no store to probe since `BO_0207_016`.
 */
export const onGet: RequestHandler = async ({ cacheControl, json }) => {
  cacheControl({ noCache: true, public: false });

  const [ccgw, kernel] = await Promise.all([
    probe(() => reach(port.gateway, "/healthz")),
    probe(() => reach(port.kernel, "/__kernel/agent/health")),
  ]);

  const response = healthResponse(ccgw, kernel);
  json(response.statusCode, response.report);
};
