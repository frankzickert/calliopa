import { describe, expect, it } from "vitest";

import { askOf, fetchRecord, type Transport } from "./fetch";

/**
 * The fetch through the kernel forward (`BO_0291_017`), with the service
 * stood in for by a transport the test hands in: an identifier goes to
 * `/search`, an address to `/web`, the items come back through
 * `/export?format=csljson` as a record, a `300` comes back as candidates and
 * a selection posts them back, and a refusal comes back in the service's
 * words.
 */
const json = (status: number, body: unknown, type = "application/json"): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": type } });

const items = [{ key: "K1", itemType: "journalArticle", title: "Thermometry" }];
const csl = [{ id: "K1", type: "article-journal", title: "Thermometry", DOI: "10.1038/nature12373", issued: { "date-parts": [[2013, 8]] } }];

function transport(seen: { path: string; init: RequestInit }[], answer: (path: string, init: RequestInit) => Response): Transport {
  return async (path, init) => {
    seen.push({ path, init });
    return answer(path, init);
  };
}

describe("askOf", () => {
  it("tells an address from an identifier and strips a doi: prefix", () => {
    expect(askOf(" https://arxiv.org/abs/1706.03762 ")).toEqual({ url: "https://arxiv.org/abs/1706.03762" });
    expect(askOf("doi:10.1038/nature12373")).toEqual({ identifier: "10.1038/nature12373" });
    expect(askOf("9780262035613")).toEqual({ identifier: "9780262035613" });
  });
});

describe("fetchRecord", () => {
  it("answers a record for an identifier through /search and /export", async () => {
    const seen: { path: string; init: RequestInit }[] = [];
    const answered = await fetchRecord(
      { identifier: "10.1038/nature12373" },
      transport(seen, (path) => (path.endsWith("/search") ? json(200, items) : json(200, csl, "application/vnd.citationstyles.csl+json"))),
    );
    expect(answered).toMatchObject({
      outcome: "record",
      record: { title: "Thermometry", kind: "article-journal", DOI: "10.1038/nature12373", fetched: { by: "zotero-translation-server", from: "10.1038/nature12373" } },
      others: [],
    });
    expect(seen.map((s) => s.path)).toEqual(["/__kernel/bibliography/search", "/__kernel/bibliography/export?format=csljson"]);
    expect(seen[0]?.init.body).toBe("10.1038/nature12373");
    expect(new Headers(seen[0]?.init.headers).get("content-type")).toBe("text/plain");
    expect(JSON.parse(String(seen[1]?.init.body))).toEqual(items);
  });

  it("answers the candidates a page lists, and posts a selection back as JSON", async () => {
    const seen: { path: string; init: RequestInit }[] = [];
    const choice = { url: "https://arxiv.org/list/cs.AI/recent", session: "s1", items: { "1": "One", "2": "Two" } };
    const listed = await fetchRecord({ url: choice.url }, transport(seen, () => json(300, choice)));
    expect(listed).toEqual({ outcome: "candidates", ...choice });
    const chosen = await fetchRecord(
      { selection: { ...choice, items: { "1": "One" } } },
      transport(seen, (path) => (path.endsWith("/web") ? json(200, items) : json(200, csl))),
    );
    expect(chosen).toMatchObject({ outcome: "record", record: { title: "Thermometry" } });
    expect(seen[1]?.path).toBe("/__kernel/bibliography/web");
    expect(new Headers(seen[1]?.init.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(String(seen[1]?.init.body))).toEqual({ ...choice, items: { "1": "One" } });
  });

  it("answers a refusal in the service's words, and nothing answered as such", async () => {
    expect(await fetchRecord({ url: "http://app:8080/" }, transport([], () => json(400, { error: "refused: app is a name with no domain" })))).toEqual({
      outcome: "refused",
      detail: "refused: app is a name with no domain",
    });
    expect(await fetchRecord({ identifier: "nothing" }, transport([], () => json(200, [])))).toEqual({
      outcome: "refused",
      detail: "nothing answered a record for that",
    });
    expect(await fetchRecord({ identifier: "x" }, transport([], () => new Response("", { status: 502 })))).toEqual({
      outcome: "refused",
      detail: "the service answered 502",
    });
  });
});
