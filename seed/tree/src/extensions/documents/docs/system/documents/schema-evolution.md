# Schema Evolution

## Schema Evolution

* Block types, content validation, containment rules, and migrations are application-owned source and system documentation.
* Adding or changing a block type requires a normal Calliopa change, including compatibility rules for existing graph data and editor behavior.
* A block type is an extension's declared vocabulary in the graph — its `ext.blocktype` and `ext.relationtype` members, enforced by CCGW's Validation (`BO_0207`) — and the view that renders it is a contribution resolved at build time from the manifests present in the tree ([Contribution Contract](../workspace/contribution-contract.md)). Nothing is loaded at runtime: no graph-hosted renderer, no installed domain package, no dynamic import (revised under `BO_0202_009`).

- Containment is defined so a parent may be a document or a container block. The first container type adds a vocabulary entry rather than reshaping stored containment.
- List and callout containers own ordered child blocks rather than embedding an opaque nested document payload. They arrive with the editor slice that renders them.
- Code, equation, diagram, table, image, video, file, and embed blocks need their own content shapes and enter in the smallest slices the editor roadmap requires.

### Migrating Stored Content

- Adding a block type migrates nothing. Existing blocks keep their type and content, and a build that predates the type reads it as unsupported content rather than losing it.
- Widening a permitted set — another role, another mark, another containment origin — migrates nothing. Every stored value stays valid under the wider set.
- Narrowing a permitted set is breaking and needs a data migration in the same change: content established under the wider set may hold a value the narrower set forbids, and a read that refuses its own stored content is worse than the value it was narrowing away.
- Changing a content shape needs a migration that rewrites stored content, because validation runs on the way in and never repairs what is already there. The revision's schema version says which shape a stored record was written against.
- A migration rewrites content in place through the graph's own primitives. It does not delete revisions, because history is what makes retirement recoverable.

### What Indefinite Restore Costs

- Retired blocks accumulate for the life of a document. Nothing prunes them.
- The ordered document read is unaffected: it follows `contains`, so a retired block costs it nothing.
- The retired list grows without bound, so a document edited heavily over years answers that read more slowly. It is a separate rooted read, so only a caller asking for the list pays for it.
- Graph size grows with every retirement and every revision behind it, which is the backup and restore cost recorded in [Revisioned Graph](../content-store/retention-and-backup.md).

