# BO_0352_FEAT_a-reference-reads-as-its-title

Status: completed

Requested: 2026-10-06, by the user, after two commands on their instance ran nothing because the
prompt named `#1` and no mark `#1` stood any more: "when adding a reference in the text, when it
resolves, i want it replaced by its title (shortened if too long) and clickable like a keyword. but
it should look like the chip". Shaped first as `documents`' `DO_0041`, whose questions the user
answered the same day and set to draft. At transfer the binding the user chose (`DO_0041_Q2`)
turned out to need a run kind the kernel's document tools must name, so the user chose to carry it
as a `BO` change, 2026-10-06; `DO_0041` is replaced by this document. Its subject is `documents`'
editor, where its graph copy stands; the chip it looks like is `ui.shell`'s `ReferenceChips`.

## What Is Asked

- A reference written into a prompt's words, once it resolves, stops reading as `#n` and reads as
  what it points at: its title, cut short when it is long.
- It is pressable, the way a keyword's mention is.
- It looks like the chip a reference already wears on the command control: the same pill, border
  and size, not a dotted mention or a plain link.

## Where It Stands Today

- In a prompt, `#` offers the prompt's marks and the document's blocks, and choosing writes the
  text `#<number> ` at the caret (`documents`' `command-mode.md`, `BO_0267_013`, `BO_0304_016`). The
  text is plain words: the shell resolves it against the marks only when the prompt is sent
  (`danglingNumbers`, `src/lib/command-typeahead.ts`), and a `#n` naming no standing mark is
  refused in the note under the control. A `#1` left after its mark was taken back reads exactly
  like a live one until *Send*, and since numbering starts again at `#1` once nothing is marked, it
  can name a new mark it was never written for.
- Marks are device-local and per prompt (`markingKey`), recovered on another device from the
  prompt's latest run's `references`.
- In any other block, `#` writes one `blockRef` atom bound to the block's identity, drawn in the
  reading row as a link (`block-editor.md`, References From The Hash, `BO_0300`). `blockRef` is in
  the kernel's run schema (`ui-kernel.md`, References From The Hash, `agenttools/references.go`);
  the schema is closed (`additionalProperties: false`), so a run kind it does not name is one a run
  can neither read nor propose.
- On the command control a reference is a chip: `#n`, a word for what it is (*proposed*,
  *retired*), another document's title after the number cut short, a press revealing the target
  (`ui.shell`'s `commands-and-runs.md`, `BO_0263_007`, `BO_0304_013`).
- A keyword's mention is drawn over its words, dotted, with a hover card, and a press opens the
  keyword document in a tab (`keywords`' `system.md`, `BO_0301_015`).

## Where The Work Lands

- The kernel: the document tools' run schema names the new run kind, read and refused by the rules
  `blockRef` follows (`ui-kernel.md`).
- `ui.shell` (graph): the run kind in `src/lib/runs.ts`; the chip's look shared with the words; the
  send's check reading the bound references rather than the numbers in the text.
- `documents` (graph): the `#` list writing the atom, its drawing on the surface and in the reading
  row, the press, the unresolved look, and what the read answers as its title.

## Decisions

User decisions, 2026-10-06, answering `DO_0041_Q1`–`DO_0041_Q8`, `Q2` again at transfer, and
`BO_0352_Q1`–`BO_0352_Q4`.

* Only a prompt's references change: the `#n` naming one of its marks. A `blockRef` in any other
  block stays as it is, a link with the heading's words, *Figure 3*, *(2)* or *Remark 2*.
* Choosing a mark from a prompt's `#` list writes an atom bound to the reference, not the text
  `#n`: a new run kind, named in the kernel's run schema, so taking a mark back or renumbering can
  never leave the words pointing at nothing or at something else. The run is still told the
  reference by its number. Chosen over keeping the text `#n` and only drawing it, 2026-10-06.
* The chip in the words shows the title alone. The number stays in the chip's hover and accessible
  name, and on the command control's chip, so the two can be matched.
* The title follows the kind: a heading by its words; a figure, table or equation as *Figure 3*,
  *Table 1*, *(2)*; a paragraph by its label, else its opening words; a passage by its quoted words;
  another document, or a block or passage in it, by that document's title; a proposal or a retired
  block by its words, with *proposed* or *retired* beside them as on the command control's chip.
* A title longer than about 20 characters is cut at a word boundary with an ellipsis; the whole
  title stands in the hover and the accessible name.
* A press opens like a keyword's: it opens, or brings forward, the tab of the document the target
  lives in, then reveals the block or passage there — scrolled to and ringed, as the command
  control's chip reveals it. A target in the prompt's own document is revealed in the tab already
  open.
* A reference whose mark no longer stands is drawn as a chip in the stale look with the `warning`
  icon and named for having no mark under it, so it is seen before *Send* refuses it.
* The prompt being edited shows the same chip: one atom, removed with one backspace, so what is
  typed is what is read.

* The atom carries what was marked — the target (a block, a passage with its anchor, a document, a
  proposal, a retired block), its revision and its words — as a `Reference` does, so its title is
  drawn wherever the prompt is read, on any device, and the prompt's marks are recovered from its
  words as well as from its latest run. User decision, 2026-10-06 (`BO_0352_Q1`).
* The chip in the words and the mark are independent, as today: every mark goes with the command
  whether the words name it or not; deleting the chip from the words does not take the mark back;
  taking the mark back leaves the chip in the words in the warning look until it is deleted or the
  target is marked again. User decision, 2026-10-06 (`BO_0352_Q2`).
* A run reads the atom and never writes it: a document read answers it as `#n` with its title, a
  run cannot write one, and a proposed revision of the prompt keeps the atoms it holds. The command
  still tells the run the reference by its number, so this stays within `BO_0300_Q2`'s *nothing new
  reaches the run through a prompt*. User decision, 2026-10-06 (`BO_0352_Q3`).
* Prompts written before the change keep the text `#n`, checked at *Send* as today; only references
  chosen from the `#` list afterwards are atoms, and nothing rewrites a document. User decision,
  2026-10-06 (`BO_0352_Q4`).

## Transfer

- Set to draft by the user, 2026-10-06, and transferred the same day: the kernel's tasks
  `BO_0352_001`–`005` in `docs/system/ui-kernel.md`, *A Reference Reads As Its Title*; `ui.shell`'s
  `BO_0352_006`–`008` in `docs/system/workspace/commands-and-runs.md` and `documents`'
  `BO_0352_009`–`014` in `docs/system/documents/command-mode.md`, both in the graph under the same
  heading.

## Completion

- Completed 2026-10-06: the kernel's half (`BO_0352_001`–`005`) is truth in `docs/system/ui-kernel.md`,
  the graph half (`BO_0352_006`–`014`) in `ui.shell`'s `commands-and-runs.md` and `documents`'
  `command-mode.md`, accepted and pinned at 5002 and walked by the user the same day ("worked").
