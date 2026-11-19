alter table provider_bindings add column if not exists price_per_1k_paise integer not null default 0;
