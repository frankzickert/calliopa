-- BO_0115_005: the index set typed relation lookup requires. The read path
-- pushes tenant + type, from-endpoint, and to-endpoint filters into relation
-- lookups (retrieval.SQLStore.FindRelations); without these every typed
-- relation lookup is a sequential scan. relation_tenant_id_status_idx (0002)
-- covers tenant_id only despite its name; the tenant+type composite below is
-- the shape the two most common pushed filters actually take (validity status
-- lives on relation_validity, keyed by its primary key).
create index if not exists relation_tenant_id_type_idx on relation(tenant_id, type);
create index if not exists relation_from_node_id_idx on relation(from_node_id);
create index if not exists relation_to_node_id_idx on relation(to_node_id) where to_node_id is not null;
create index if not exists relation_to_relation_id_idx on relation(to_relation_id) where to_relation_id is not null;
