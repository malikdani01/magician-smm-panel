alter table provider_bindings add column if not exists section_enabled boolean not null default true;

insert into services (id, platform, engagement_type, name, price_per_1k_paise, min_quantity, max_quantity) values
  ('tt-comments', 'tiktok', 'comments', 'Cue comments', 900, 10, 100000)
on conflict (id) do nothing;

insert into bundle_items (id, bundle_id, service_id, engagement_type, ratio_bps, is_base) values
  ('bi-tt-c', 'bundle-tt', 'tt-comments', 'comments', 80, false)
on conflict (id) do nothing;
