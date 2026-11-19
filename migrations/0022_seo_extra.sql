alter table seo_pages add column if not exists canonical text not null default '';
alter table seo_pages add column if not exists image text not null default '';
alter table seo_pages add column if not exists faqs text not null default '';
alter table seo_pages add column if not exists category text not null default '';
alter table seo_pages add column if not exists tags text not null default '';
alter table seo_pages add column if not exists author text not null default '';
alter table seo_pages add column if not exists published_at timestamptz;

create table if not exists seo_audits (
  id text primary key,
  score integer not null default 0,
  report text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists seo_index_log (
  id text primary key,
  ok boolean not null default false,
  detail text not null default '',
  url_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists seo_redirects (
  from_path text primary key,
  to_path text not null,
  created_at timestamptz not null default now()
);
