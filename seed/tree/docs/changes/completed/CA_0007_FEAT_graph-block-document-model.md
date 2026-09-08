# CA_0007_FEAT_graph-block-document-model

Status: completed
Requested: 2026-08-29

## Intent

Define the first application-owned domain model over the graph: durable
documents composed from ordered, independently addressable blocks. The model is
inspired by the graph artifact vocabulary in
`/home/calliopa/projects/_calliopa-old/calliopa-bootstrap`, but it belongs to
Calliopa itself and evolves through repository changes rather than extensions.

This change owns stored meaning and graph operations. The editor view is a
separate change so the data contract can be verified without coupling it to one
rendering implementation.

## Proposed Model

- The first and only product-level document kind is a generic document: a
  graph node with a title and ordered blocks, carrying no story-specific
  meaning. Story, scene, and every other story-development concept arrives
  through its own later change, either as an additional document kind or as a
  concept that relates to a document.
- Each block is a graph node with stable identity and type-specific content.
- A typed containment relation connects a child block to a document or
  container block.
- Containment carries an order key so insertions and moves do not renumber the
  whole document. The key lives on the child block, because a relation carries
  no properties.
- A block has exactly one active containment parent. Document structure is a
  tree, not a graph. One block surfaced from several documents needs a
  distinct non-structural reference relation, which no change has introduced.
- The graph remains authoritative. No editor-specific serialized document tree
  is stored as a second source of truth.
- Reading a document returns a rooted, bounded graph that can be assembled into
  deterministic block order.

## Initial Block Vocabulary

- Two block types ship in this change: rich text and divider. Nothing else.
- Rich text blocks store normalized text runs with supported semantic marks and
  links; paragraph, heading, and quote are roles of the same content shape.
- Divider blocks carry no authored text.
- Containment is nevertheless defined so a parent may be a document or a
  container block, so the first container type adds a vocabulary entry rather
  than reshaping stored containment.
- List and callout containers own ordered child blocks rather than embedding an
  opaque nested document payload. They arrive with the editor slice that
  renders them, not before.
- Code, equation, diagram, table, image, video, file, and embed blocks require
  their own content shapes and should be added only in the smallest slices
  needed by the editor roadmap.
- Unknown block types remain visible as unsupported content and are never
  silently omitted.

## Structural Operations

- Create a document and its initial block.
- Insert a block before or after another block.
- Revise a block's content or role without changing its identity.
- Split and merge compatible text blocks while preserving normalized runs.
- Move and reorder a block atomically, including between permitted containers.
- Retire a block and its active containment without physically deleting graph
  history.
- List a document's retired blocks and restore one, re-establishing containment
  at a valid position. Restore stays available for as long as the document
  exists; there is no expiry and no cleanup pass.
- Read the ordered document, one subtree, or a bounded range through the graph
  gateway.

## Schema Evolution

- Block types, content validation, containment rules, and migrations are
  application-owned source and system documentation.
- Adding or changing a block type requires a normal Calliopa change, including
  compatibility rules for existing graph data and editor behavior.
- There are no block-type manifests, extension namespaces, installed domain
  packages, or graph-hosted renderers.

## Proposed Scope

- Settle the names and required properties of the document, rich text, and
  containment vocabulary.
- Implement schema definitions and validation through the graph gateway.
- Implement ordered document reads and the minimal structural operations needed
  by the first editor slice.
- Implement retire, retired-block listing, and restore over closed containment
  validity.
- Prove identity preservation, deterministic ordering, valid containment,
  single-active-parent refusal, atomic split/merge/move, retire and restore,
  unknown-type visibility, and real-Postgres reload.
- Document how later block-type changes migrate existing stored content, and
  record that indefinite restore keeps retired blocks readable for the life of
  the document.

## Out Of Scope

- The workspace view host and rendered editor.
- Runtime extensions or user-defined executable block types.
- Comments, annotations, AI commands, proposal review, multiplayer editing, and
  every block type beyond rich text and divider.
- Story, scene, and other story-development document kinds.
- Referencing one block from several documents.
- Retention, expiry, or cleanup of retired blocks.
- Binary bytes in Postgres; media blocks reference Garage objects when a later
  change introduces them.

## Dependencies

- `CA_0004_FEAT_revisioned-graph-core` supplies durable primitives.
- `CA_0005_FEAT_graph-access-gateway` supplies reads, validation, and atomic
  mutations.
- `CA_0008_FEAT_block-editor-view` consumes this model.

## System Work

The scoped work is transferred to `docs/system/documents/block-document-model.md`, which
is now the authoritative document for this model. It carries the settled
vocabulary and the `CA_0007_001`-`CA_0007_009` tasks. Implementation works from
those task lines, not from this document.

## Functional Questions

- None open. The document kind, the initial block vocabulary, restore, and
  containment cardinality are settled above.
- `CA_0008_FEAT_block-editor-view` defers its block-removal behavior to the
  restore answer recorded here: restore is offered, indefinitely, from a
  document-level list of retired blocks.

