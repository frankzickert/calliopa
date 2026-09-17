# BO_0257_PERF_reads-select-what-they-serve

Status: completed

Requested: 2026-09-16, after deactivating `calliopa-refine` left the served shell unusable: the
tabs and the left panel stopped answering while the composer's agent picker still worked, and a
reload did not help. Everything that talks to the kernel had been slow before that.

A read selects the rows the request needs and nothing else, and the shell stays usable while a
read is under way. An index is the first step, not the fix: the fix is that no request reads the
whole instance to answer about one document or one extension.

## Transfer

Promoted to draft by the user on 2026-09-16 and transferred the same day: the store half is
`retrieval-gateway.md` §7.1 (`BO_0257_001`–`BO_0257_003`, and the 300 ms requirement as a fixed
line); the kernel half, the graph half's pointer and the verification are `ui-kernel.md`, Reads
Select What They Serve (`BO_0257_004`–`BO_0257_007`); `ccgw.md` §5.1's metadata-only line names
`BO_0257_002` in place of its deferral. The graph half (`BO_0257_006`) still has to be enumerated
in the `documents` and `ui.shell` docs from a checkout, and `DO_0001` written beside it.

## Progress

Completed 2026-09-16. The store and kernel halves (`BO_0257_001`–`BO_0257_005`) are
`retrieval-gateway.md` §7.1 and `ui-kernel.md`, deployed with `scripts/stack-up.sh`; the graph half
(`BO_0257_008`–`BO_0257_010` in `documents` and `ui.shell`) is served from pin 1234; the bar is met
and recorded (`BO_0257_007`). The freeze itself is `DO_0001`, whose walk on the served build is its
own.

## Transfer

Promoted to draft by the user on 2026-09-16 and transferred the same day: the store half is
`retrieval-gateway.md` §7.1 (`BO_0257_001`–`BO_0257_003`, and the 300 ms requirement as a fixed
line); the kernel half, the graph half's pointer and the verification are `ui-kernel.md`, Reads
Select What They Serve (`BO_0257_004`–`BO_0257_007`); `ccgw.md` §5.1's metadata-only line names
`BO_0257_002` in place of its deferral. The graph half (`BO_0257_006`) still has to be enumerated
in the `documents` and `ui.shell` docs from a checkout, and `DO_0001` written beside it.

## Progress

`wip` since 2026-09-16. The store and kernel halves are implemented and verified in the suites
(`BO_0257_001`–`BO_0257_005`, folded into `retrieval-gateway.md` §7.1 and `ui-kernel.md`); they
reach the instance with the next `scripts/stack-up.sh`, which runs migration `0018`. Deployed with
`scripts/stack-up.sh` on 2026-09-16. The graph half (`BO_0257_006`: `documents`' `BO_0257_008`,
`ui.shell`'s `BO_0257_009`) is staged with this document as a member of `documents`, at `wip`. Open:
its acceptance and the measured verification (`BO_0257_007`).

## Where This Starts

Measured on `calliopa-graph` at head 1158 / pin 1157 (7,820 node revisions, 13 MB of the 21 MB of
revision content is `ext.source` code), 2026-09-16.

- **Every typed read scans the table and unpacks all the code.** `retrieval.SQLStore.FindNodeRevisions`
  filters `content->>'_type' = $t or content->>'type' = $t` with no index and selects
  `nr.content` whatever the caller asked for. `EXPLAIN (ANALYZE, BUFFERS)` of the `ext.state`
  read: a sequential scan, ~102 ms, ~13,900 buffers, 0 rows matched. Every `ext.source` revision
  written makes every read slower. `MetadataOnly` does not narrow the SQL.
- **Requests fan out into many such reads, one after another.**
  - `GET /api/x/ui.shell/extensions/<id>/state`: 1.7–2.7 s, about 20 typed reads plus 59 runs of
    the recursive revision-history query. `extensionstate` reads the version history of *one*
    extension by reading `MATCH (b:ext.source)-[r:partOf]->(m:ext.manifest) ... INCLUDE HISTORY`
    for every extension's members, then filters by manifest in Go (`versions.go`).
  - `GET /api/x/documents/d/<id>/proposals`: 4.3–5.2 s. `readDocumentProposalsAgainstTruth`
    lists every `ProposalGroup` in the instance (242), keeps the 47 open ones in TypeScript, and
    for each reads its touched set and `MATCH (n) WHERE n._proposal = $g ... INCLUDE CANDIDATES`
    — two or more reads per open group whether or not the group touches the document.
  - `GET /` 1.2 s; `/__kernel/extensions` 1.7 s; the process poll every 2 s ~300–400 ms.
- **CCGW holds five database connections** (`internal/storage/postgres.go`), so the slow reads of
  one page queue behind each other.
- **A slow read freezes the shell.** The block editor's `useTask$(async …)` awaits
  `reloadChanges$` and `reloadProposals$` (up to three proposal reads) whenever the document loads
  or its save state changes. Qwik holds rendering until a `useTask$` settles, so while it waits no
  tab switches and no library entry opens; a native control such as the agent picker still
  answers. Reproduced headless: a click on the `settings` tab while `Walkthrough`'s proposal read
  ran took effect only after two proposal reads returned, about 5.5 s later. With the workspace's
  tabs reopening a document on every load, a reload lands in the same wait.

## Shape

The read work. The freeze is its own change, shipped first (user decision, 2026-09-16): the block
editor stops awaiting reads and drop writes inside `useTask$`, as `DO_0001` in the graph, a
change of `documents`. This change makes the reads fast; that one keeps the shell answering while
any read is slow.

- **CCGW reads select what the statement names** (fixed layer).
  - The type is an indexed column or expression, so a typed read touches only its type's rows.
  - Property equality, node ids, `_proposal` and relation endpoints bound in a pattern (the
    `m` of `(b)-[:partOf]->(m {id: $id})`) are pushed into SQL, not filtered after loading.
  - A metadata-only read does not select or unpack `content`.
  - History is read in one query for the nodes that need it, not one recursive query per node.
- **The kernel asks for what it serves.** `extensionstate` reads one extension's members and
  history for one extension's state; the inventory and catalog do not read code.
- **The shell asks for what it shows** (graph half, `documents`). A document's proposals are found
  from the document: the groups whose staged relations or candidates touch the document's node and
  its blocks, not every open group in the instance.
* **Each request answers in under 300 ms on this instance**, measured on the graph as it stands at
  the time: opening a document, its proposals read, an extension's state read, and the process
  poll. The change states the numbers it reached, before and after, and does not complete above
  the bar. User decision, 2026-09-16.
- The open proposal groups already standing in the instance (47 on 2026-09-16, mostly unanswered
  refinement runs) are out of scope: the read no longer depends on how many there are. User
  decision, 2026-09-16.
- Only the block editor waits on the network inside `useTask$`: the proposals reload on load and
  save (1811) and the drop task's writes (1934), both `DO_0001`'s. The publishing and extensions
  library sections start their reads from a task without awaiting them. Checked 2026-09-16 at
  pin 1157.
