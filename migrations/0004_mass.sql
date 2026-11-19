create table if not exists mass_batches (
  id text primary key,
  user_id text not null,
  campaign_name text not null,
  platform text not null,
  bundle_id text not null,
  base_quantity integer not null,
  timeframe text not null,
  link_count integer not null,
  placed_count integer not null,
  failed_count integer not null,
  total_paise integer not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists mass_batch_links (
  id text primary key,
  batch_id text not null,
  user_id text not null,
  link text not null,
  order_id text,
  order_number text,
  status text not null,
  error text,
  total_paise integer not null default 0
);
