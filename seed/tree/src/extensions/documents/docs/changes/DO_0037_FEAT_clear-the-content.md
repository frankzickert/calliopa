# DO_0037_FEAT_clear-the-content

Status: draft

Requested: 2026-10-03, by the user: "from my dev instance, remove all docs and structures (except
for the builtins)", then "in fact, give me a settings functions that does that". Shaped as
`settings`' `CA_0080`; it belongs to `documents`, whose code and subject it is, and keeps its
section in Settings the way `instructions` does. Set to draft by the user, 2026-10-03.

## What Is Asked

- A function in Settings that removes every document and every structure from the instance, leaving
  the built-in structures standing (`structures`' `BUILTIN_STRUCTURES`: *Structure*, *Field*,
  *Keyword*, *Instruction*, *Format*, *Source*, *Definition*, *Alias*, *Variation*, *Input*), so an
  instance used for trying things out can be returned to an empty library without a reinstall.
- Removing a document is `documents`' `deleteDocument`: one `RETIRE` of the document node, its
  established revision archived, its blocks, revisions and relations kept in the graph as history.
  Nothing brings a deleted document back (`documents`' Deleting A Document); the function inherits
  that, so it is the one act in Settings that no undo covers.
- Extensions, their members and their change documents are not documents in this sense and are not
  touched. Neither are accounts, connections, secrets, grants or the release pin.

## What It Would Have Removed On The Dev Instance

Measured at head 4536, 2026-10-03, from a read-only export: 82 `document` nodes, 10 of them the
built-in structures by their fixed ids. The 72 others are the person's documents, instruction
documents (`record: instruction`, 8), source documents (`record: source`, 5), focused work, and the
person's structures (*Hook*, *Story*, *Paper*, *Big Message*, *Untitled role* and the like). Beside
them stand 16 `blockRole` nodes, the structure type from before structures were documents, 7 marked
`builtin`, and 213 open proposals, some of them runs whose staged documents read as *started*
documents until they are answered.

## Decisions

User decisions, 2026-10-03, answering `DO_0037_Q1`–`DO_0037_Q8`.

* The clearing deletes the person's structures: it is the one act that deletes a structure's
  document, an exception to `structures`' *A structure is retired, never deleted* (`BO_0299_Q4`),
  which that line now names. The built-ins are never deleted.
* The owner alone runs it: the section is drawn for the owner, and every other principal is refused
  `forbidden`, as *Update* is.
* An instance offers it only when it opts in; without the switch the section offers nothing else and
  the route refuses. The switch is the owner's, set in the same section and kept in the kernel's
  state record, as `settings`' lock is, never in the graph or in `.env`, so the change stays inside
  the graph.
* One confirmation guards it: a dialog naming how many documents and structures go and that nothing
  brings them back, with *Cancel* and the clearing.
* The built-ins are returned to the release's shape: fields and allowed structures a person added to
  one go with the rest.
* Open proposals that stage documents or blocks — runs and a person's branches — are rejected with
  the clearing, so an acceptance afterwards brings nothing back. Proposals of extension code are not
  touched.
* The legacy `blockRole` nodes not marked `builtin` are retired with the person's structures.
* Tabs on a removed document close in every workspace, and the owner's own remembered instruction
  choices naming one are set to none. Another person's remembered choices are left: the kernel lets
  no one write them but their person, and a run refuses an instruction that is no document.

## The Work

The tasks are enumerated in the graph docs, under *Clearing The Content*: `DO_0037_001`–`_007` in
`documents`' block document model, `DO_0037_020`–`_023` in `structures`' system document (with the
exception written into its two *retired, never deleted* lines) and `DO_0037_030` in the shell's
workspace record; `settings`' settings surface points at the section.
