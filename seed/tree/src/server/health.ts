export type DependencyState =
  | { readonly reachable: true }
  | { readonly reachable: false; readonly error: string };

export interface HealthReport {
  readonly status: "ok" | "unhealthy";
  readonly postgres: DependencyState;
  readonly garage: DependencyState;
}

export interface HealthResponse {
  readonly statusCode: 200 | 503;
  readonly report: HealthReport;
}

export function healthResponse(
  postgres: DependencyState,
  garage: DependencyState,
): HealthResponse {
  const healthy = postgres.reachable && garage.reachable;
  return {
    statusCode: healthy ? 200 : 503,
    report: {
      status: healthy ? "ok" : "unhealthy",
      postgres,
      garage,
    },
  };
}

export async function probe(
  reach: () => Promise<unknown>,
): Promise<DependencyState> {
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
