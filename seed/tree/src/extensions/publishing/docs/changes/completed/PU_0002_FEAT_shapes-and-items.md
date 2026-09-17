# PU_0002_FEAT_shapes-and-items

Status: completed

Requested: 2026-09-14, after `PU_0001` (channels), `CA_0049` (their credential rows) and `PU_0007` (the index vocabulary) completed. This is the second of the sketched changes the extension's docs cite: the work layer — shapes the author defines, deliverables as their instances, items with their renditions — so there is something to assign and publish in `PU_0003`. Nothing publishes here.

## Where This Starts

- The extension holds channels and what a site declares; the concepts of shape, part, deliverable, item and rendition are documented as fixed lines in `docs/system/shapes/shapes-and-deliverables.md` with no types behind them, and its Vocabulary section says each type arrives with the change that first writes it.

- `calliopa-video`'s production model is the source this is cut from (its `docs/system/production/episodes-and-assets.md` in the graph): an asset's three independent axes — role, medium with machine facts, renditions — an asset held by several episodes or by none, the teaser chosen by name rather than by list order, a prose asset's body as a shell `document`, bytes as CCGW blobs referenced from a top-level property and permanent once referenced, machine facts read off the file at ingest (PNG and JPEG dimensions, duration and track dimensions from an ISO base media file), a format the reader does not know refused rather than stored unread, and the upload immediately before the rendition that references it. Its nine roles and its serial are one show's vocabulary and become `calliopa-show`'s shapes; the axes and the rules are general and move here.

- Type names are global while `calliopa-video`'s members stand, so this extension's names never reuse `asset`, `rendition`, `episode`, `serial`, `holds`, `exports`, `body`.

- The shell's block model has no media block; a rendition references its blob directly. `PUT /v1/blobs` is capped at 100 MiB by default (`BLOB_MAX_BYTES`), which bounds what one upload from the browser can be; a complete episode at 180 s and 8–12 Mbit/s is 180–270 MB and does not fit. How a larger file reaches the store is a fixed-layer question (below).

- The five content classes are fixed: `video`, `image`, `audio`, `prose`, `file`; a website's slots are already parsed against them.

## Intent

* **A shape is the author's**: created from the library, named, composed of parts. A part names a content class, a cardinality (exactly one, at most one, one or more, any number), a role label, and the constraints the author requires at production time — aspect, a duration limit, dimensions, formats. A shape may hold other shapes in order — a *Series* holds *Episode*s — so a deliverable of the outer shape gathers deliverables of the inner one.

* **A deliverable is an instance of a shape**, created from the library by choosing the shape, titled, and filled part by part with items. A part's cardinality and constraints are checked where an item is placed: an item that does not fit a part is refused naming the part's rule, and the item itself stays free to fit elsewhere.

* **An item is one piece of content**: its class, its machine facts (a video's duration, an image's dimensions), an optional transcript and alt text, a label, and a required synthetic-media disclosure; and either its renditions — one export each, a CCGW blob with its dimensions and how it came to exist — or, for prose, its body document in the shell's block model, written in the editor.

* **Ingest is from a file**: chosen or dropped in the browser, uploaded to CCGW immediately before the rendition that references it, its machine facts read off the bytes; a file whose facts cannot be read is refused and stores nothing. A rendition is content-addressed, so the same bytes twice are one object and a retry changes nothing.

* **An item may be gathered by several deliverables or by none.** One gathered by none is standing, listed by the library, identified by what gathers it rather than by a field.

* **Producing an item creates no obligation to publish it**, and nothing on an item says where it went.

* **The library shows the work**: a `Shapes` category, a `Deliverables` category grouped by shape, and `Standing Items`; a deliverable's tab presents its parts with the items filling them and takes uploads per part; an item's tab presents its facts and renditions; a shape's tab is the editor of its parts.

## The Shape

- The vocabulary, declared as this extension's members: `shape` (`title`), `part` (`title`, `class`, `cardinality`, `role`, `constraints`, `order`), `deliverable` (`title`), `item` (`class`, `label`, `synthetic`, `durationSeconds`, `width`, `height`, `transcript`, `alt`), `export` (`bytes` as the blob reference, `mediaType`, `size`, `width`, `height`, `provenance` ingested or produced); relations `composes` (shape to part), `nests` (shape to shape, ordered), `shaped` (deliverable to shape), `gathers` (deliverable to item, and deliverable to deliverable for a nested shape), `fills` (item to part), `exported` (item to export), `prose` (item to the shell's `document`). None is `contains`. The kernel harness fixture gains them.

- The operations, each a rooted read and one write script through the bridge, refusing in words before anything is written: shapes and parts created, revised, reordered and deleted (a part with items filling it refused); deliverables created from a shape, retitled, deleted (refused while a channel's log names it, once the log exists); an item created by ingest or, for prose, with a new document; an item placed into a part (`gathers` + `fills`, the cardinality and constraints checked), released from it, deleted (refused while anything gathers it); an export replaced by a newer one, the old kept.

- Ingest: `server/ingest.ts` reading the facts off the bytes (`server/media-facts.ts`, ported from `calliopa-video`'s: PNG, JPEG, ISO base media; widened as needed), `PUT /v1/blobs` through the shell's blob client, then the item and its export in one script; the browser's picker and drop on a deliverable's part and on the Standing Items category.

- The surfaces: `publishing:shape`, `publishing:deliverable` and `publishing:item` tab kinds with their views; three library sections with their readers and create controls; inspector facts (class, duration or dimensions, gathered by, exports) and actions (delete, release from this part).

- Verification: the pure rules — cardinality, constraints, aspect derived from dimensions, the facts readers — as unit tests over fixtures built to each format's specification; the behaviour suite over the kernel harness with the blob store for creation, placement and every refusal, ingest landing bytes as a referenced blob, the same bytes twice as one object, a replacement export superseding the first, a prose item's document, standing and gathered listings; the render harness for the sections and the views' controls.

- Out of scope: the assignment of parts onto a channel's slots, the projection, the log, publishing (`PU_0003`); the *Episode* and *Series* shapes themselves (`calliopa-show`); Bunny (`PU_0004`); an in-Calliopa production flow that makes items rather than ingesting them.

## Open Questions

- [ ] Functional question: how a part is filled — by uploading into it (the item is created and placed in one gesture), by picking an existing item (a crossover shared by two episodes), or both. Recommendation: both; an upload into a part creates and places, and a part's *Add existing* picks from items of its class.

- [ ] Functional question: where a prose item's body is written — a shell `document` created for the item and opened in the editor, listed under Documents like any other, or held out of the Documents category as the item's own. Recommendation: a shell document opened in the editor; whether Documents lists it is the shell's rule and not this extension's to bend.

- [ ] Functional question: the library's layout — one `Deliverables` category grouped by top-level shape, or one category per top-level shape (*Episodes*, *Series*), which is what `calliopa-video` had. Recommendation: one category grouped by shape; a category per shape is what `calliopa-show` may contribute for its own shapes if it wants the old look.

- [ ] Functional question: what a part's constraint does at production time — refuse an item that violates it where it is placed (recommended), or accept it and flag it until publish, where the channel's slot would refuse it anyway.

- [ ] Functional question: whether a file above the blob cap is out of scope here (a rendition that large is uploaded from a machine that holds it, by a later change with a streamed or resumable upload through the kernel — `BO_0252`'s upload half), or the cap is raised for the instance now. Recommendation: out of scope; state the cap in the tab where an upload is refused.
