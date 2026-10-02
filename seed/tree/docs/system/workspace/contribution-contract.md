# Contribution Contract

## Purpose

- The contract an extension present in the tree contributes to the shell through, resolved at build time and never at runtime: library sections, tab kinds with the views presenting them, route-loader readers, an API handler table, and settings parties. `ui.shell` and `settings` contribute through it too, so nothing keeps a privileged path into the shell (`BO_0202`, decided 2026-09-06 and 2026-09-07).

## Fixed

- Contributions are code. A manifest's `entrypoint` names a module beside it, and that module exports the extension's contributions as typed values against `src/contract.ts`; the manifest stays data. Vocabulary is not a contribution: it is the extension's declared `ext.blocktype` and `ext.relationtype` members in the graph, enforced by CCGW's Validation (`BO_0207`).
- Resolution is the build's. The registry plugin scans `src/extensions/*/manifest.json` when Vite's config resolves, reads each manifest's `entrypoint`, and emits `src/registry.gen.ts` and `src/registry.server.gen.ts` — `*.gen.*` modules the kernel never commits — importing every present entrypoint. An extension absent from the tree is absent from the registry, and the build is otherwise the same build. Nothing is loaded at runtime: no dynamic import, no graph-source materialization, no enable/disable flow, no dependency resolution in the running application. Activation (`BO_0218`) and the version flip (`BO_0219`) do not bend this: an inactive extension is absent from the tree the kernel materializes for the pin, a pinned one is projected at its own revision, and the toggle at the top of the extension view is a promotion the kernel runs through its gate — the build changes, never the running application.
- Creating an extension, exporting one and importing one (`BO_0224`) do not bend it either: each is a kernel operation the shell asks for as the signed-in human — a create is truth in one statement (a manifest and a `system.md`, nothing to build), an export is the kernel's archive of an extension's subtree, members and change documents, and an import is a proposal the kernel stages from the archive and establishes on its own confirmation page, arriving switched off; the build changes only when the person switches it on or serves head through the gate. The extension view's control row carries *Export* beside the version selector — the version the selector shows, pinned or newest — and the inspector the same as its one action (`BO_0224_008`, `BO_0224_010`).
- The entrypoint has two halves. `contributions.ts` exports what the browser needs; `contributions.server.ts` exports what only the server may hold. Only server code imports the server registry, so a secret-bearing client cannot reach the client bundle through it.
- Names are qualified by the extension. A tab kind is `<ext>:<kind>`, a section key `<ext>:<section>`, an API path `/api/x/<ext>/…`; the frame's own kinds — the story-development placeholders and `process-result` — stay bare. View ids and party ids are global, and two extensions contributing the same one fail the build by name.

## Shape

