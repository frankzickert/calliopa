import type postgres from "postgres";

/**
 * The database handle every graph write uses. Operations take it rather than
 * reaching for a client of their own, so nothing writes outside a transaction.
 */
export type GraphSql = postgres.TransactionSql;

/** Any handle the graph can be read through: the pool, or an open transaction. */
export type GraphReader = postgres.ISql;

export interface GraphTransaction {
  readonly sql: GraphSql;
  /**
   * The one data revision this transaction stamps on every record it writes.
   * Allocated once when the transaction opens, whatever it goes on to write.
   */
  readonly dataRevision: string;
}

/**
 * Runs one graph write. Every operation inside commits together or not at all,
 * and they share a single data revision. A throw rolls the whole transaction
 * back, including the revision allocation, so a failed write leaves no trace
 * and consumes no revision.
 */
export async function inGraphTransaction<T>(
  db: postgres.Sql,
  write: (transaction: GraphTransaction) => Promise<T>,
): Promise<T> {
  const result = await db.begin(async (sql) => {
    const [row] = await sql<{ revision: string }[]>`
      select graph_next_data_revision() as revision
    `;
    if (row === undefined) {
      throw new Error("The graph could not allocate a data revision.");
    }
    return write({ sql, dataRevision: row.revision });
  });
  return result as T;
}
