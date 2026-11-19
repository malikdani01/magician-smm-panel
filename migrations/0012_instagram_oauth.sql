create table if not exists instagram_oauth (
  id text primary key,
  user_id text not null,
  ig_user_id text not null default '',
  username text not null default '',
  access_token text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists instagram_oauth_user_ig_idx
  on instagram_oauth (user_id, ig_user_id);
