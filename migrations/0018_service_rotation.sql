alter table delivery_drops add column if not exists provider_status text;
create table if not exists desk_meta (key text primary key, value text not null default '');
insert into desk_meta (key, value) values ('service_active_limit', '1')
on conflict (key) do nothing;
