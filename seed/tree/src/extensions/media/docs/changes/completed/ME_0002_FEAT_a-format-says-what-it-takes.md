# A Format Says What It Takes

Status: completed

A video is made from more than words: the vendor's model takes a start frame, an end frame and
reference images, videos or audio, in combination, and refuses words alone. Today a format says
nothing about them; `media.generate` attaches the picture above the prompt block as the start
frame, always, and a person's own pointing (*#1*) chooses nothing. This change lets the person say
in the format what it takes and how it is used, and lets the agent read the command and fill it.
Requested by the user on 2026-10-02, after `calliopa-bootstrap`'s `BO_0336` video walk was refused
for an unnamed start frame. That case is covered here, so `ME_0001` is rejected (user decision,
2026-10-03).

## What Is Asked

* The format defines, in a way a person finds intuitive, how it wants to receive images and
  possibly other inputs for a video: the person specifies in the format what is used. Requested by
  the user, 2026-10-02.
* The format itself explains to the agent how to use it. Requested by the user, 2026-10-02.
* The agent interprets the block's text, the command, and uses the format accordingly. Requested
  by the user, 2026-10-02.

## Where This Starts

- `media` (`docs/system/system.md`, *Generation Settings Live In The Format*): a format is a
  document carrying *Format*; its blocks using *Variation* change provider, model, ratio and
  quality. `media.generate` takes `{block, words?}` and, for a video, attaches the nearest picture
  above the block as `start` (`BO_0273_045`).
- The media service takes `references` as `{alias, role, …}`; `role: "start"` reaches the
  adapter as its start frame and any other as a reference (`media-service.md`). The Seedance
  adapters take a start frame, an end frame and image, video and audio references at once, refuse a
  request with no attachment, and refuse one whose prompt does not name every attachment
  (`@alias`).
- A person points at blocks in a command with `#` references; the run reads what was marked.

## Shape

The user answered the functional questions on 2026-10-03, each as proposed.

- **A format's inputs are blocks of the format document using a new built-in structure *Input***,
  as its variations use *Variation*: the block's words say, in the person's own terms, what the
  input is for (*the product shot the clip opens on*), and its fields say what it is — *Kind*
  (start frame, end frame, reference image, reference video, reference audio), *Name* (the alias
  the vendor's prompt uses, suggested from the kind), *Required*. Inputs are written, named and
  reordered as blocks are. A list field on *Format* was considered and not chosen.
- **The format explains itself to the agent through its own words**: the format document's text
  blocks outside the inputs and variations, and each input's words, are handed to the run as
  instructions for using the format whenever it generates under an instruction naming that format.
  There is no separate *Instructions* field.
- **The agent fills the inputs from the command**: it reads the block's words and what the person
  pointed at — the blocks marked with `#`, and the picture above the block when the words point at
  nothing — and matches pictures to inputs by what the format's words and the command say. Its
  answer says which picture it used for which input. When a required input has no picture it can
  tell, it refuses in words and spends nothing; it does not ask.
- **The agent writes the vendor's prompt**, naming each input as the model expects (`@start`),
  following the format's words, and calls `media.generate` with `inputs: {<name>: <block id>}`.
  `media.generate` checks the call against the format before anything is spent — each input one the
  format declares, of a kind the block can be (a picture for an image input, a video for a video
  input), every required one given, and every given one named in the words — and refuses in words
  otherwise. It never adds a missing name itself.
- **A video format with no *Input*** takes what it takes today: the picture above the block as its
  start frame, which the agent names `@start` in the words.
- **Image formats use the same mechanism**: an image format declares inputs only where its model
  takes references. None of today's image models is wired for references, so this change delivers
  video; an image model taking references is wired by a later change.

## Acceptance Examples To Shape At Draft

- Given a video format with an *Input* "Opening shot" (start frame, `start`, required) whose words
  say *the clip opens on the product shot*, and a command *a slow pan over #1* pointing at a picture,
  Send makes a video starting on that picture, the vendor's prompt naming `@start`, and the answer
  says the picture was used as the opening shot.
- Given a format with a start and an end frame, and a command pointing at two pictures, *from #1 to
  #2*, Send makes a video from the first to the second.
- Given a required input and a command pointing at nothing with no picture above, the run says
  which input is missing and spends nothing.
- Given a call whose words do not name an input it attaches, `media.generate` refuses in words and
  spends nothing.
- Given a video format with no *Input*, Send makes a video from the picture above the block, its
  prompt naming `@start`.

## Transferred

Set to draft by the user on 2026-10-03 and transferred the same day: `structures`' *A Format Says
What It Takes* (`ME_0002_001`–`ME_0002_002`) and `media`'s (`ME_0002_010`–`ME_0002_015`). The
format's words reach the run through `media`'s own `media.read_format`, so the kernel is not
touched.

## Closed

Landed 2026-10-03 (`ME_0002_001`–`ME_0002_014`) and walked by the user on the dev instance at pin
4534 the same day (`ME_0002_015`, "worked").

## Boundaries

- Graph: `structures` (the built-in *Input* structure and its fields), `media` (`media.generate`'s
  `inputs`, its checks, `media.read_format`, the `media.pictures` skill).
- Fixed layer: none here. Every kind reaches the vendor by `calliopa-bootstrap`'s `BO_0346`, split
  out by the user and completed on 2026-10-03, before this change's code, so no kind waits.
- Release notes: *Added* — a format says which pictures and other inputs it takes and how; the
  agent fills them from the command.
