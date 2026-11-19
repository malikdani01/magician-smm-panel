import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";

const ADMIN_EMAIL = "admin@magiciansmm.com";
const ADMIN_PASSWORD = "Magician#8841";
const ADMIN_CREDIT_PAISE = 200000;

/** Create the first admin only when the desk has no admin yet. Never reset an email or password that was already saved. */
export async function seedTestDesk() {
  const sql = await getSql();
  const admins = await sql<{ id: string }>`
    select user_id as id from user_roles where role = 'admin' limit 1
  `;
  if (admins.length > 0) return;
  const userId = crypto.randomUUID();
  const inserted = await sql<{ id: string }>`
    insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    values (${userId}, 'Admin', ${ADMIN_EMAIL}, true, now(), now())
    on conflict (email) do nothing
    returning id
  `;
  const existing = inserted[0]?.id
    ? inserted
    : await sql<{ id: string }>`select id from "user" where lower(email) = ${ADMIN_EMAIL} limit 1`;
  const id = existing[0]?.id;
  if (!id) return;
  const credential = await sql<{ id: string }>`
    select id from "account" where "userId" = ${id} and "providerId" = 'credential' limit 1
  `;
  if (credential.length === 0) {
    const hash = await hashPassword(ADMIN_PASSWORD);
    await sql`
      insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
      values (${crypto.randomUUID()}, ${id}, 'credential', ${id}, ${hash}, now(), now())
    `;
  }
  await sql`
    insert into wallets (user_id, balance_paise)
    values (${id}, ${ADMIN_CREDIT_PAISE})
    on conflict (user_id) do nothing
  `;
  await sql`
    insert into user_roles (user_id, role)
    values (${id}, 'admin')
    on conflict (user_id) do update set role = 'admin'
  `;
}
