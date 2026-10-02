# BI_0001_FIX_source-check-without-a-failed-request

Status: completed

Requested: 2026-10-02, by the user, after `ui.shell`'s `CA_0077` let documents open from the
library again: opening a document that is no source should not log failed requests. It shapes
the work and authorizes no implementation.

## Transfer

Set to draft by the user on 2026-10-02 and transferred the same day into
[System](../../system/system.md), *Open Work*: `BI_0001_001` (the two routes answer a document that
is no source `200` with `noResult`) and `BI_0001_002` (the route's suite, and a browser on an
instance). The first way proposed below does not hold: the editor surface's `DocumentView`
carries no roles, so deciding from them would cost a read of its own; the second is the task.

## Progress

- 2026-10-02: both routes answer through `sourceAnswer`, with its test in `check`
  ([System](../../system/system.md)); pinned at 4021 and read on the instance by the user: no
  failed request on a document that is no source, a source's places as before.

## What Happens

- On every document opened, the source's two places ask whether that document is a source:
  `SourceProvider` (`views/source.tsx`) reads `GET /api/x/bibliography/works/<id>`, and `CitedBy`
  reads `GET /api/x/bibliography/works/<id>/cited-by`. For a document that is no source the route
  answers `unknownWork` as `400`, which the page reads as *no source* and shows nothing — correct —
  while the browser's console logs each as a failed request: two lines for every document opened.
- Seen on the instance's production pin 4004 on 2026-10-02, for the document *hello*.
- The route's other caller, the citation's file link in `documents`' `block-text.tsx`
  (`works/<id>/file`), names a work it already knows; it is not affected.

## Proposed

- Ask nothing of a document that is no source. A source is a document carrying the built-in
  *Source* role (`doc-block-roles`), so the two places decide from the roles the open document
  already holds and read the work only for one carrying *Source*. No request, no route change.
- Should the roles not reach the two places, the work route answers a document that is no source
  as an ordinary answer — `200` with the outcome `noResult` — rather than a refusal, and the two
  places read the outcome as they read it today.
- Measured at draft: which the roles allow, and that a source still shows *Fill from identifier*
  and *Cited by*.

## Verification To Shape At Draft

- Opening a document that is no source makes no request to the work route and logs nothing;
  opening a source shows both places, as before.

## Release Notes

- None: nothing an installer or a user sees changes but two console lines.
