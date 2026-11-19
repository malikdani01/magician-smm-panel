alter table provider_bindings add column if not exists rate_min_units integer not null default 0;
alter table provider_bindings add column if not exists rate_max_units integer not null default 0;
