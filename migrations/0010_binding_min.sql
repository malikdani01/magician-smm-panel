alter table provider_bindings add column if not exists min_quantity integer not null default 0;
