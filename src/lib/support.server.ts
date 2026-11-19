import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getSql } from "@/lib/db";
import { lockedEmail } from "@/lib/admin.server";

export type TicketRow = {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  status: string;
  email: string;
  guest_name: string;
  created_at: string;
  name: string;
  avatar: string;
  unread?: boolean;
};

export type MessageRow = {
  id: string;
  ticket_id: string;
  sender: string;
  kind: string;
  body: string;
  file_name: string;
  created_at: string;
};

let ready = false;

async function ensure() {
  if (ready) return getSql();
  const sql = await getSql();
  await sql`alter table support_tickets add column if not exists status text not null default 'pending'`;
  await sql`alter table support_tickets add column if not exists email text not null default ''`;
  await sql`alter table support_tickets add column if not exists guest_name text not null default ''`;
  await sql`alter table support_tickets add column if not exists admin_seen_at timestamptz`;
  await sql`
    create table if not exists support_messages (
      id text primary key,
      ticket_id text not null,
      sender text not null,
      kind text not null default 'text',
      body text not null default '',
      file_name text not null default '',
      created_at timestamptz not null default now()
    )
  `;
  await sql`alter table user_prefs add column if not exists avatar_url text`;
  const closed = await sql<{ id: string }>`select id from support_tickets where status = 'closed'`;
  await Promise.all(closed.map((row) => eraseTicket(row.id)));
  ready = true;
  return sql;
}

function cleanEmail(value: string) {
  return String(value || "").trim().toLowerCase().slice(0, 160);
}

const mediaDir = () => join(process.cwd(), "data", "support-files");

async function parkMedia(body: string, fileName: string) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(body);
  if (!match) throw new Error("That file could not be read.");
  const mime = match[1] || "application/octet-stream";
  const bytes = match[2] ? Buffer.from(match[3] || "", "base64") : Buffer.from(decodeURIComponent(match[3] || ""), "utf8");
  if (!bytes.length) throw new Error("That file could not be read.");
  if (bytes.length > 80 * 1024 * 1024) throw new Error("This file is larger than 80 MB. Send a smaller one.");
  const id = crypto.randomUUID();
  await mkdir(mediaDir(), { recursive: true });
  await writeFile(join(mediaDir(), id), bytes);
  await writeFile(join(mediaDir(), `${id}.json`), JSON.stringify({ mime, name: fileName.slice(0, 180) }));
  return `/api/support-file/${id}`;
}

