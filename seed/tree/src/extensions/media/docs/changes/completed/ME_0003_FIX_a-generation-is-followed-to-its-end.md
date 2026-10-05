# A Generation Is Followed To Its End

Status: completed

Requested: 2026-10-05, by the user, after `ui.shell`'s `CA_0080`, which found two more
fire-and-forget follows here while fixing the run follower that brought the instance down on
2026-10-04.

## What Happens Today

- `server/make.ts` starts `void follow({...})` twice, once for a picture and once for a video,
  after the route has answered. `follow` polls `/__kernel/media/generations/<job>` every five
  seconds for up to fifteen minutes and then `land`s the result into the block.
- A poll that answers with an error status is retried. A poll that throws, because the kernel is
  restarting or the connection is reset, ends `follow` with a rejection. `land` throws the same
  way on a failed read of the file or the document.
- Since `CA_0080` the shell's server logs such a rejection and keeps serving, so the instance no
  longer goes down. The generation's process still stays *running* forever: nothing moves it, and
  the person never learns that the picture or video was not stored, or that the job can be
  collected by its id.

## The Request

- A poll that throws is treated like a poll that answered with an error: the follow keeps waiting
  through an outage for its full fifteen minutes of patience, so a kernel restart during a
  generation does not lose it, and only an outage longer than that ends in *failed* with the
  job's id. User decision, 2026-10-05.
- Whatever else ends the follow, `land` included, moves its process to *failed* with what went
  wrong and the job's id, as the other failures already do.
- Both follows start through the shell's `inBackground` (`src/server/background.ts`,
  `CA_0080_003`), so a failure is logged naming the generation and its job.
