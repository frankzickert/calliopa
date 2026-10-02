import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { port } from ".";

/** The port as an instance answers it, through the `#port` binding every build resolves. CA_0074_001 */
describe("the server port on an instance", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reads the environment when asked, not when it loaded", () => {
    vi.stubEnv("CALLIOPA_KERNEL_CALLBACK_SECRET", "s3cret");
    expect(port.env("CALLIOPA_KERNEL_CALLBACK_SECRET")).toBe("s3cret");
  });

  it("compares secrets whole, whatever their length", () => {
    expect(port.sameSecret("s3cret", "s3cret")).toBe(true);
    expect(port.sameSecret("s3cre", "s3cret")).toBe(false);
    expect(port.sameSecret("s3creT", "s3cret")).toBe(false);
  });

  it("carries a scope's value through everything a call awaits, and only there", async () => {
    const scope = port.scope<string>();
    const seen = await scope.run("inside", async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return scope.current();
    });
    expect(seen).toBe("inside");
    expect(scope.current()).toBeUndefined();
  });

  it("names the gateway and the kernel by route under the addresses the kernel handed over", async () => {
    vi.stubEnv("CALLIOPA_CCGW_URL", "http://ccgw.test/");
    vi.stubEnv("CALLIOPA_KERNEL_URL", " http://kernel.test ");
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      asked.push(url);
      return new Response("{}");
    });
    await port.gateway("/v1/head");
    await port.kernel("/__kernel/attachments", { method: "POST" });
    expect(asked).toEqual(["http://ccgw.test/v1/head", "http://kernel.test/__kernel/attachments"]);
  });

  it("refuses to guess an address the kernel did not hand over", async () => {
    vi.stubEnv("CALLIOPA_CCGW_URL", "");
    await expect(port.gateway("/v1/head")).rejects.toThrow(/CALLIOPA_CCGW_URL/u);
  });

  describe("the agent configuration files", () => {
    let dir = "";
    afterEach(async () => {
      if (dir !== "") await rm(dir, { recursive: true, force: true });
    });

    it("replaces a file whole, in a directory it makes, with the mode asked for", async () => {
      dir = await mkdtemp(join(tmpdir(), "calliopa-port-"));
      vi.stubEnv("CALLIOPA_AGENT_CONFIG_DIR", dir);
      expect(await port.agentConfig.read("login/request.json")).toBeNull();
      expect(await port.agentConfig.exists("login/request.json")).toBe(false);

      await port.agentConfig.replace("login/request.json", '{"runtime":"codex"}', 0o600);

      expect(await readFile(join(dir, "login", "request.json"), "utf8")).toBe('{"runtime":"codex"}');
      expect((await stat(join(dir, "login", "request.json"))).mode & 0o777).toBe(0o600);
      expect(await readdir(join(dir, "login"))).toEqual(["request.json"]);
      expect(await port.agentConfig.read("login/request.json")).toBe('{"runtime":"codex"}');
      expect(await port.agentConfig.exists("login/request.json")).toBe(true);
    });
  });
});
