alter table payment_gateways add column if not exists pay_mode text not null default 'manual';
alter table payment_gateways add column if not exists pay_currency text not null default 'INR';
alter table payment_gateways add column if not exists network text not null default '';
alter table payment_gateways add column if not exists pay_kind text not null default 'other';
