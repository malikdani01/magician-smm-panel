create table if not exists market_listings (
  id text primary key,
  owner_id text not null,
  url text not null default '',
  show_link boolean not null default true,
  platform text not null default '',
  name text not null default '',
  image text not null default '',
  followers bigint not null default 0,
  topic text not null default '',
  price integer not null default 0,
  description text not null default '',
  content text not null default '',
  income text not null default '',
  expense text not null default '',
  income_note text not null default '',
  expense_note text not null default '',
  promotion text not null default '',
  maintain text not null default '',
  monetized text not null default '',
  screenshots text not null default '[]',
  verify_code text not null default '',
  close_dms boolean not null default false,
  status text not null default 'listed',
  discussions integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists market_deals (
  id text primary key,
  listing_id text not null,
  buyer_id text not null,
  buyer_name text not null default '',
  buyer_email text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists market_messages (
  id text primary key,
  deal_id text not null,
  sender text not null,
  kind text not null default 'text',
  body text not null default '',
  file_name text not null default '',
  created_at timestamptz not null default now()
);
