alter table provider_bindings add column if not exists pick_mode text not null default 'fixed';

create table if not exists payment_settings (
  id text primary key,
  qr_image text not null default '',
  upi_id text not null default '',
  note text not null default ''
);

insert into payment_settings (id, note)
values ('desk', 'Pay on this QR. Funds are added after the admin checks your screenshot.')
on conflict (id) do nothing;

create table if not exists payment_claims (
  id text primary key,
  user_id text not null,
  amount_paise integer not null,
  screenshot text not null,
  reference text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists payment_claims_user_idx on payment_claims (user_id, created_at desc);