export async function readSupportFile(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const bytes = await readFile(join(mediaDir(), id));
    const meta = JSON.parse(await readFile(join(mediaDir(), `${id}.json`), "utf8")) as { mime?: string; name?: string };
    return { bytes, mime: meta.mime || "application/octet-stream", name: String(meta.name || "file").replace(/["\r\n]/g, "") };
  } catch {
    return null;
  }
}

async function dropMedia(body: string) {
  const hit = /\/api\/support-file\/([0-9a-f-]{36})/i.exec(body || "");
  if (!hit) return;
  await unlink(join(mediaDir(), hit[1])).catch(() => undefined);
  await unlink(join(mediaDir(), `${hit[1]}.json`)).catch(() => undefined);
}

async function eraseTicket(id: string) {
  const sql = await getSql();
  const rows = await sql<{ body: string }>`select body from support_messages where ticket_id = ${id}`;
  await Promise.all(rows.map((row) => dropMedia(row.body)));
  await sql`delete from support_messages where ticket_id = ${id}`;
  await sql`delete from support_tickets where id = ${id}`;
}

export async function createTicket(input: { userId: string; email: string; name: string; subject: string; body: string }) {
  const sql = await ensure();
  const email = cleanEmail(input.email);
  const subject = input.subject.trim().slice(0, 120);
  const body = input.body.trim().slice(0, 2000);
  if (!email || !email.includes("@")) throw new Error("Enter a valid email.");
  if (subject.length < 3 || body.length < 8) throw new Error("Write a subject and a short note.");
  const open = await sql<{ id: string }>`
    select id from support_tickets
    where lower(email) = ${email} and status in ('pending', 'open')
    limit 1
  `;
  if (open[0]) throw new Error("You already have an open ticket. Wait until it is closed before raising another.");
  const id = crypto.randomUUID();
  const userId = input.userId || `guest:${email}`;
  await sql`
    insert into support_tickets (id, user_id, subject, body, status, email, guest_name)
    values (${id}, ${userId}, ${subject}, ${body}, 'pending', ${email}, ${input.name.trim().slice(0, 80)})
  `;
  await sql`
    insert into support_messages (id, ticket_id, sender, kind, body, file_name)
    values (${crypto.randomUUID()}, ${id}, 'user', 'text', ${body}, '')
  `;
  return { id };
}

export async function ticketsForUser(userId: string, email: string) {
  const sql = await ensure();
  const needle = cleanEmail(email);
  return sql<TicketRow>`
    select t.id, t.user_id, t.subject, t.body, t.status, t.email, t.guest_name, t.created_at::text as created_at,
           coalesce(nullif(u.name, ''), nullif(t.guest_name, ''), 'Member') as name,
           coalesce(p.avatar_url, '') as avatar
    from support_tickets t
    left join "user" u on u.id = t.user_id
    left join user_prefs p on p.user_id = t.user_id
    where (t.user_id = ${userId} or (${needle} <> '' and lower(t.email) = ${needle}))
      and t.status <> 'closed'
    order by t.created_at desc
    limit 30
  `;
}

export async function ticketsForAdmin() {
  const sql = await ensure();
  return sql<TicketRow>`
    select t.id, t.user_id, t.subject, t.body, t.status, t.email, t.guest_name, t.created_at::text as created_at,
           coalesce(nullif(u.name, ''), nullif(t.guest_name, ''), 'Member') as name,
           coalesce(p.avatar_url, '') as avatar,
           (t.admin_seen_at is null or exists (
             select 1 from support_messages m
             where m.ticket_id = t.id and m.sender = 'user' and m.created_at > t.admin_seen_at
           )) as unread
    from support_tickets t
    left join "user" u on u.id = t.user_id
    left join user_prefs p on p.user_id = t.user_id
    where t.status <> 'closed'
    order by case t.status when 'pending' then 0 else 1 end, t.created_at desc
    limit 100
  `;
}

export async function markTicketRead(id: string) {
  const sql = await ensure();
  await sql`update support_tickets set admin_seen_at = now() where id = ${id}`;
}

export async function ticketMessages(ticketId: string) {
  const sql = await ensure();
  return sql<MessageRow>`
    select id, ticket_id, sender, kind, body, file_name, created_at::text as created_at
    from support_messages
    where ticket_id = ${ticketId}
    order by created_at asc
    limit 300
  `;
}

async function ticketById(id: string) {
  const sql = await ensure();
  const rows = await sql<{ id: string; user_id: string; email: string; status: string }>`
    select id, user_id, email, status from support_tickets where id = ${id} limit 1
  `;
  return rows[0] ?? null;
}

export async function setTicketStatus(id: string, status: "open" | "closed") {
  const sql = await ensure();
  const row = await ticketById(id);
  if (!row) throw new Error("Ticket not found.");
  if (status === "closed") {
    await eraseTicket(id);
    return { ok: true as const, status };
  }
  await sql`update support_tickets set status = ${status} where id = ${id}`;
  await sql`
    insert into support_messages (id, ticket_id, sender, kind, body, file_name)
    values (${crypto.randomUUID()}, ${id}, 'admin', 'text', ${"Admin accepted your ticket. You can chat now."}, '')
  `;
  return { ok: true as const, status };
}

export async function addMessage(input: { ticketId: string; sender: "user" | "admin"; kind: string; body: string; fileName: string; userId?: string; email?: string }) {
  const row = await ticketById(input.ticketId);
  if (!row) throw new Error("Ticket not found.");
  if (input.sender === "user") {
    const email = cleanEmail(input.email || "");
    const owns = row.user_id === input.userId || (email && row.email === email);
    if (!owns) throw new Error("This ticket is not yours.");
    if (row.status !== "open") throw new Error(row.status === "pending" ? "Wait until admin accepts this ticket." : "This ticket is closed. Raise a new one.");
  }
  if (input.sender === "admin" && row.status !== "open") throw new Error("Accept the ticket before chatting.");
  const kind = ["text", "image", "file", "voice"].includes(input.kind) ? input.kind : "text";
  let body = input.body;
  if (kind === "text") {
    body = body.trim().slice(0, 2000);
    if (!body) throw new Error("Nothing to send.");
  } else {
    body = await parkMedia(body, input.fileName);
  }
  const sql = await ensure();
  await sql`
    insert into support_messages (id, ticket_id, sender, kind, body, file_name)
    values (${crypto.randomUUID()}, ${input.ticketId}, ${input.sender}, ${kind}, ${body}, ${input.fileName.slice(0, 180)})
  `;
  if (input.sender === "user") await sql`update support_tickets set admin_seen_at = null where id = ${input.ticketId}`;
  return { ok: true as const };
}

export async function requireLocked(email: string) {
  const lock = await lockedEmail(email);
  if (!lock) throw new Error("Support chat is only open for a suspended or blocked account.");
  return lock;
}

export async function adminFace() {
  const sql = await ensure();
  const rows = await sql<{ avatar_url: string | null }>`
    select p.avatar_url
    from user_roles r
    left join user_prefs p on p.user_id = r.user_id
    where r.role = 'admin' and coalesce(p.avatar_url, '') <> ''
    limit 1
  `;
  return { name: "Admin", avatar: rows[0]?.avatar_url || "" };
}
