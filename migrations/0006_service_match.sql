alter table delivery_drops add column if not exists service_label text;
update services set min_quantity = 50 where engagement_type = 'saves' and min_quantity < 50;
