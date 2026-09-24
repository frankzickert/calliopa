// The address rule, proven without a network: the resolver is handed in, the
// classes are decided here. BO_0277_002
import test from "node:test";
import assert from "node:assert/strict";
import { classifyAddress, refusal } from "../lib/address.mjs";

const table = {
  "public.test": ["203.0.113.7"],
  "private.test": ["10.0.0.5"],
  "mixed.test": ["203.0.113.8", "192.168.1.1"],
  "v6.test": ["2001:db8::1"],
  "ula.test": ["fd12:3456::1"],
  "mapped.test": ["::ffff:127.0.0.1"],
  "nowhere.test": [],
};
const resolve = async (host) => table[host] ?? [];

test("public addresses are allowed and the connection targets what resolved", async () => {
  const decision = await refusal("https://public.test/a?b=1", { resolve });
  assert.equal(decision.ok, true);
  assert.deepEqual(decision.addresses, ["203.0.113.7"]);
  assert.equal(decision.port, 443);
  assert.equal((await refusal("http://v6.test/", { resolve })).ok, true);
  assert.equal((await refusal("http://203.0.113.9:8080/", { resolve })).port, 8080);
});

test("every refused class is named in words", async () => {
  const cases = [
    ["ftp://public.test/", "the scheme must be http or https"],
    ["file:///etc/passwd", "the scheme must be http or https"],
    ["not a url", "not an address"],
    ["http://app:8080/v1/head", "a name with no domain"],
    ["http://kernel/", "a name with no domain"],
    ["http://localhost:8080/", "a name with no domain"],
    ["http://foo.localhost/", "a name with no domain"],
    ["http://127.0.0.1:8080/", "a loopback address"],
    ["http://[::1]/", "a loopback address"],
    ["http://10.1.2.3/", "a private address"],
    ["http://172.20.0.2/", "a private address"],
    ["http://192.168.0.1/", "a private address"],
    ["http://169.254.169.254/latest/meta-data", "a link-local address"],
    ["http://100.114.122.91:4460/", "the shared address space"],
    ["http://0.0.0.0/", "an unspecified address"],
    ["http://224.0.0.1/", "a multicast address"],
    ["http://255.255.255.255/", "a reserved address"],
    ["http://[fe80::1]/", "a link-local address"],
    ["http://[fd00::1]/", "a private address"],
    ["http://[::ffff:10.0.0.1]/", "a private address"],
    ["http://[64:ff9b::7f00:1]/", "a loopback address"],
    ["http://private.test/", "a private address"],
    ["http://mixed.test/", "a private address"],
    ["http://ula.test/", "a private address"],
    ["http://mapped.test/", "a loopback address"],
    ["http://nowhere.test/", "could not be resolved"],
  ];
  for (const [target, expected] of cases) {
    const decision = await refusal(target, { resolve });
    assert.equal(decision.ok, false, `${target} should be refused`);
    assert.match(decision.reason, new RegExp(expected), `${target}: ${decision.reason}`);
  }
});

test("a resolver that throws reads as unresolvable, never as allowed", async () => {
  const decision = await refusal("http://broken.test/", {
    resolve: async () => {
      throw new Error("dns down");
    },
  });
  assert.equal(decision.ok, false);
  assert.match(decision.reason, /could not be resolved/);
});

test("classification answers null for a public address and a class for the rest", () => {
  assert.equal(classifyAddress("93.184.216.34"), null);
  assert.equal(classifyAddress("2606:4700::1111"), null);
  assert.equal(classifyAddress("172.15.0.1"), null);
  assert.equal(classifyAddress("172.31.255.255"), "a private address");
  assert.equal(classifyAddress("100.63.0.1"), null);
  assert.equal(classifyAddress("100.127.255.255"), "the shared address space (100.64/10)");
  assert.equal(classifyAddress("nonsense"), "not an address");
});
