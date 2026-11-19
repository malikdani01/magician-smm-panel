create table if not exists user_roles (
  user_id text primary key,
  role text not null default 'customer'
);

create table if not exists managed_services (
  id text primary key,
  source text not null,
  provider_service_id text not null,
  platform text not null,
  category text not null,
  name text not null,
  description text not null default '',
  price_per_1k_paise integer not null,
  min_quantity integer not null,
  max_quantity integer not null,
  drip_allowed boolean not null default false,
  enabled boolean not null default true,
  customized boolean not null default false,
  updated_at timestamptz not null default now()
);
create unique index if not exists managed_services_provider_idx on managed_services (provider_service_id);

create table if not exists provider_bindings (
  slot text primary key,
  api_url text not null default '',
  api_key text not null default '',
  service_id text not null default ''
);

alter table delivery_drops add column if not exists provider_service_id text;
alter table delivery_drops add column if not exists api_url text;
alter table delivery_drops add column if not exists api_key text;
