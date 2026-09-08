/**
 * The shell's readiness. `BO_0207_016`
 *
 * The shell keeps no store of its own, so what it depends on is the one
 * graph and the kernel that serves it: CCGW at `CALLIOPA_CCGW_URL`, where
 * every read goes, and the kernel at `CALLIOPA_KERNEL_URL`, where every
 * write and every piece of working state goes. `/health` reports both by
 * reaching them rather than by process liveness.
 */

export type DependencyState =
  | { readonly reachable: true }
  | { readonly reachable: false; readonly error: string };

export interface HealthReport {
  readonly status: "ok" | "unhealthy";
  readonly ccgw: DependencyState;
  readonly kernel: DependencyState;
}

export interface HealthResponse {
  readonly statusCode: 200 | 503;
  readonly report: HealthReport;
}

export function healthResponse(ccgw: DependencyState, kernel: DependencyState): HealthResponse {
  const healthy = ccgw.reachable && kernel.reachable;
  return {
    statusCode: healthy ? 200 : 503,
    report: {
      status: healthy ? "ok" : "unhealthy",
      ccgw,
      kernel,
    },
  };
}

export async function probe(reach: () => Promise<unknown>): Promise<DependencyState> {
  try {
    await reach();
    return { reachable: true };
  } catch (error) {
    return {
      reachable: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** One GET that must answer 2xx for the dependency to count as reachable. */
export async function reachUrl(url: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
}
