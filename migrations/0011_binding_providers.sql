alter table provider_bindings add column if not exists providers_json text not null default '';
