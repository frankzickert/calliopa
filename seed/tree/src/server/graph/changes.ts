import type {
  ChangeSummary,
  ChangeSummaryOutcome,
  ChangeSummaryRequest,
} from "./contract";
import { graphScopeId } from "./nodes";
import { describe, validationOutcome } from "./outcome";
import type { GraphReader } from "./transaction";
import { validateChangeSummaryRequest } from "./validation";

interface SummaryRow {
  readonly changes: string;
  readonly last_written_at: Date | null;
}

/**
 * How often a named set of logical identities has been written, and when last.
 *
 * A change is one data revision that wrote at least one of the named
 * identities. A data revision is one transaction, so a mutation touching
 * several of them counts once: that is what makes a split, which writes two
 * blocks together, the one change it was.
 *
 * A change is counted where content became truth: a node revision by the stamp
 * of its establishment, a relation by its own creation. A revision written
 * directly is established as it is written, so the two are the same stamp for
 * it; a revision that was staged counts when its item was accepted, and one
 * still staged or rejected counts nowhere, because staging changes nothing a
 * reader can see. Archiving a revision and closing a validity move no stamp
 * and carry no time of their own, so they are not counted here on their own
 * account. Every operation that closes a
 * validity also creates a record in the same mutation — retiring creates the
 * `retired` relation, restoring creates the containment, superseding creates
 * the incoming revision — so those changes are counted through what they
 * wrote. The one change that archives alone is deleting a document, and a
 * deleted document is not read back.
 *
 * The time reported is the one carried by the highest data revision, not the
 * latest timestamp. A record takes `now()`, which is its transaction's start
 * time, while its data revision is allocated under a lock in commit order, so
 * a transaction that began earlier and committed later carries both a higher
 * revision and an earlier time. The revision is what orders changes, so the
 * revision is what selects the time.
 *
 * The count and the time are all this answers. It returns no revision
 * identity, so it cannot be walked into a history surface.
 */
export async function readChangeSummary(
  sql: GraphReader,
  request: ChangeSummaryRequest,
): Promise<ChangeSummaryOutcome> {
  const invalid = validationOutcome<ChangeSummary>(
    validateChangeSummaryRequest(request),
  );
  if (invalid !== null) return invalid;

  const nodeIds = request.nodeIds ?? [];
  const relationIds = request.relationIds ?? [];

  try {
    const scopeId = await graphScopeId(sql);
    // Every record a transaction writes takes `now()`, which is the
    // transaction's own timestamp, so the rows sharing a data revision share
    // one time and the aggregate below picks a value rather than a winner.
    const [row] = await sql<SummaryRow[]>`
      with written as (
        select revision.established_data_revision as data_revision,
               revision.established_at as written_at
        from graph_node_revision revision
        where revision.scope_id = ${scopeId}
          and revision.node_id = any(${sql.array([...nodeIds])}::uuid[])
          and revision.established_data_revision is not null
        union
        select relation.data_revision, relation.created_at
        from graph_relation relation
        where relation.scope_id = ${scopeId}
          and relation.id = any(${sql.array([...relationIds])}::uuid[])
      ),
      changes as (
        select data_revision, min(written_at) as written_at
        from written
        group by data_revision
      )
      select count(*)::text as changes,
             (
               select written_at from changes
               order by data_revision desc
               limit 1
             ) as last_written_at
      from changes
    `;

    const changeCount = row === undefined ? 0 : Number(row.changes);
    const lastWrittenAt = row?.last_written_at ?? null;
    return {
      outcome: "success",
      result: {
        changeCount,
        lastWrittenAt: lastWrittenAt === null ? null : lastWrittenAt.toISOString(),
      },
    };
  } catch (error) {
    return { outcome: "storageError", detail: describe(error) };
  }
}
