import type postgres from "postgres";

import { resolveRequestCaller } from "../api-auth";
import { callTool, TOOLS } from "./tools";

/**
 * The revision of the Model Context Protocol this server speaks. It is
 * answered rather than negotiated: a client asking for another revision is
 * told which one it reached, and decides for itself whether to continue.
 */
export const PROTOCOL_VERSION = "2025-06-18";

const SERVER_INFO = { name: "calliopa", version: "1" } as const;

/** JSON-RPC 2.0 error codes, plus the one this transport adds. */
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;

export interface McpResponse {
  readonly status: number;
  readonly body: unknown;
}

interface RpcRequest {
  readonly id: string | number | null;
  readonly method: string;
  readonly params: Record<string, unknown>;
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

function readRpc(value: unknown): RpcRequest | null {
  const input = record(value);
  if (input === null) return null;
  const method = input["method"];
  if (typeof method !== "string") return null;
  const id = input["id"];
  return {
    id:
      typeof id === "string" || typeof id === "number" ? id : null,
    method,
    params: record(input["params"]) ?? {},
  };
}

const result = (id: string | number | null, value: unknown): McpResponse => ({
  status: 200,
  body: { jsonrpc: "2.0", id, result: value },
});

const failure = (
  id: string | number | null,
  code: number,
  message: string,
  status = 200,
): McpResponse => ({
  status,
  body: { jsonrpc: "2.0", id, error: { code, message } },
});

/**
 * The MCP tool surface over streamable HTTP.
 *
 * Refusal comes first, exactly as it does on the JSON endpoints: an
 * unauthenticated request never reaches the parser, so a malformed call from a
 * caller Calliopa does not know is refused for the reason that matters. The
 * refusal is the same uniform one [API Authentication] answers everywhere, and
 * it is an HTTP status rather than a JSON-RPC error because a client that
 * cannot authenticate has no session to carry an error inside.
 *
 * Responses are plain JSON. The streamable transport permits it for a server
 * that streams nothing, and this one answers every call in a single message,
 * so an SSE frame would be ceremony around one payload.
 */
export async function handleMcp(
  request: Request,
  sql: postgres.Sql,
): Promise<McpResponse> {
  const caller = await resolveRequestCaller(request, sql);
  if (!caller.ok) {
    return { status: 401, body: { outcome: "authenticationFailure" } };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure(null, PARSE_ERROR, "Body is not JSON.", 400);
  }

  if (Array.isArray(body)) {
    return failure(
      null,
      INVALID_REQUEST,
      "This server answers one call at a time.",
      400,
    );
  }

  const rpc = readRpc(body);
  if (rpc === null) {
    return failure(null, INVALID_REQUEST, "Not a JSON-RPC request.", 400);
  }

  switch (rpc.method) {
    case "initialize":
      return result(rpc.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });

    case "notifications/initialized":
      // A notification carries no id and takes no answer.
      return { status: 202, body: null };

    case "ping":
      return result(rpc.id, {});

    case "tools/list":
      return result(rpc.id, { tools: TOOLS });

    case "tools/call": {
      const name = rpc.params["name"];
      if (typeof name !== "string") {
        return failure(rpc.id, INVALID_REQUEST, "A call names a tool.");
      }
      const { status, body: outcome } = await callTool(
        sql,
        caller,
        name,
        rpc.params["arguments"],
      );
      // A tool that refused is a result the model must read and act on, not a
      // protocol error: the call itself succeeded in reaching the tool.
      return result(rpc.id, {
        content: [{ type: "text", text: JSON.stringify(outcome) }],
        structuredContent: outcome,
        isError: status !== 200,
      });
    }

    default:
      return failure(
        rpc.id,
        METHOD_NOT_FOUND,
        `There is no ${rpc.method} method.`,
      );
  }
}
