// CCGW helper for the install seed bundle (BO_0090_003). Runs inside the
// kernel container, which carries node; every write goes through the gateway's
// HTTP surface under the installer's human provenance — no bypass path.
//
//   node ccgw.mjs apply  <base-url> <principal> <payload-dir>
//   node ccgw.mjs exists <base-url> <principal> <block-type> <id>
//   node ccgw.mjs field  <bundle.json> <field>
//
// apply: check-then-create for each payload, so a re-run against a seeded
// instance is a no-op and a partial seed is repaired, not duplicated.
// exists: exit 0 when the block exists, 1 when it does not.
// field: print one string field of the bundle manifest (no jq in the image).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PURPOSE = "calliopa-install-seed";

// Every write presents the owner's credential, which run.sh exports from the
// secrets volume: since BO_0206 a mutation without one is refused. BO_0215_001
function headers() {
  const out = { "content-type": "application/json" };
  if (process.env.CALLIOPA_CREDENTIAL) {
    out.authorization = `Bearer ${process.env.CALLIOPA_CREDENTIAL}`;
  }
  return out;
}

async function post(base, route, body) {
  const response = await fetch(`${base.replace(/\/+$/, "")}${route}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const envelope = await response.json().catch(() => ({}));
  if (!response.ok && envelope.status === undefined) {
    throw new Error(`${route}: HTTP ${response.status}`);
  }
  return envelope;
}

async function query(base, principal, statement, parameters) {
  const envelope = await post(base, "/v1/cypher/query", {
    statement,
    parameters,
    context: { principal, purpose: PURPOSE },
  });
  if (envelope.status === "success") return true;
  if (envelope.status === "no_result") return false;
  throw new Error(`query failed: ${envelope.status} ${JSON.stringify(envelope.diagnostics ?? [])}`);
}

async function mutate(base, principal, statement, parameters) {
  const envelope = await post(base, "/v1/cypher/mutate", {
    statement,
    parameters,
    context: { principal, purpose: PURPOSE, identity: "human" },
  });
  if (envelope.status !== "success") {
    throw new Error(`mutation failed: ${envelope.status} ${JSON.stringify(envelope.diagnostics ?? [])}`);
  }
}

const [mode, ...args] = process.argv.slice(2);
try {
  if (mode === "apply") {
    const [base, principal, dir] = args;
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
      const payload = JSON.parse(readFileSync(join(dir, name), "utf8"));
      if (await query(base, principal, payload.checkStatement, payload.checkParameters)) {
        console.log(`already present: ${payload.label}`);
        continue;
      }
      await mutate(base, principal, payload.createStatement, payload.createParameters);
      console.log(`seeded ${payload.label}`);
    }
  } else if (mode === "exists") {
    const [base, principal, type, id] = args;
    const found = await query(base, principal, `MATCH (b:${type} {id: $id}) RETURN GRAPH b`, { id });
    process.exit(found ? 0 : 1);
  } else if (mode === "field") {
    const [path, field] = args;
    const value = JSON.parse(readFileSync(path, "utf8"))[field];
    console.log(value === undefined || value === null ? "" : String(value));
  } else {
    console.error("usage: ccgw.mjs apply|exists|field ...");
    process.exit(2);
  }
} catch (error) {
  console.error(String(error.message ?? error));
  process.exit(1);
}
