import postgres from "postgres";

import {
  createClient,
  issueCredential,
  listClients,
  resumeClient,
  revokeClient,
  setClientClass,
  suspendClient,
} from "../src/server/api-clients.mjs";

/**
 * Runs inside the application container against the real database. The secret
 * printed by `issue` and `rotate` is displayed here once and never stored.
 */

const [command, ...rest] = process.argv.slice(2);
const databaseUrl = process.env.CALLIOPA_DATABASE_URL;

if (!databaseUrl) {
  process.stderr.write("CALLIOPA_DATABASE_URL is not set.\n");
  process.exit(1);
}

function expiryFrom(argv) {
  const at = argv.indexOf("--expires");
  if (at === -1) {
    return null;
  }
  const value = argv[at + 1];
  const parsed = value === undefined ? new Date(Number.NaN) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`--expires needs an ISO date, not ${value ?? "nothing"}.`);
  }
  return parsed;
}

/** A client writes truth unless the operator says it may only propose. */
function identityClassFrom(argv) {
  return argv.includes("--proposer") ? "proposer" : "writer";
}

function announce(credential) {
  const expiry =
    credential.expires_at === null
      ? "never expires"
      : `expires ${new Date(credential.expires_at).toISOString()}`;
  process.stdout.write(
    `\n  ${credential.token}\n\n` +
      `This secret is shown once and is not recoverable. It ${expiry}.\n`,
  );
}

const sql = postgres(databaseUrl, { max: 1, onnotice: () => undefined });

try {
  const [target] = rest;

  switch (command) {
    case "list": {
      const clients = await listClients(sql);
      if (clients.length === 0) {
        process.stdout.write("No clients.\n");
        break;
      }
      for (const client of clients) {
        const used =
          client.last_used_at === null
            ? "never used"
            : `last used ${new Date(client.last_used_at).toISOString()}`;
        const credential =
          client.credential_id === null
            ? "no credential"
            : `credential ${client.credential_id}, ${used}`;
        process.stdout.write(
          `${client.id}  ${client.state.padEnd(9)}  ` +
            `${client.identity_class.padEnd(8)}  ${client.name}  (${credential})\n`,
        );
      }
      break;
    }
    case "issue": {
      const client = await createClient(sql, target, {
        identityClass: identityClassFrom(rest),
      });
      const credential = await issueCredential(sql, client.id, {
        expiresAt: expiryFrom(rest),
      });
      process.stdout.write(
        `Created client ${client.id} (${client.name}), ` +
          `${client.identity_class}.\n`,
      );
      announce(credential);
      break;
    }
    case "class": {
      const client = await setClientClass(sql, target, rest[1]);
      process.stdout.write(
        `${client.name} is now a ${client.identity_class}. ` +
          `This applies to its next request.\n`,
      );
      break;
    }
    case "rotate": {
      const credential = await issueCredential(sql, target, {
        expiresAt: expiryFrom(rest),
      });
      process.stdout.write(
        `Rotated ${target}. The previous credential no longer authenticates.\n`,
      );
      announce(credential);
      break;
    }
    case "suspend": {
      const client = await suspendClient(sql, target);
      process.stdout.write(`Suspended ${client.name}.\n`);
      break;
    }
    case "resume": {
      const client = await resumeClient(sql, target);
      process.stdout.write(`Resumed ${client.name}.\n`);
      break;
    }
    case "revoke": {
      const client = await revokeClient(sql, target);
      process.stdout.write(`Revoked ${client.name}. This cannot be undone.\n`);
      break;
    }
    default:
      process.stderr.write(`Unknown command: ${command}\n`);
      process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
