-- Declared property uniqueness backstop for Page.slug. BO_0073_010
--
-- Validation is the normal path and rejects a duplicate slug with
-- validation_failed. This index only catches the concurrency window two
-- simultaneous transactions can open, which an in-transaction read cannot see
-- under READ COMMITTED. Firing it is an alertable anomaly, not an expected
-- outcome, and it surfaces as a validation conflict rather than an ordinary
-- validation failure.
--
-- Scoped to established revisions because a node has at most one, so each page
-- contributes at most one slug. A draft may hold a slug that is still free.
-- tenant_id is part of the key so the constraint stays correct if this database
-- is ever read outside its cell, such as a restored or merged backup.
create unique index if not exists page_slug_unique
  on node_revision (tenant_id, (content->>'slug'))
  where status = 'established'
    and content->>'_type' = 'Page'
    and content ? 'slug';
