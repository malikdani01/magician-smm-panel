alter table services add column if not exists price_per_10k_paise integer;

update services
set price_per_10k_paise = price_per_1k_paise * 10
where price_per_10k_paise is null;

update services set
  price_per_10k_paise = 1904,
  min_quantity = 100,
  max_quantity = 10000000,
  name = 'Views'
where id in ('ig-views', 'tt-views');

update services set
  price_per_10k_paise = 100000,
  min_quantity = 10,
  max_quantity = 500000,
  name = 'Likes'
where id in ('ig-likes', 'tt-likes');

update services set
  price_per_10k_paise = 100000,
  min_quantity = 10,
  max_quantity = 100000,
  name = 'Shares'
where id in ('ig-shares', 'tt-shares');

update services set
  price_per_10k_paise = 100000,
  min_quantity = 10,
  max_quantity = 50000,
  name = 'Saves'
where id in ('ig-saves', 'tt-saves');

update services set
  price_per_10k_paise = 180000,
  min_quantity = 1,
  max_quantity = 5000,
  name = 'Comments'
where id = 'ig-comments';

insert into services (id, platform, engagement_type, name, price_per_1k_paise, price_per_10k_paise, min_quantity, max_quantity) values
  ('ig-reposts', 'instagram', 'reposts', 'Reposts', 12000, 120000, 10, 1000000),
  ('tt-reposts', 'tiktok', 'reposts', 'Reposts', 12000, 120000, 10, 1000000)
on conflict (id) do update set
  price_per_10k_paise = excluded.price_per_10k_paise,
  min_quantity = excluded.min_quantity,
  max_quantity = excluded.max_quantity,
  name = excluded.name;

insert into bundle_items (id, bundle_id, service_id, engagement_type, ratio_bps, is_base) values
  ('bi-ig-r', 'bundle-ig', 'ig-reposts', 'reposts', 80, false),
  ('bi-tt-r', 'bundle-tt', 'tt-reposts', 'reposts', 80, false)
on conflict (id) do nothing;

create table if not exists user_prefs (
  user_id text primary key,
  full_name text,
  api_key text,
  organic_enabled boolean not null default false,
  ratios_json text not null default '{}'
);

create table if not exists instagram_accounts (
  id text primary key,
  user_id text not null,
  username text not null,
  created_at timestamptz not null default now()
);

create index if not exists instagram_accounts_user_idx
  on instagram_accounts (user_id, created_at desc);
