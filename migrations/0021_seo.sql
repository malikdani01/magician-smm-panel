create table if not exists seo_pages (
  slug text primary key,
  title text not null default '',
  description text not null default '',
  h1 text not null default '',
  body text not null default '',
  published boolean not null default true,
  noindex boolean not null default false,
  updated_at timestamptz not null default now()
);
