create table if not exists payment_gateways (
  id text primary key,
  name text not null,
  account_title text not null default '',
  account_number text not null default '',
  ifsc text not null default '',
  instructions text not null default '',
  qr_image text not null default '',
  min_paise integer not null default 10000,
  max_paise integer not null default 10000000,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  archived boolean not null default false
);

alter table payment_claims add column if not exists gateway_id text not null default '';
alter table payment_claims add column if not exists reject_reason text not null default '';
alter table payment_claims add column if not exists reviewed_at timestamptz;
