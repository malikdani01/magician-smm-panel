create table if not exists user_access (
  user_id text primary key references "user" (id) on delete cascade,
  suspended boolean not null default false,
  blocked boolean not null default false,
  updated_at timestamptz not null default now()
);
