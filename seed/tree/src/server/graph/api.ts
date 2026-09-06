import type postgres from "postgres";

import { resolveRequestCaller } from "../api-auth";
import type {
  AssembledGraph,
  GraphMutationResult,
  GraphOutcome,
  GraphSchema,
  StagedProposal,
} from "./contract";
import {
  parseMutationRequest,
  parseReadRequest,
  parseStageRequest,
} from "./json";
import { respond, type OutcomeResponse } from "./outcome";
import { mutateGraph } from "./mutate";
import { stageProposal } from "./proposals";
import { readGraph } from "./read";

export type GraphApiResponse<T> = OutcomeResponse<T>;

const UNPARSEABLE = {
  outcome: "validationFailure",
  failures: [
    { operation: null, rule: "requestShape", detail: "body is not JSON." },
  ],
} as const satisfies GraphOutcome<never>;

async function decode(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/**
 * Reads the graph for an authenticated caller. Refusal comes first: an
 * unauthenticated request never reaches the parser, let alone the graph.
 */
export async function handleGraphRead(
  request: Request,
  sql: postgres.Sql,
): Promise<GraphApiResponse<AssembledGraph>> {
  const caller = await resolveRequestCaller(request, sql);
  if (!caller.ok) return respond({ outcome: "authenticationFailure" });

  const body = await decode(request);
  if (body === undefined) return respond(UNPARSEABLE);

  const parsed = parseReadRequest(body);
  if (!parsed.ok) {
    return respond({ outcome: "validationFailure", failures: parsed.failures });
  }

  const group = parsed.value.proposalGroupId;
  if (group !== undefined && !(await stagedBy(sql, group, caller.clientId))) {
    // A group another client staged is answered as if it were not there. A
    // proposal is not truth and must not read as one anywhere it was not
    // asked for, which includes saying that someone else's exists.
    return respond({
      outcome: "noResult",
      detail: `No proposal group ${group} staged by this client.`,
    });
  }
  return respond(await readGraph(sql, parsed.value));
}

/** Whether this client is the one that staged the group. */
async function stagedBy(
  sql: postgres.Sql,
  groupId: string,
  clientId: string,
): Promise<boolean> {
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from graph_proposal_group
     where id = ${groupId} and staged_by->>'clientId' = ${clientId}
  `;
  return (row?.n ?? 0) > 0;
}

/**
 * Stages a proposal for an authenticated caller. Every class of caller may
 * stage; what the identity class decides is whether it may also write truth
 * directly, which the mutation endpoint answers.
 */
export async function handleGraphStage(
  request: Request,
  sql: postgres.Sql,
  schema: GraphSchema,
): Promise<GraphApiResponse<StagedProposal>> {
  const caller = await resolveRequestCaller(request, sql);
  if (!caller.ok) return respond({ outcome: "authenticationFailure" });

  const body = await decode(request);
  if (body === undefined) return respond(UNPARSEABLE);

  const parsed = parseStageRequest(body);
  if (!parsed.ok) {
    return respond({ outcome: "validationFailure", failures: parsed.failures });
  }
  return respond(
    await stageProposal(sql, schema, parsed.value, {
      kind: "apiClient",
      clientId: caller.clientId,
      identityClass: caller.identityClass,
    }),
  );
}

/**
 * Mutates the graph for an authenticated caller. The caller's client identity
 * travels into provenance, so an externally originated write says who made it.
 */
export async function handleGraphMutate(
  request: Request,
  sql: postgres.Sql,
  schema: GraphSchema,
): Promise<GraphApiResponse<GraphMutationResult>> {
  const caller = await resolveRequestCaller(request, sql);
  if (!caller.ok) return respond({ outcome: "authenticationFailure" });

  const body = await decode(request);
  if (body === undefined) return respond(UNPARSEABLE);

  const parsed = parseMutationRequest(body);
  if (!parsed.ok) {
    return respond({ outcome: "validationFailure", failures: parsed.failures });
  }
  return respond(
    await mutateGraph(sql, schema, parsed.value, {
      kind: "apiClient",
      clientId: caller.clientId,
      identityClass: caller.identityClass,
    }),
  );
}
