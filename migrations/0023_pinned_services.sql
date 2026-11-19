alter table provider_bindings add column if not exists pinned_ids text not null default '';
alter table delivery_drops add column if not exists finished_at timestamptz;
