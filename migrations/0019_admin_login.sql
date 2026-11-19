-- One-time rotation of the original seeded admin only.
-- Old login admin@magiciansmm.local / Admin@2004 stops working.
-- Accounts that already use a different email are left alone.
do $$
declare
  uid text;
begin
  select id into uid from "user" where email = 'admin@magiciansmm.local' limit 1;
  if uid is null then
    return;
  end if;
  if not exists (select 1 from "user" where email = 'admin@magiciansmm.com' and id <> uid) then
    update "user"
    set email = 'admin@magiciansmm.com', "emailVerified" = true, "updatedAt" = now()
    where id = uid;
  end if;
  update "account"
  set password = 'd6bda76c00e5136e63d776ba27d2e2f6:1de973b97a28e60b4cf8b7678f243712aa41c33e65952ebcdf43974c9d31ea6433c1ef9c8a526adaa06f6c294a22d8e7826bff624a3ffd32550675c7c4c7e0b3',
      "updatedAt" = now()
  where "userId" = uid and "providerId" = 'credential';
end $$;
