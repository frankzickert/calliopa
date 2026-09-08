/**
 * Where the graph and the kernel are.
 *
 * The kernel hands both addresses to the tree it serves (`ui-kernel.md`,
 * `BO_0207_001`): CCGW, which the shell's server side reads directly, and the
 * kernel's own public port, which is the only way the shell writes. Neither is
 * something graph-hosted code should guess, so absence is an error rather than
 * a default.
 */

export interface GraphEnv {
  readonly ccgwUrl: string;
  readonly kernelUrl: string;
}

export function readGraphEnv(
  source: Record<string, string | undefined> = process.env,
): GraphEnv {
  const ccgwUrl = (source["CALLIOPA_CCGW_URL"] ?? "").trim();
  const kernelUrl = (source["CALLIOPA_KERNEL_URL"] ?? "").trim();
  const missing = [
    ...(ccgwUrl === "" ? ["CALLIOPA_CCGW_URL"] : []),
    ...(kernelUrl === "" ? ["CALLIOPA_KERNEL_URL"] : []),
  ];
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment ${missing.length === 1 ? "variable" : "variables"}: ${missing.join(", ")}`,
    );
  }
  return {
    ccgwUrl: ccgwUrl.replace(/\/+$/, ""),
    kernelUrl: kernelUrl.replace(/\/+$/, ""),
  };
}

let cached: GraphEnv | undefined;

export function graphEnv(): GraphEnv {
  cached ??= readGraphEnv();
  return cached;
}
