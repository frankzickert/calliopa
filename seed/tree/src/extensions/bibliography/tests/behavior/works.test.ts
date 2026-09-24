import { afterAll, describe, expect, it } from "vitest";

import { readGraphEnv } from "~/server/ccgw/env";

import { addWork, listWorks, readWork, retireWork, reviseWork } from "../../server/works";

/**
 * The bibliography's works over the one graph (`BO_0291_016`): a work added
 * as truth reads back with its record; a second record sharing its DOI is
 * refused by naming it; a revise compared with a stale base is a conflict
 * and with the current one lands; a retired work is gone from the
 * bibliography. Runs under the kernel harness, which holds the human seat
 * every truth write needs; a shell without the environment skips it.
 */
const configured = ((): boolean => {
  try {
    readGraphEnv();
    return true;
  } catch {
    return false;
  }
})();

/** The kernel refuses a second write of a node within 250ms
 * (`write_too_frequent`), so a revise waits past that floor. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 300));

const ok = <T>(outcome: { outcome: string } & Record<string, unknown>): T => {
  if (outcome["outcome"] !== "success") throw new Error(`expected success, got ${JSON.stringify(outcome)}`);
  return outcome["result"] as T;
};

describe.skipIf(!configured)("works of the bibliography", () => {
  const made: { workId: string; revisionId: string }[] = [];
  const doi = `10.9999/bo0291-${Date.now()}`;

  afterAll(async () => {
    for (const work of made) {
      const current = await readWork(work.workId);
      if (current.outcome === "success") await retireWork({ workId: work.workId, baseRevisionId: current.result.revisionId });
    }
  });

  it("adds a work, refuses its duplicate by name, revises it against its base and retires it", async () => {
    const added = ok<{ workId: string; revisionId: string }>(
      await addWork({ record: { title: "A work of the suite", kind: "article-journal", DOI: doi, author: [{ family: "Suite", given: "A." }] } }),
    );
    made.push(added);
    const read = ok<{ record: { title: string; DOI?: string } }>(await readWork(added.workId));
    expect(read.record).toMatchObject({ title: "A work of the suite", DOI: doi });
    expect(ok<{ workId: string }[]>(await listWorks()).some((work) => work.workId === added.workId)).toBe(true);

    const duplicate = await addWork({ record: { title: "The same work again", kind: "book", DOI: `https://doi.org/${doi.toUpperCase()}` } });
    expect(duplicate.outcome).toBe("validationFailure");
    expect(JSON.stringify(duplicate)).toContain(added.workId);

    const stale = await reviseWork({ workId: added.workId, baseRevisionId: "rev:stale", record: { title: "Renamed", kind: "article-journal", DOI: doi } });
    expect(stale.outcome).toBe("conflict");
    await settle();
    const revised = ok<{ revisionId: string }>(
      await reviseWork({ workId: added.workId, baseRevisionId: added.revisionId, record: { title: "Renamed", kind: "article-journal", DOI: doi } }),
    );
    expect(ok<{ record: { title: string; author?: unknown } }>(await readWork(added.workId)).record).toMatchObject({ title: "Renamed" });

    await settle();
    ok(await retireWork({ workId: added.workId, baseRevisionId: revised.revisionId }));
    made.length = 0;
    expect((await readWork(added.workId)).outcome).not.toBe("success");
  });
});
