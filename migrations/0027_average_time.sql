alter table managed_services add column if not exists average_minutes integer not null default 0;
