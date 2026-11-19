create table if not exists delivery_drops (
  id text primary key,
  order_id text not null,
  user_id text not null,
  platform text not null,
  link text not null,
  engagement_type text not null,
  quantity integer not null,
  place_at timestamptz not null,
  status text not null default 'waiting',
  provider_order_id text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists delivery_drops_due_idx on delivery_drops (status, place_at);
