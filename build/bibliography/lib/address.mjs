// Carried verbatim from `infra/capture/lib/address.mjs`: the address rule is capture's, and the
// bibliography service holds the same copy because each service image is
// built from its own directory. A change to one is a change to both. BO_0291_001
// The address rule: what the capture service may open. One function, applied
// to the address asked for and, through the proxy every browser connection
// passes, to every redirect and every request the page makes, at the moment
// it is made. A browser on the compose network that could open
// `http://app:8080/…` would read the graph, and a page that embeds a private
// address as an image would do it for the page's author.
// `docs/system/page-capture-service.md`, Fixed Constraints. BO_0277_002
import { isIP, isIPv4 } from "node:net";
import dns from "node:dns/promises";

// What an IPv4 address is refused as, or null when it is public. The classes
// are named in the words the refusal carries.
export function classifyIPv4(address) {
  const [a, b] = address.split(".").map(Number);
  if (a === 0) return "an unspecified address";
  if (a === 127) return "a loopback address";
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
    return "a private address";
  }
  if (a === 169 && b === 254) return "a link-local address";
  if (a === 100 && b >= 64 && b <= 127) return "the shared address space (100.64/10)";
  if (a === 192 && b === 0) return "a reserved address";
  if (a >= 224 && a <= 239) return "a multicast address";
  if (a >= 240) return "a reserved address";
  return null;
}

// Expands an IPv6 literal to its eight groups, or answers the IPv4 address it
// embeds (the `::ffff:a.b.c.d` form), so the v4 rule decides those.
function groupsOf(address) {
  const zoneless = address.split("%")[0];
  const mapped = zoneless.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return { v4: mapped[1] };
  const halves = zoneless.split("::");
  const parse = (part) => (part === "" ? [] : part.split(":").map((g) => parseInt(g, 16)));
  const left = parse(halves[0]);
  const right = halves.length > 1 ? parse(halves[1]) : [];
  const fill = new Array(Math.max(0, 8 - left.length - right.length)).fill(0);
  return { groups: [...left, ...fill, ...right] };
}

export function classifyIPv6(address) {
  const parsed = groupsOf(address);
  if (parsed.v4) return classifyIPv4(parsed.v4);
  const g = parsed.groups;
  if (g.every((x) => x === 0)) return "an unspecified address";
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return "a loopback address";
  // An IPv4 address carried in the last two groups: the mapped form written
  // in hex, and the NAT64 well-known prefix. The v4 rule decides.
  const embedded = (prefixOk) =>
    prefixOk ? classifyIPv4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`) : undefined;
  const mappedHex = embedded(g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff);
  if (mappedHex !== undefined) return mappedHex;
  const nat64 = embedded(g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0));
  if (nat64 !== undefined) return nat64;
  if ((g[0] & 0xfe00) === 0xfc00) return "a private address";
  if ((g[0] & 0xffc0) === 0xfe80) return "a link-local address";
  if ((g[0] & 0xff00) === 0xff00) return "a multicast address";
  return null;
}

export function classifyAddress(address) {
  const family = isIP(address);
  if (family === 4) return classifyIPv4(address);
  if (family === 6) return classifyIPv6(address);
  return "not an address";
}

// The default resolver: every address the name resolves to, so a name that
// answers one public and one private address is refused for the private one.
export async function lookupAll(host) {
  const records = await dns.lookup(host, { all: true, verbatim: true });
  return records.map((r) => r.address);
}

// Decides one address. Answers `{ok: true, host, port, addresses}` — the
// addresses the connection may be made to — or `{ok: false, reason}` in the
// words the caller shows. `resolve` is the resolver, injectable so the rule is
// proven without a network; the classes are decided here, never by it.
export async function refusal(target, { resolve = lookupAll } = {}) {
  let url;
  try {
    url = new URL(String(target));
  } catch {
    return { ok: false, reason: "not an address" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "the scheme must be http or https" };
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const port = Number(url.port) || (url.protocol === "https:" ? 443 : 80);
  const literal = isIP(host);
  if (literal) {
    const why = classifyAddress(host);
    return why ? { ok: false, reason: `${host} is ${why}` } : { ok: true, host, port, addresses: [host] };
  }
  if (!host.includes(".") || host.endsWith(".localhost")) {
    return { ok: false, reason: `${host} is a name with no domain: the stack's own service names and the host's are refused` };
  }
  let addresses;
  try {
    addresses = await resolve(host);
  } catch {
    addresses = [];
  }
  if (!addresses || addresses.length === 0) {
    return { ok: false, reason: `${host} could not be resolved` };
  }
  for (const address of addresses) {
    const why = classifyAddress(address);
    if (why) return { ok: false, reason: `${host} resolves to ${address}, ${why}` };
  }
  return { ok: true, host, port, addresses: addresses.filter((a) => isIPv4(a)).concat(addresses.filter((a) => !isIPv4(a))) };
}
