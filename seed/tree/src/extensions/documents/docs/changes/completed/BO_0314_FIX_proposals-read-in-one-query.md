# Proposals Read In One Query

Status: completed

The user reported on 2026-09-30 that the kernel responds very slowly. When an agent proposes, or when a
list is retired, the proposals appear or leave one at a time, with a pause between each. The
measurement below shows that the pauses are not the kernel's writes: an agent's proposals are
staged in one write, in about 0.25 s in production. The time goes into reading the proposals of a
document, which asks the core once for every open group in the instance. Every read, and every
request the kernel serves, shares the core's five database connections. This document shapes the
change and authorizes no implementation. The editor's half, how often it reads, is `documents`'
`DO_0024` in the graph.

## What Was Measured

Production is `calliopa`, 0.4.2; dev is `calliopa-graph`. The figures come from the CCGW request
logs over 30 minutes and from the agent run records, 2026-09-30.

- **Every open group, per document.** Production holds 126 open proposal groups. One read of a
  document's proposals (`documents`' `readDocumentProposals`) sends
  `GET /v1/proposals/<id>/touched` for all 126, at about 70 ms each. That adds up to 7–13 s of
  database time. The requests are issued all at once, but only five run at a time
  (`internal/storage/postgres.go`: `SetMaxOpenConns(5)`, `SetMaxIdleConns(2)`), so each read takes
  about 1.5–2.5 s of wall time. Retiring a list read all groups seven times in six seconds: 882
  requests, from 06:46:36 to 06:46:42. On dev one `touched` read takes 1–3 s, and an agent's
  `read_document` 3 s.
- **The account, per request.** Every request that carries a session reads its account from the
  core again (`sessions.go`, `resolve`). A gated route reads it twice, once in the prod gate
  (`proxy.go`) and once in its handler. This came to 130–220 `GET /v1/principals/<name>` a second
  while the user worked, about 176,000 in 30 minutes. Each takes about 2 ms, but they compete for
  the same five connections.
- **The same fan-out elsewhere.** The kernel reads every open group's touched set in the extension
  owner's group list (`extension_groups.go`, 10–16 s, noted 2026-09-29), in the agent tools'
  proposal reads (`agenttools/proposals.go`) and in the graph export (`graphbackup/export.go`).

## What Is Asked

- One read answers the open groups that reach a set of nodes, instead of one read per open group.
- The account check stops costing a core read on every request.
- The core's pool no longer caps a single person's work.

## Proposed Shape

- **One read, many groups.** A CCGW read takes a set of node ids and answers every open group
  whose touched set holds one of them, as a node or as the end of a staged relation. It carries
  each group's touched set, so the caller filters nothing. It is one indexed query over staged
  candidates and relations, not a loop over groups. `readDocumentProposals` asks it once, with
  the document, its blocks and the claimed blocks' relation ends, and then reads only the groups
  that come back. The kernel's group listing and the agent tools use the same read. The export
  keeps reading every group, because it needs every group.
- **One account check per request.** The gate hands the actor it resolved to the handler, so a
  request reads the account once.
- **A short-lived account answer.** The kernel keeps the core's answer about an account for up
  to 5 s, so the requests of one page share it. A suspension, retirement or class change made
  through the kernel's own routes clears the kept answer at once. Only a change made directly
  against the core can take up to 5 s to apply. This relaxes the current rule in
  `docs/system/ui-kernel.md`, Human Accounts And Sessions, "a suspended or retired account is out
  on its next request". User decision, 2026-09-30.
- **A larger pool.** Raise the core's open connections and keep the idle count equal to them, so
  that a burst does not close connections and open them again. The number is a technical choice,
  bounded by Postgres's `max_connections` minus what honcho and the backup hold.

## Acceptance Examples To Shape At Draft

- Given an instance with 126 open groups, of which 2 reach a document, reading that document's
  proposals makes one read for the reaching groups and then reads those 2 groups. It does not
  make 126 touched reads.
- Given a page load that makes 20 kernel requests with one session, the core is asked about the
  account at most once per 5 s.
- Given an agent's proposals staged in one write, the editor shows them all within one read of
  the document's proposals, in under 0.5 s on production data.
- Given an account suspended through the kernel, its next request is refused.
- Given an account suspended directly against the core, its requests are refused within 5 s.

## Boundaries And Source Documents

- Fixed layer: `docs/system/ccgw.md` (the new read), `docs/system/ui-kernel.md` (sessions; the
  extension group listing; the agent tools' proposal reads), `internal/storage/postgres.go`.
- Graph: `documents`' `readDocumentProposals` (`server/documents.ts`) and
  `docs/system/documents/proposed-changes.md`; `calliopa-refine`'s and `documents`' `proposed.ts`
  also call `touchedSet`. The graph half stands in `documents`' `docs/changes/` as this change's
  copy no later than its completion.
- Related: `DO_0024` (the editor reads the proposals once for each answer and once for each run
  event).
- Release note: *Fixed*.

## Implementation

Implemented 2026-09-30 from a cloud session, at `Status: wip`. The fixed layer is in this repository: the reaching read (`BO_0314_001`, `_003`), the pool (`_002`), the session resolved once and kept for 5 s (`_004`–`_006`), the agent tools and the extension group list on the one read (`_007`–`_009`) and the release note (`_010`). The graph half, `BO_0314_012`, and this document's copy in `documents`' `docs/changes/` were one proposal, accepted 2026-09-30 and promoted at pin 3259.

Completed 2026-09-30. The user walked the dogfood instance at pin 3259 after `scripts/stack-up.sh` (`BO_0314_011`): an agent's proposals appear together and retiring a list with proposals no longer steps through them. The core's log over the half hour after the promotion shows the reaching read instead of touched-set reads (none outside the graph export), and 48 account reads, never more than two within 5 s.
