# A Format Says What It Takes

Status: idea

A video is made from more than words: the vendor's model takes a start frame, an end frame and
reference images, videos or audio, in combination, and refuses words alone. Today a format says
nothing about them; `media.generate` attaches the picture above the prompt block as the start
frame, always, and a person's own pointing (*#1*) chooses nothing. This change lets the person say
in the format what it takes and how it is used, and lets the agent read the command and fill it.
Requested by the user on 2026-10-02, after `calliopa-bootstrap`'s `BO_0336` video walk was refused
for an unnamed start frame (`ME_0001`).

## What Is Asked

* The format defines, in a way a person finds intuitive, how it wants to receive images and
  possibly other inputs for a video: the person specifies in the format what is used. Requested by
  the user, 2026-10-02.
* The format itself explains to the agent how to use it. Requested by the user, 2026-10-02.
* The agent interprets the block's text, the command, and uses the format accordingly. Requested
  by the user, 2026-10-02.

## Where This Starts

- `media` (`docs/system/system.md`, *Generation Settings Live In The Format*): a format is a
  document carrying *Format*; its *Variation* blocks change provider, model, ratio and quality.
  `media.generate` takes `{block, words?}` and, for a video, attaches the nearest picture above the
  block as `start` (`BO_0273_045`).
- The media service takes `references` as `{alias, role, …}`; `role: "start"` reaches the
  adapter as its start frame and any other as a reference (`media-service.md`). The Seedance
  adapters take a start frame, an end frame and image, video and audio references at once, refuse a
  request with no attachment, and refuse one whose prompt does not name every attachment
  (`@alias`).
- A person points at blocks in a command with `#` references; the run reads what was marked.

## Proposed Shape

- **A format's inputs are blocks of the format document carrying a new built-in role *Input***,
  as its variations are: the block's words say, in the person's own terms, what the input is for
  (*the product shot the clip opens on*), and its fields say what it is — *Kind* (start frame, end
  frame, reference image, reference video, reference audio), *Name* (the alias the vendor's prompt
  uses, suggested from the kind), *Required*. A format of type video with no *Input* takes what it
  takes today: the picture above the block as its start frame. Pending `ME_0002_Q1`.
- **The format explains itself to the agent**: the format document's own words — its text blocks
  outside the inputs — and each input's words are handed to the run when it generates under the
  profile naming the format, the way a profile's words are, as instructions for using it. Pending
  `ME_0002_Q2`.
- **The agent fills the inputs from the command**: it reads the block's words and what the person
  pointed at (`#` references, the picture above), decides which picture is which input, and calls
  `media.generate` with `inputs: {<name>: <block id>}` and the words the vendor is sent, naming each
  input as the model expects (`@start`). `media.generate` checks the call against the format before
  anything is spent: each input one the format declares, of a kind the block can be (a picture for
  an image input, a video for a video input), every required one given, and every given one named in
  the words; it refuses in words otherwise. Pending `ME_0002_Q3`, `ME_0002_Q4`.
- **The same holds for an image format** where its model takes references; a format whose model
  takes none declares none. Pending `ME_0002_Q5`.

## Functional Questions

- [ ] ME_0002_Q1 How does a person declare an input? Proposed: a block in the format document
      carrying a built-in *Input* role — its words what the input is for, its fields *Kind*, *Name*
      and *Required* — so inputs are written, named and reordered as blocks are, like variations.
      Alternative: a list field on *Format* itself.
- [ ] ME_0002_Q2 What does the agent read to know how to use the format? Proposed: the format
      document's words and each input's words, handed to the run as instructions when the
      profile's format is used. Alternative: one long-text field *Instructions* on *Format*.
- [ ] ME_0002_Q3 How does the agent choose the pictures? Proposed: from the command — the blocks
      the person pointed at with `#`, and the picture above the block when the words point at
      nothing — matched to the inputs by what the format's words and the command say. Does the
      agent ask when it cannot tell, or refuse in words? Proposed: it says in its answer which
      picture it used for which input, and refuses in words, spending nothing, when a required input
      has no picture it can tell.
- [ ] ME_0002_Q4 Who writes the vendor's prompt naming the inputs? Proposed: the agent, following
      the format's words; `media.generate` refuses, before anything is spent, a call whose words do
      not name an input it attaches, rather than adding the name itself.
- [ ] ME_0002_Q5 Do image formats take inputs too, now? Proposed: the mechanism is the same, and
      an image format declares inputs only where its model takes references; none of today's image
      models is wired for them, so this change makes video work first.
- [ ] ME_0002_Q6 What becomes of `ME_0002`'s predecessor `ME_0001` (adding `@start` to the request
      when the words do not name it)? Proposed: `ME_0001` is rejected and its case is covered here —
      a format with no *Input* keeps the picture above as its start frame, and the agent names it.

## Acceptance Examples To Shape At Draft

- Given a video format with an *Input* "Opening shot" (start frame, `start`, required) whose words
  say *the clip opens on the product shot*, and a command *a slow pan over #1* pointing at a picture,
  Send makes a video starting on that picture, the vendor's prompt naming `@start`.
- Given a format with a start and an end frame, and a command pointing at two pictures, *from #1 to
  #2*, Send makes a video from the first to the second.
- Given a required input and a command pointing at nothing with no picture above, the run says
  which input is missing and spends nothing.
- Given a video format with no *Input*, Send makes a video from the picture above the block, as
  today.

## Boundaries

- Graph: `doc-block-roles` (the *Input* role and its fields), `media` (`media.generate`'s
  `inputs`, its checks, the skill, what the run is handed of the format), the kernel only if the
  format's words reach the run through it rather than through `media`'s tool (`ME_0002_Q2`).
- Release notes: *Added* — a format says which pictures and other inputs it takes and how; the
  agent fills them from the command.
