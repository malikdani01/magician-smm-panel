create table if not exists smm_providers (
  id text primary key,
  name text not null,
  api_url text not null,
  api_key text not null,
  enabled boolean not null default true,
  last_error text not null default '',
  last_sync timestamptz
);

alter table managed_services add column if not exists provider_row_id text not null default '';

drop index if exists managed_services_provider_idx;
create unique index if not exists managed_services_provider_pair_idx on managed_services (provider_row_id, provider_service_id);
