create table if not exists tiktok_oauth (
  id text primary key,
  user_id text not null,
  open_id text not null default '',
  username text not null default '',
  access_token text not null,
  refresh_token text not null default '',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists tiktok_oauth_user_open_idx
  on tiktok_oauth (user_id, open_id);

create table if not exists tiktok_oauth_state (
  state text primary key,
  user_id text not null,
  created_at timestamptz not null default now()
);
