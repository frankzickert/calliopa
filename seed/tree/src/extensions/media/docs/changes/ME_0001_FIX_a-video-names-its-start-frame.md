# A Video Names Its Start Frame

Status: idea

A video is made from the picture above its prompt block, attached to the job as its start frame
under the alias `start` (`BO_0273_045`). Higgsfield's Seedance adapter checks, as the OpenRouter
Seedance adapter it builds on does, that every attachment is referenced in the prompt, and refuses
the request otherwise: *every attachment must be referenced in the prompt; missing: @start*. The
block's words never name it, so every video with a start frame is refused before a job exists and
nothing is spent. The pending block then stands as a placeholder that nothing will fill. Found in
`calliopa-bootstrap`'s `BO_0336` video walk on 2026-10-02 (job
`4ca9a2e1a6b345f2b847589abca826a6`, run `arun-75251bc81af5ae0b`); no video had been walked before.

## What Is Asked

* A video made from the picture above its block is accepted by the vendor: the request names its
  start frame. Requested by the user, 2026-10-02.

## Proposed Shape

- `media.generate`, for a video with a start frame, sends the prompt beginning with `@start` when
  the words do not already name it — *@start a cat stretching, 4 seconds* — so the adapter's check
  passes and the model reads the mention as the attached picture. The block's own words are left
  as written; only the request carries the mention. `quote_generation` sends the same prompt, since
  the quote takes the same path.
- The block's `source` keeps the words as the person wrote them.
- A test in `server/tools.test.ts`: a video's request carries `@start` once, a prompt naming it
  already is sent as it is, and an image's prompt is untouched.

## Functional Questions

- [ ] ME_0001_Q1 Is the mention placed at the start of the prompt? Proposed: yes, as `@start ` before
      the words; the alternative is a sentence after them (*… Start from @start.*).

## Boundaries

- `media` alone: the request it builds. The media service and its adapters stay as they are; the
  adapter's rule is the vendor's.
- Release notes: *Fixed* — a video made from the picture above its block is no longer refused for
  not naming that picture.
