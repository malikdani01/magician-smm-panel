-- Magiciansmm ledger. Catalog is shared. Wallet, orders, and tickets are per user.
-- Prices are integer paise (INR × 100). No upstream provider is stored or called.

create table if not exists wallets (
  user_id text primary key,
  balance_paise integer not null default 0 check (balance_paise >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists wallet_transactions (
  id text primary key,
  user_id text not null,
  kind text not null,
  amount_paise integer not null,
  note text not null,
  created_at timestamptz not null default now()
);
create index if not exists wallet_transactions_user_idx
  on wallet_transactions (user_id, created_at desc);

create table if not exists services (
  id text primary key,
  platform text not null,
  engagement_type text not null,
  name text not null,
  price_per_1k_paise integer not null,
  min_quantity integer not null,
  max_quantity integer not null
);

create table if not exists bundles (
  id text primary key,
  name text not null,
  platform text not null,
  tagline text not null
);

create table if not exists bundle_items (
  id text primary key,
  bundle_id text not null references bundles (id),
  service_id text not null references services (id),
  engagement_type text not null,
  ratio_bps integer not null,
  is_base boolean not null default false
);

create table if not exists engagement_orders (
  id text primary key,
  user_id text not null,
  order_number text not null,
  bundle_id text not null,
  platform text not null,
  link text not null,
  base_quantity integer not null,
  total_paise integer not null,
  status text not null,
  organic boolean not null default false,
  interval_hours integer not null default 1,
  variance_percent integer not null default 0,
  provider_state text not null default 'unconnected',
  created_at timestamptz not null default now()
);
create index if not exists engagement_orders_user_idx
  on engagement_orders (user_id, created_at desc);

create table if not exists engagement_order_items (
  id text primary key,
  order_id text not null references engagement_orders (id),
  user_id text not null,
  engagement_type text not null,
  service_name text not null,
  quantity integer not null,
  delivered integer not null default 0,
  price_paise integer not null,
  status text not null
);

create table if not exists support_tickets (
  id text primary key,
  user_id text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists support_tickets_user_idx
  on support_tickets (user_id, created_at desc);

insert into services (id, platform, engagement_type, name, price_per_1k_paise, min_quantity, max_quantity) values
  ('ig-views', 'instagram', 'views', 'Stage views', 22, 100, 5000000),
  ('ig-likes', 'instagram', 'likes', 'House likes', 420, 10, 200000),
  ('ig-comments', 'instagram', 'comments', 'Whisper comments', 1800, 1, 5000),
  ('ig-saves', 'instagram', 'saves', 'Pocket saves', 310, 10, 100000),
  ('ig-shares', 'instagram', 'shares', 'Aisle shares', 260, 10, 100000),
  ('tt-views', 'tiktok', 'views', 'Cue views', 48, 100, 5000000),
  ('tt-likes', 'tiktok', 'likes', 'Cue likes', 560, 10, 200000),
  ('tt-saves', 'tiktok', 'saves', 'Cue saves', 240, 10, 100000),
  ('tt-shares', 'tiktok', 'shares', 'Cue shares', 190, 10, 100000),
  ('yt-views', 'youtube', 'views', 'House lights', 90, 100, 2000000),
  ('yt-likes', 'youtube', 'likes', 'Applause', 700, 10, 100000),
  ('yt-comments', 'youtube', 'comments', 'Gallery notes', 2200, 1, 2000),
  ('yt-subs', 'youtube', 'subscribers', 'Season seats', 4500, 10, 20000)
on conflict (id) do nothing;

insert into bundles (id, name, platform, tagline) values
  ('bundle-ig', 'Opening night', 'instagram', 'Views as the base cue, with likes, comments, saves, and shares in proportion.'),
  ('bundle-tt', 'Short cue', 'tiktok', 'A tight TikTok set paced from views.'),
  ('bundle-yt', 'Encore', 'youtube', 'Views, applause, notes, and a small subscriber line.')
on conflict (id) do nothing;

insert into bundle_items (id, bundle_id, service_id, engagement_type, ratio_bps, is_base) values
  ('bi-ig-v', 'bundle-ig', 'ig-views', 'views', 10000, true),
  ('bi-ig-l', 'bundle-ig', 'ig-likes', 'likes', 310, false),
  ('bi-ig-c', 'bundle-ig', 'ig-comments', 'comments', 80, false),
  ('bi-ig-s', 'bundle-ig', 'ig-saves', 'saves', 110, false),
  ('bi-ig-h', 'bundle-ig', 'ig-shares', 'shares', 130, false),
  ('bi-tt-v', 'bundle-tt', 'tt-views', 'views', 10000, true),
  ('bi-tt-l', 'bundle-tt', 'tt-likes', 'likes', 310, false),
  ('bi-tt-s', 'bundle-tt', 'tt-saves', 'saves', 110, false),
  ('bi-tt-h', 'bundle-tt', 'tt-shares', 'shares', 130, false),
  ('bi-yt-v', 'bundle-yt', 'yt-views', 'views', 10000, true),
  ('bi-yt-l', 'bundle-yt', 'yt-likes', 'likes', 250, false),
  ('bi-yt-c', 'bundle-yt', 'yt-comments', 'comments', 40, false),
  ('bi-yt-u', 'bundle-yt', 'yt-subs', 'subscribers', 20, false)
on conflict (id) do nothing;