- `src/contract.ts` declares the shape. The client half (`ClientContributions`) carries `sections` — each a name, a title, the empty-body line, optionally the bare kind its rows open, an optional create control (`createLabel` and a `create$` QRL answering what to open) and optionally a component, in which case the component is the body — `kinds`, a record from bare kind to the `ViewContribution` it opens with (id, name, further bare `targetKinds`, inspector line, drag operations, component), and `views` for a kind that offers several. The server half (`ServerContributions`) carries `readers` by section name (an item section's reader answers `LibraryItem[]` — id, label, optional badge, optional open target with a bare kind; a component section's reader answers what its component takes), `routes` (method, path with `[name]` and `[...rest]` segments, and a handler over the request event), and `parties` (id, kind `service` or `channel`, how the credential works, label, purpose, configuration fields with their checks, and the probe the kernel runs). `BO_0202_001` `BO_0202_002`
* An extension contributes a default library icon (`ClientContributions.icon`); each section uses it unless `LibrarySection.icon` gives that section a standalone icon. Both carry a title and a Phosphor name from the shell's icon table (`LibraryIcon` in `src/contract.ts`). The registry refuses a section with neither icon (`section_icon_missing`), an unknown icon name (`icon_unknown`) or conflicting icon definitions sharing an id (`library_icon_collision`). `REGISTRY.libraryIcons` groups default sections under the extension id and keys a standalone section icon by its qualified section key, in contribution order; the icon column draws these entries ([Layout](./layout.md#panels-as-activity-bars)). A standalone icon carries only its section. `ui.shell`'s Extensions section remains under *Extensions*, Phosphor `puzzle-piece`; Admonition patterns has its own *Admonition patterns* entry with Phosphor `info` (`CA_0070_004`).
- The view bridge a contributed view is handed carries the workspace it is mounted in (`workspaceId`, read-only, `CA_0050_001`) beside the inspector and the save state; and the shell's process registry is a surface a contributed route may produce into through `createProcess` and `moveProcess` in `src/server/processes.ts`, its affected item a kind the registry knows qualified by the extension, shown on the three surfaces with no further contract ([Processes](./processes.md), `CA_0050_002`, `CA_0050_003`).
- An extension that declares another extension as a dependency may import that extension's server modules directly — `manuscripts` reads `doc-block-roles`' `rolesOf` and `documents`' `readDocument` — one process, no HTTP hop; the dependency is what allows the import, and the registry's `dependency_missing` refusal is what keeps a tree honest about it. User decision, 2026-09-15 (`CS_0001_005`).
- `src/server/kernel/client.ts`: `kernelSecrets.request` takes `headers` (forwarded by the broker, the kernel's own refused) and `blob` with an optional `range` — a body the kernel streams from CCGW — and answers `location` and `range` beside the status and text; `kernelSecrets.signIn(party)` starts the kernel's device flow and answers the code and URL; `PartyView` carries an oauth party's `provider`, `flow` and `paths`, and a `PartyDescriptor` may declare `credential: "oauth"` with its `provider`, its `paths` and a `fixed` configuration the kind writes rather than the reader types. `tests/behavior/kernel-surfaces.test.ts` proves the client half over the kernel harness against a stub provider and a stub destination: the sign-in, the flow verifying, the token never answered, the headers and `Location` and `Range` through, a blob slice with its length, a path outside the prefixes refused (`BO_0252_006`, the shell half of `BO_0252` in `calliopa-bootstrap`).
- The parties are the ones the build contributes: no extension answers a party roster at runtime
  (`calliopa-bootstrap`'s `BO_0312_061`, below), so `parties()`, `partyOf()` and `isChannelParty()`
  in `src/server/registry.ts` answer the static descriptors, async still so their callers do not
  change with where a party comes from.
- Two slots arrived with `BO_0264`. A route an extension marks `kernelCallback` — a trigger, a context, a tool the kernel calls — is answered only when the request carries the secret the kernel generated at its start and handed this process as `CALLIOPA_KERNEL_CALLBACK_SECRET`, in `X-Calliopa-Kernel-Callback`; `dispatch` refuses anything else `403`, and the kernel strips the header from every browser request it forwards (`src/server/kernel-callback.ts`, `BO_0264_002`). `settingsSections` on the client half — a name, a title and a component — are drawn below the settings tab's own sections while their extension is active, keyed `<ext>:<name>` and refused twice as `settings_section_collision` (`BO_0264_016`); one marked `owner: true` is drawn for the owner alone, heading and all, which `profiles`' *Profile tools* is (`BO_0311_040`). Reads at an earlier data revision run inside `atDataRevision` (`src/server/ccgw/branch-scope.ts`), which the CCGW client honours for every read that names none, against truth.
- `src/registry.ts` is the merge: `buildRegistry(host, entries)` qualifies sections and kinds, gives a kind's default view that kind and a further view the kinds it names, and refuses by name a section key contributed twice (`section_collision`), a kind contributed twice (`kind_collision`), a view id from two extensions (`view_collision`) and a view presenting a kind nothing contributes (`target_kind_unknown`); `buildServerRegistry(entries)` keys readers by section and tables by extension, and refuses a table naming one method and path twice (`route_collision`), a rest segment that is not last (`route_shape`) and a party from two extensions (`party_collision`). `matchRoute` walks a table in the order the extension listed it. The merge runs where the generated module is evaluated — the server at startup, the unit project, the promotion gate's serve probe — so a collision is refused before a pin serves it. `BO_0202_001` `BO_0202_004`
- `scripts/registry.mjs` is the scan, plain JavaScript so node runs it without a build: `scanExtensions` reads every directory under `src/extensions/` in name order and fails by name a directory without a manifest (`manifest_missing`), a manifest that is not JSON (`manifest_unreadable`), an id not matching its directory (`id_mismatch`), an entrypoint that names no module or is not a module name beside the manifest (`entrypoint_missing`, `entrypoint_shape`), a half that does not export `contributions` (`entrypoint_shape`), a declared dependency the tree does not hold (`dependency_missing`) and a declared range the version present does not satisfy (`dependency_out_of_range`, `BO_0219_007` — the grammar `satisfies` reads is the kernel's: comparator sets joined by `||`, `^`, `~`, the six comparators, bare and partial versions, `*`); `emitClient` and `emitServer` write the two modules; `writeRegistry` touches a file only when its text changed. `scripts/registry-plugin.mjs` runs it at `configResolved` and again in watch mode when a manifest or an entrypoint changes; `scripts/gen-registry.mjs` is `pnpm gen`, which `prebuild`, `pretypecheck`, `precheck` and `pretest:*` run, so a fresh checkout typechecks before Vite starts. Both are unit-tested over fixture trees (`src/registry-scan.test.ts`, `src/registry.test.ts`), including every named error. `BO_0202_001` `BO_0202_011`
- The host's own contributions are `src/components/shell/host-contributions.tsx`, merged first with bare names: the `context` placeholder for every host kind and the `outline` placeholder for the structural ones. `context` presents anything, which is what makes view resolution total: a tab whose kind nothing contributes any more — an extension that left the tree — opens there and says so, rather than being refused with the workspace. `BO_0202_004`
- The frame is `src/` root source and not a contribution: the workspace, tabs, drawers, the process registry, the CCGW and kernel clients, and the host's own endpoints — `/api/workspaces/**`, `/api/processes/**`, `/api/runs/**`, `/api/library/<ext>/<section>` (one section re-read through its contributed reader) and `/health`. `BO_0202_005` `BO_0202_006`

- A citation resolver is a server contribution (`BO_0291_030`, landed 2026-09-24, under `calliopa-bootstrap`'s `BO_0291`): `ServerContributions.citations?: (request: CitationRequest) => Promise<CitationAnswer>`, handed the document, its cited works in their numbered order and each citation's work and locator, and answering an in-text label per citation keyed by `citationKey` of `~/lib/runs`, and — as `CitationStyles` — the style applied, the instance's default and the styles a document may choose, by id and name (`BO_0291_037`). `buildServerRegistry` keeps at most one, refusing a second by name (`citation_resolver_collision`), and `resolveCitations` of `~/server/registry` asks it — `null` when none is offered. `documents`' read asks it for a document that cites anything, so the labels arrive with the document as `citationLabels` and nothing re-flows once it is drawn; with no resolver, or one that answers nothing, the bare number is the label (`documents`' `BO_0291_025`). The `bibliography` extension is its first and only provider (`BO_0291_020`). Proven in `src/registry.test.ts`.
- A document place (`BO_0291_031`, landed 2026-09-23, under `calliopa-bootstrap`'s `BO_0291`): `DocumentPlace` = `end` in `src/contract.ts`, and `Decorations.documentPlaces`, a component per place handed `DocumentPlaceProps` — the document's identity and the data revision it was read at, so a place that reads for itself reads again when the document changes. An extension contributes it beside its block places without being the kind's provider, and places from several extensions are drawn in extension order, as block places are. `documents` draws `end` once after a document's last block (`views/decorations.tsx`, `DocumentDecorations`) and knows nothing of what fills it; the bibliography's reference list is its first (`documents`' `BO_0291_027`).
- A section may open another extension's kind (`BO_0298_014`, found in the walk 2026-09-25):
  `LibrarySection.opens`, a qualified kind such as `documents:document`, in place of the bare
  `kind` a section's own extension contributes — one of the two, never both
  (`section_opens`) — and refused by name when nothing contributes it (`target_kind_unknown`),
  while a bare `kind` stays as it always was. The shell re-reads such a section when a tab of
  that kind is renamed or goes, as it re-reads that kind's own sections; before it, a Profiles
  row kept a profile's old title until the next reload. `profiles` is the first to use it.

## Consumers

- The library renders `REGISTRY.sections` in contribution order: each section's header with its toggle keyed `<ext>:<section>` in the layout and its create control when contributed, and a body that is the uniform row — label, badge, the current marker, opening the row's target in the view remembered for it — or the contributed component mounted with the reader's answer. The shell's listeners capture the section's key, never the section: a contribution carries a QRL and a component, and the shell reaches both through the registry module rather than serializing them into a listener. After a create, a rename or a target gone, the sections whose rows open that kind are re-read through `/api/library/…` ([Tabs](./tabs.md), `BO_0202_003`, `BO_0202_005`).
- The Extensions section declares no tab kind: its rows open the extension view by member path rather than the editor, so nothing about extension administration depends on a `document` kind being contributed at all — which is what lets the document surface leave `ui.shell` without the shell declaring a dependency on it. `BO_0254_012`
- Under `BO_0255`, promoted to draft by the user on 2026-09-16 and transferred here the same day, the block document model, the block editor and the Documents section leave `ui.shell` for `documents`, a `bundled` extension of its own — the second part of `BO_0253` in `calliopa-bootstrap`. The decision surfaces travel inside it and leave again in `BO_0256`. The repository's half is `extension-model.md` `BO_0255_001`–`BO_0255_002`, `ui-kernel.md` `BO_0255_003`, `distribution.md` `BO_0255_004` and `ui-shell.md` `BO_0255_005`. The move preserves behaviour: every acceptance expectation the document surface already meets stays true, in the same words, under the extension that now owns it.
- `ui.shell` contributes the Extensions section alone (`BO_0255_006`): the Documents section, the `document` kind and the block editor are `documents`', and its table is `/api/x/documents/`, where the route names are the extension's own — a document is `d/[id]`. The tab kind is `documents:document` and the section key `documents:documents`; `LEGACY_TAB_KINDS` rewrites the `ui.shell:document` a workspace remembers, as it rewrote the bare kinds `BO_0202_004` qualified, so a remembered document tab opens rather than falling to the `context` placeholder.
- The source moved to `src/extensions/documents/` (`BO_0255_007`): `views/` — the block editor and its reading surfaces, `marking/`, `passages/`, `proposals/` and `standing/` — `server/`, and the `lib/` modules that are document work: `pointing`, `proposals`, `references`, `disposition`, `branch` and `swipe`. Three things stayed, each because its consumers put it there:
  - `order`, `runs` and `library` are primitives other extensions read too, so they stay in `src/lib/` and no extension needs a dependency for them.
  - `passage` stays because `src/lib/command-target.ts` validates a stored passage reference with its `quotable`, and `pointing`'s `chipName` and `fixatedChipName` moved beside it, where `PointedReference` and `FixatedBlock` are already declared — so `reference-chips.tsx` keeps its place and no chip is contributed as a component.
  - `bareId`, `contentOf`, `nodeRef`, `typeOf` and `asRecord` left `server/documents/` for `src/server/ccgw/nodes.ts`: reading a CCGW node is not a document's question, and other extensions read nodes of their own kinds with them.
- The contract grew one reader, `proposedTargets`, for what the frame could no longer read itself (`BO_0255_007`): the run detail names what a run staged, and what a proposal group touched is the extension's to say. An extension answers, for one group, the items it proposed into with their bare kinds; `src/server/agent/proposed.ts` keeps the run-to-group step and merges the answers in extension order with each kind qualified, an extension that throws contributing nothing. `src/server/registry.ts`'s `labelOf` is the same posture for one name: the frame asks the sections that list a kind what an item is called, so a process names the document it worked on and falls back to the identity when nothing lists it.
- The tests moved with the code (`BO_0255_008`): the unit tests beside their modules, and the eight behaviour suites that exercise documents — `documents`, `work`, `focus`, `phase`, `pressure`, `derived`, `relations-provenance`, `branch` — to `src/extensions/documents/tests/behavior/`. `extensions`, `kernel-surfaces` and `theme-tokens` stay the frame's. The kernel harness runs the whole behaviour project, so it reaches them where they now are: 22 files, 106 tests.
- A component body that starts with `.library-section-actions` has those controls drawn on its section header's line, at the right, as a VS Code view's title actions are. They are sticky in the body and pulled up by the header's height, so they take no row of their own, follow the sticky header, and go with the body when the section collapses. The contract's shape stays as it is: the rule is the shell's stylesheet, and a section that wants controls on its line renders them first in its body. The Extensions section is the one that does ([Layout](./layout.md#the-library-as-a-side-bar), `CA_0044_006`).
- The page loaders call `readLibrary()`, every contributed reader by section key, and a reader that throws renders its section empty — `[]` for an item section, `null` for a component's — the way a refused listing did: the library is one region of a shell that still works without it. `BO_0202_005`
- One catch-all, `src/routes/api/x/[ext]/[...path]`, dispatches by extension id into the contributed table and answers 404 in words for an extension that contributes no API and for a path the table does not name. `ui.shell`'s table serves documents, episodes, standing assets, fronts and extensions under `/api/x/ui.shell/`, the settings extension's connections and agent sign-in under `/api/x/settings/`; the route files those replaced are gone. `BO_0202_006`
- Tab kinds and views: `parseTab` accepts any qualified kind and rewrites a bare one stored before `BO_0202` (`LEGACY_TAB_KINDS` in `src/lib/tabs.ts`); `parseProcessInput` validates an item kind against the registry after the same rewrite. The settings control in the header appears only while the build holds the `settings:settings` kind, so a tree without the settings extension offers no settings tab. `BO_0202_004`
- Parties: `listConnections` reads the registry's roster and lays each descriptor's label, purpose, channel-ness and fields on the record, so the settings view holds no table of its own; `isChannelParty` in `src/server/registry.ts` is what `calliopa-video` consults; `configurationRefusal` takes the descriptor. `ui.shell` contributes `homepage` and `bunny` as channels with their probes, the settings extension `honcho`, `hermes`, `codex` and `claude-code` ([Connections](../../../src/extensions/settings/docs/system/connections.md), `BO_0202_008`).
- Vocabulary is declared, not contributed. What the registry validates for it is the dependency rule: a member relation that targets another extension's type is a dependency the manifest declares, and `dependency_missing` refuses a tree where the dependency is absent, so an extension whose vocabulary leans on the shell's cannot be present without it. `BO_0202_007`

## Not Here

- Runtime loading of extension code, in any form: the contract resolves at build time, the pin promotes a build, and `BO_0200`'s fixed constraint stands. Switching an extension off or serving it at an older version (`BO_0218`, `BO_0219`) is the kernel materializing a different tree and promoting it, not the application loading or unloading anything.
- A review of code in the shell. A person does not read code to judge a change: what the shell shows of a staged group is the kernel's evidence — the change document, the counts, the runs' accounts, the gate results and the candidate they can try — and never a diff (`BO_0282`, user decision 2026-09-23). An import's diff is the kernel's summary and its acceptance is the kernel's confirmation page, the way every group holding an extension member is established but the release's update, which the owner's press in the Update tab accepts (`BO_0241`); the shell never shows a staged diff of code and never accepts one itself (`BO_0224_008`).

## A Control In The Command Chip

- Under `calliopa-bootstrap`'s `BO_0273`, an extension may put a control in the command chip of the
  block being edited. The change is image and video creation in a document
  ([Media Service](../../../../../../docs/system/media-service.md) in `calliopa-bootstrap`); this
  is the slot it needed, and the slot names no extension.
- It is one more `BlockPlace`, not a contract of its own (`BO_0273_007`). `decorations` already
  lets an extension draw components on another extension's blocks — `headline`, `below` —
  each handed `{documentId, blockId, revisionId, active}` and mounted inside the contributed
  provider, in extension order. `command` joins them: drawn in the command chip, where `active`
  already means the block being edited. So the merge, the ordering, the provider and the props are
  the ones that were there; the contract grew one value of one union and nothing else. An
  extension contributing no `command` place draws nothing, and an inactive extension contributes
  none, as with every decoration.
- What draws it is `documents`'
  ([Command Mode](../../../src/extensions/documents/docs/system/documents/command-mode.md#a-contributed-control-in-the-chip)).

## A Chip Beside The Command Chip

- Under the `doc-block-roles` change `RO_0002` (set to draft by the user on 2026-10-01): the roles
  of the block being edited stand in a chip of their own beside the command chip
  ([Roles](../../../src/extensions/doc-block-roles/docs/system/system.md#the-roles-chip)). The chip
  names no extension, as the `command` place does not.
- `underCommand` is one more `BlockPlace` (`RO_0002_001`, landed 2026-10-01; `src/contract.ts`):
  drawn in a chip of its own in the command chip's row, wherever the command chip is drawn —
  the block being edited and the prompt pointed from — handed the same `{documentId, blockId,
  revisionId, active}` the `command` place is, inside the contributed provider, in extension
  order. An extension contributing none draws nothing, and the chip is not drawn when no active
  extension contributes the place. What draws it is `documents`'
  ([Command Mode](../../../src/extensions/documents/docs/system/documents/command-mode.md#a-chip-beside-the-command-chip)).

## The Run Place And Nested Providers

- `run` is one more `BlockPlace` (`BO_0289_019`): drawn by `documents` beneath a code block's
  source while reading, handed `{documentId, blockId, revisionId, active}` like every place, so
  the extension that runs code offers its send there without the editor knowing what a runtime
  is. An extension contributing no `run` place draws nothing there.
- Several extensions may provide for one kind. The registry keeps every provider it is handed,
  in extension order, and the presenting view nests them — `documents`' `DecorationProvider`
  composes them from the inside out around the projected blocks — where it had refused a second
  by name (`decoration_provider_collision`, gone). The decoration bar is one store per shell, so a
  provider writing a group to it replaces its own group alone and keeps the others', as `code`'s
  *Code* does.

## A Control In The View Bar

- An extension may put a control in the bar at the top of a document tab, and the slot names no
  extension (`BO_0298_030`): a decoration provider of the `document` kind writes its own group
  into the decoration bar (`BO_0274_004`), the bar draws it after the view's groups, and its
  actions — a `choice` is a dropdown, a `toggle` and a `button` what they say — are drawn by the
  shell. `code`'s *Code*, `manuscripts`' *Manuscript* and, on a
  profile's document for the owner alone, `profiles`' *Profile tools* stand there
  ([Profiles](../../../src/extensions/profiles/docs/system/system.md)).

## A Place Under The Title

- A document's own roles are assigned from the document's header, under its title
  (`calliopa-bootstrap`'s `BO_0309`, with `BO_0318` folded in; always drawn since `documents`'
  `DO_0030`). The title is the view's headline, not a block, so it has no command control and no
  `command` place to draw into.
- `title` is a document place (`BO_0309_030`, landed 2026-09-30; `DocumentPlace` in
  `src/contract.ts`, beside `end`): the document header's lines under its title, drawn by the
  active view for the document, handed `DocumentPlaceProps`, while reading and editing alike. They
  carry nothing of a command's own — no agent, pointing, attachments or *Send* — and nothing is
  drawn when no provider contributes. `documents`' view draws it (`BO_0309_031`); `doc-block-roles`
  contributes the roles and values lines, `keywords` the mentions line. The title stands outside
  the document's decoration provider, so a contribution there reads for itself.
- The header's rows and forms (`DO_0030_001`, landed 2026-10-01, under `documents`' `DO_0030`,
  [Block Editor View](../../../src/extensions/documents/docs/system/documents/block-editor.md#the-document-header)):
  each `title` contribution is drawn as a row of its own (`.document-title-place__row`,
  `data-title-place-row` naming the extension), in extension order as every document place is, so
  `doc-block-roles`' rows stand before `keywords`'; a row whose contribution draws nothing takes no
  room. `DocumentPlaceProps.form` (`DocumentPlaceForm`) says where it is drawn: `full` in the
  header, `compact` in the one line that stays under the bar once the header has scrolled away,
  where a contribution draws only what that line holds or nothing, and with no row wrapper. Absent
  is `full`; `end` is always drawn full. Proven by `documents`' `views/document-header.test.ts`
  (the rows in extension order, none in the compact line) and `keywords`' contribution test.

## Options On A Command

- Under `calliopa-bootstrap`'s `BO_0311` (transferred 2026-09-30): the profile is chosen per
  command in the chip, so a control a `command` place draws must be able to say something about
  the command it sits in.
- A `command` place receives `setOption$(name, value)` for the command it is drawn in
  (`BO_0311_030`): `BlockDecorationProps.setOption$` in `src/contract.ts`, handed by `documents`'
  command control to its `command` place alone, `null` clearing an option. The shell keeps the
  options with the command — `ViewBridge.commandOptions`, by `commandKey(itemId, blockId)`, set
  through `setCommandOption$` — the editor puts them on the `ViewCommand` it sends
  (`ViewCommand.options`), and the shell sends them as `commandOptions` in the run request when
  *Send* is pressed. An option no one set is not sent. They live as long as the command does in
  the page, and remembering one across commands is the contributing extension's. `profile` is the
  first the kernel reads: the runs route (`src/routes/api/workspaces/[id]/runs`) takes it from
  `commandOptions`, refuses one that is no record id in words, and hands it through
  `conductRun` and `startBridgeRun` as the intake's `profile` (`calliopa-bootstrap`'s
  `ui-kernel.md` `BO_0311_002`). A gesture carries none.
- Proven in `documents`' `command-decorations.test.ts`: a `command` place setting one option and
  clearing another, and *Send* carrying what was set and nothing cleared; and a command nothing
  set one on sending none.

## Senders And Rosters After Publishing

- `publishing`, the only `partyRoster`, is removed (`calliopa-bootstrap`'s `BO_0312_061`, the
  roster half, landed 2026-10-01): `ServerContributions.partyRoster`, the registry's `rosters` and
  `RegisteredRoster`, and `mergeRoster` are gone with it, and the settings extension lists the
  contributed parties alone (`settings`' `BO_0312_060`). `calliopa-video` never called the roster;
  it reads `isChannelParty`, which stays. `src/registry.test.ts` no longer proves a merge.
- The senders half (`BO_0312_061`, landed 2026-10-01 with `media`'s `BO_0312_040`): no extension
  offers a sender, so `ServerContributions.senders`, `send` and `quote` and their types, the
  registry's `senders` and `sender_unanswered`, `senders()`, `sendToSender` and `quoteSender`, the
  runs route's sender branch and `POST /api/workspaces/:id/runs/quote` are gone, and the agent menu
  lists the agents alone: `SelectableRuntime` lost `icon` and `options`, the chip its axis controls,
  the bridge `chooseOption$`, `quoteSend$` and `agents.options` and `agents.cost`, and *Send* its
  quoted cost. A picture or a video is made by the agent's tool under a profile
  (`BO_0308_Q10`). Proven in `agent-menu.test.ts`, the menu drawing no control beside the agents.
