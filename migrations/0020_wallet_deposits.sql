create table if not exists wallet_deposits (
  id text primary key,
  user_id text not null,
  gateway text not null,
  amount_paise integer not null,
  pay_amount text not null default '',
  pay_currency text not null default 'INR',
  address text not null default '',
  rate numeric not null default 0,
  reference text not null default '',
  screenshot text not null default '',
  provider_ref text not null default '',
  status text not null default 'open',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists wallet_deposits_user_idx on wallet_deposits (user_id, created_at desc);
create unique index if not exists wallet_deposits_txid_idx on wallet_deposits (reference) where reference <> '' and status = 'paid';
