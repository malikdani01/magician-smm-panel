import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getSql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin.server";

export type ListingInput = {
  id?: string;
  url: string;
  showLink: boolean;
  name: string;
  image: string;
  followers: number;
  topic: string;
  price: number;
  description: string;
  content: string;
  income: string;
  expense: string;
  incomeNote: string;
  expenseNote: string;
  promotion: string;
  maintain: string;
  monetized: string;
  screenshots: string[];
  verifyCode: string;
  closeDms: boolean;
};

const TOPICS = ["Games", "Movies & Music", "Luxury & Motivation", "Fashion & Style", "Cars & Bikes", "Pets & Animals", "Education", "Tech", "Comedy", "News", "Kids", "Other"];
const CONTENTS = ["Unique content", "Rewritten", "Non-unique content", "Mixed"];

let ready = false;
const mediaDir = () => join(process.cwd(), "data", "market-files");

async function sqlReady() {
  const sql = await getSql();
  if (ready) return sql;
  await sql`create table if not exists market_listings (
    id text primary key, owner_id text not null, url text not null default '', show_link boolean not null default true,
    platform text not null default '', name text not null default '', image text not null default '', followers bigint not null default 0,
    topic text not null default '', price integer not null default 0, description text not null default '', content text not null default '',
    income text not null default '', expense text not null default '', income_note text not null default '', expense_note text not null default '',
    promotion text not null default '', maintain text not null default '', monetized text not null default '', screenshots text not null default '[]',
    verify_code text not null default '', close_dms boolean not null default false, status text not null default 'listed',
    discussions integer not null default 0, created_at timestamptz not null default now()
  )`;
  await sql`create table if not exists market_deals (
    id text primary key, listing_id text not null, buyer_id text not null, buyer_name text not null default '',
    buyer_email text not null default '', status text not null default 'pending', created_at timestamptz not null default now()
  )`;
  await sql`create table if not exists market_messages (
    id text primary key, deal_id text not null, sender text not null, kind text not null default 'text',
    body text not null default '', file_name text not null default '', created_at timestamptz not null default now()
  )`;
  ready = true;
  return sql;
}

function platformOf(url: string) {
  const host = url.toLowerCase();
  if (host.includes("youtu")) return "youtube";
  if (host.includes("instagram")) return "instagram";
  if (host.includes("tiktok")) return "tiktok";
  if (host.includes("facebook")) return "facebook";
  if (host.includes("t.me") || host.includes("telegram")) return "telegram";
  if (host.includes("twitter") || host.includes("x.com")) return "twitter";
  return "social";
}

function meta(html: string, key: string) {
  const tag = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i").exec(html)
    || new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, "i").exec(html);
  return tag?.[1] ? decode(tag[1]) : "";
}

function decode(value: string) {
  return value.replace(/&/g, "&").replace(/"/g, '"').replace(/&#39;/g, "'").replace(/</g, "<").replace(/>/g, ">");
}

function followersOf(html: string) {
  const patterns = [
    /"subscriberCountText"\s*:\s*\{[^}]*"simpleText"\s*:\s*"([^"]+)"/,
    /"subscriberCount"\s*:\s*"(\d+)"/,
    /([\d.,]+\s*[KMB]?)\s+subscribers/i,
    /([\d.,]+\s*[KMB]?)\s+followers/i,
  ];
  for (const pattern of patterns) {
    const hit = pattern.exec(html);
    if (!hit?.[1]) continue;
    const raw = hit[1].replace(/subscribers|followers/gi, "").trim().replace(/,/g, "").toUpperCase();
    const number = Number(raw.replace(/[KMB]/g, ""));
    if (!Number.isFinite(number)) continue;
    if (raw.endsWith("K")) return Math.round(number * 1000);
    if (raw.endsWith("M")) return Math.round(number * 1000000);
    if (raw.endsWith("B")) return Math.round(number * 1000000000);
    return Math.round(number);
  }
  return 0;
}

function unescapeText(value: string) {
  return decode(value.replace(/\\u002F/g, "/").replace(/\\u0026/g, "&").replace(/\\n/g, "\n").replace(/\\"/g, '"'));
}

function grab(html: string, pattern: RegExp) {
  return pattern.exec(html)?.[1] || "";
}

async function readPage(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
      accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!response?.ok) return "";
  return response.text().catch(() => "");
}

function normalizeLink(raw: string) {
  let value = String(raw || "").trim();
  if (!value) throw new Error("Paste the account link.");
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error("Paste a full account link."); }
  if (!/^https?:$/.test(url.protocol)) throw new Error("Paste a full account link.");
  return url;
}

export async function previewAsset(raw: string) {
  const url = normalizeLink(raw);
  const platform = platformOf(url.hostname + url.pathname);
  const html = await readPage(url.toString());
  let name = unescapeText(grab(html, /"nickname":"((?:\\.|[^"\\])*)"/));
  let image = unescapeText(grab(html, /"avatarLarger":"((?:\\.|[^"\\])*)"/) || grab(html, /"avatarMedium":"((?:\\.|[^"\\])*)"/));
  let followers = Number(grab(html, /"followerCount":(\d+)/) || grab(html, /"subscriberCount":"(\d+)"/)) || 0;
  if (platform === "youtube") {
    const oembed = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url.toString())}`, { signal: AbortSignal.timeout(8000) }).then((item) => item.ok ? item.json() : null).catch(() => null) as { title?: string; author_name?: string; thumbnail_url?: string } | null;
    name = name || oembed?.author_name || oembed?.title || "";
    image = image || oembed?.thumbnail_url || "";
  }
  if (platform === "tiktok" && !name) {
    const oembed = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url.toString())}`, { signal: AbortSignal.timeout(8000) }).then((item) => item.ok ? item.json() : null).catch(() => null) as { author_name?: string } | null;
    name = oembed?.author_name || "";
  }
  if (!name) name = meta(html, "og:title");
  if (!image) image = meta(html, "og:image");
  if (!followers) followers = followersOf(html);
  return { url: url.toString(), platform, name: name.slice(0, 140), image: image.slice(0, 2000), followers };
}

async function codeIsLive(url: string, code: string) {
  const clean = normalizeLink(url).toString();
  const pages = [clean];
  if (clean.includes("youtu")) pages.push(clean.replace(/\/$/, "") + "/about");
  const needle = code.toLowerCase();
  for (const page of pages) {
    const html = await readPage(page);
    const signature = unescapeText(grab(html, /"signature":"((?:\\.|[^"\\])*)"/) || grab(html, /"biography":"((?:\\.|[^"\\])*)"/));
    if (`${html}\n${signature}`.toLowerCase().includes(needle)) return true;
  }
  return false;
}

function cleanListing(input: ListingInput) {
  const url = normalizeLink(String(input.url || "")).toString().slice(0, 500);
  const topic = TOPICS.includes(input.topic) ? input.topic : "";
  const price = Math.round(Number(input.price) || 0);
  if (!url) throw new Error("Paste the account link.");
  if (!String(input.name || "").trim()) throw new Error("Enter the account name.");
  if (!String(input.image || "").trim()) throw new Error("Choose a profile image.");
  if (!topic) throw new Error("Select a topic.");
  if (price < 1) throw new Error("Enter the price.");
  return {
    url,
    showLink: input.showLink !== false,
    platform: platformOf(url),
    name: String(input.name || "").trim().slice(0, 140),
    image: String(input.image || "").slice(0, 2000),
    followers: Math.max(0, Math.round(Number(input.followers) || 0)),
    topic,
    price,
    description: String(input.description || "").slice(0, 4000),
    content: CONTENTS.includes(input.content) ? input.content : "",
    income: String(input.income || "").slice(0, 40),
    expense: String(input.expense || "").slice(0, 40),
    incomeNote: String(input.incomeNote || "").slice(0, 2000),
    expenseNote: String(input.expenseNote || "").slice(0, 2000),
    promotion: String(input.promotion || "").slice(0, 2000),
    maintain: String(input.maintain || "").slice(0, 2000),
    monetized: input.monetized === "Yes" || input.monetized === "No" ? input.monetized : "",
    verifyCode: String(input.verifyCode || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 16),
    closeDms: Boolean(input.closeDms),
    screenshots: (input.screenshots || []).filter((item) => typeof item === "string" && item.startsWith("/api/market-file/")).slice(0, 24),
  };
}

async function parkShot(body: string, fileName: string) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(body);
  if (!match) throw new Error("That image could not be read.");
  const bytes = match[2] ? Buffer.from(match[3] || "", "base64") : Buffer.from(decodeURIComponent(match[3] || ""), "utf8");
  if (!bytes.length) throw new Error("That image could not be read.");
  if (bytes.length > 80 * 1024 * 1024) throw new Error("One image is larger than 80 MB.");
  const id = crypto.randomUUID();
  await mkdir(mediaDir(), { recursive: true });
  await writeFile(join(mediaDir(), id), bytes);
  await writeFile(join(mediaDir(), `${id}.json`), JSON.stringify({ mime: match[1] || "image/jpeg", name: fileName.slice(0, 180) }));
  return `/api/market-file/${id}`;
}

export async function saveShots(files: { body: string; name: string }[]) {
  const urls: string[] = [];
  for (const file of files.slice(0, 24)) urls.push(await parkShot(file.body, file.name));
  return urls;
}

export async function saveListing(userId: string, input: ListingInput) {
  await requireAdmin(userId);
  const row = cleanListing(input);
  const sql = await sqlReady();
  const shots = JSON.stringify(row.screenshots);
  if (input.id) {
    const owned = await sql<{ id: string }>`select id from market_listings where id = ${input.id} and owner_id = ${userId} limit 1`;
    if (!owned.length) throw new Error("Listing not found.");
    await sql`
      update market_listings set url = ${row.url}, show_link = ${row.showLink}, platform = ${row.platform}, name = ${row.name}, image = ${row.image},
        followers = ${row.followers}, topic = ${row.topic}, price = ${row.price}, description = ${row.description}, content = ${row.content},
        income = ${row.income}, expense = ${row.expense}, income_note = ${row.incomeNote}, expense_note = ${row.expenseNote}, promotion = ${row.promotion},
        maintain = ${row.maintain}, monetized = ${row.monetized}, screenshots = ${shots}, verify_code = ${row.verifyCode}, close_dms = ${row.closeDms}, status = 'listed'
      where id = ${input.id}
    `;
    return input.id;
  }
  const id = crypto.randomUUID();
  await sql`
    insert into market_listings (id, owner_id, url, show_link, platform, name, image, followers, topic, price, description, content, income, expense, income_note, expense_note, promotion, maintain, monetized, screenshots, verify_code, close_dms)
    values (${id}, ${userId}, ${row.url}, ${row.showLink}, ${row.platform}, ${row.name}, ${row.image}, ${row.followers}, ${row.topic}, ${row.price}, ${row.description}, ${row.content}, ${row.income}, ${row.expense}, ${row.incomeNote}, ${row.expenseNote}, ${row.promotion}, ${row.maintain}, ${row.monetized}, ${shots}, ${row.verifyCode}, ${row.closeDms})
  `;
  return id;
}

export async function adminListings(userId: string) {
  await requireAdmin(userId);
  const sql = await sqlReady();
  return sql<{ id: string; name: string; topic: string; price: number; followers: number; image: string; status: string; discussions: number; created_at: string }>`select id, name, topic, price, followers, image, status, discussions, created_at::text as created_at from market_listings where owner_id = ${userId} order by created_at desc`;
}

export async function oneListing(id: string, includeHidden = false) {
  const sql = await sqlReady();
  const rows = await sql<Record<string, unknown>>`select * from market_listings where id = ${id} limit 1`;
  const row = rows[0];
  if (!row) return null;
  if (!includeHidden && row.status !== "listed") return null;
  return {
    id: String(row.id || ""),
    name: String(row.name || ""),
    topic: String(row.topic || ""),
    price: Number(row.price) || 0,
    followers: Number(row.followers) || 0,
    image: String(row.image || ""),
    url: String(row.url || ""),
    show_link: Boolean(row.show_link),
    description: String(row.description || ""),
    content: String(row.content || ""),
    income: String(row.income || ""),
    expense: String(row.expense || ""),
    income_note: String(row.income_note || ""),
    expense_note: String(row.expense_note || ""),
    promotion: String(row.promotion || ""),
    maintain: String(row.maintain || ""),
    monetized: String(row.monetized || ""),
    screenshots: JSON.parse(String(row.screenshots || "[]")) as string[],
    discussions: Number(row.discussions) || 0,
    platform: String(row.platform || ""),
    status: String(row.status || ""),
    verify_code: String(row.verify_code || ""),
    owner_id: String(row.owner_id || ""),
    close_dms: Boolean(row.close_dms),
  };
}

export async function publicListings() {
  const sql = await sqlReady();
  return sql<{ id: string; name: string; topic: string; price: number; followers: number; image: string; platform: string }>`select id, name, topic, price, followers, image, platform from market_listings where status = 'listed' order by created_at desc`;
}

async function buyerOf(userId: string) {
  const sql = await sqlReady();
  const rows = await sql<{ name: string; email: string }>`select name, email from "user" where id = ${userId} limit 1`;
  return rows[0] || { name: "User", email: "" };
}

export async function createDeal(userId: string, listingId: string) {
  const sql = await sqlReady();
  const rows = await sql<{ id: string; status: string; owner_id: string }>`select id, status, owner_id from market_listings where id = ${listingId} limit 1`;
  const listing = rows[0];
  if (!listing || listing.status !== "listed") throw new Error("This account is not for sale.");
  if (listing.owner_id === userId) throw new Error("You cannot buy your own listing.");
  const open = await sql<{ id: string }>`select id from market_deals where listing_id = ${listingId} and buyer_id = ${userId} and status in ('pending', 'open') limit 1`;
  if (open.length) return open[0].id;
  const buyer = await buyerOf(userId);
  const id = crypto.randomUUID();
  await sql`insert into market_deals (id, listing_id, buyer_id, buyer_name, buyer_email) values (${id}, ${listingId}, ${userId}, ${buyer.name}, ${buyer.email})`;
  await sql`update market_listings set discussions = discussions + 1 where id = ${listingId}`;
  return id;
}

export async function dealsForAdmin(userId: string) {
  await requireAdmin(userId);
  const sql = await sqlReady();
  return sql<{ id: string; status: string; buyer_name: string; buyer_email: string; created_at: string; listing_name: string; price: number; topic: string }>`
    select d.id, d.status, d.buyer_name, d.buyer_email, d.created_at::text as created_at, l.name as listing_name, l.price, l.topic
    from market_deals d join market_listings l on l.id = d.listing_id
    where d.status in ('pending', 'open')
    order by d.created_at desc
  `;
}

export async function dealsForUser(userId: string) {
  const sql = await sqlReady();
  return sql<{ id: string; status: string; created_at: string; listing_name: string; price: number; image: string; topic: string }>`
    select d.id, d.status, d.created_at::text as created_at, l.name as listing_name, l.price, l.image, l.topic
    from market_deals d join market_listings l on l.id = d.listing_id
    where d.buyer_id = ${userId} and d.status in ('pending', 'open')
    order by d.created_at desc
  `;
}

async function wipeDeal(id: string) {
  const sql = await sqlReady();
  const messages = await sql<{ body: string }>`select body from market_messages where deal_id = ${id}`;
  for (const message of messages) {
    const hit = /\/api\/market-file\/([0-9a-f-]{36})/i.exec(message.body || "");
    if (!hit) continue;
    await unlink(join(mediaDir(), hit[1])).catch(() => undefined);
    await unlink(join(mediaDir(), `${hit[1]}.json`)).catch(() => undefined);
  }
  await sql`delete from market_messages where deal_id = ${id}`;
  await sql`delete from market_deals where id = ${id}`;
}

export async function setDeal(userId: string, id: string, action: "accept" | "decline" | "confirm") {
  await requireAdmin(userId);
  const sql = await sqlReady();
  const rows = await sql<{ id: string; status: string; listing_id: string }>`select id, status, listing_id from market_deals where id = ${id} limit 1`;
  const deal = rows[0];
  if (!deal) throw new Error("Deal not found.");
  if (action === "accept") {
    if (deal.status !== "pending") throw new Error("This deal is not pending.");
    await sql`update market_deals set status = 'open' where id = ${id}`;
    return "open";
  }
  if (action === "confirm") {
    if (deal.status !== "open") throw new Error("Accept the deal before confirming it.");
    await sql`update market_listings set status = 'sold' where id = ${deal.listing_id}`;
    await wipeDeal(id);
    return "sold";
  }
  await wipeDeal(id);
  return "declined";
}

export async function dealMessages(userId: string, dealId: string, admin: boolean) {
  const sql = await sqlReady();
  const rows = await sql<{ buyer_id: string; status: string }>`select buyer_id, status from market_deals where id = ${dealId} limit 1`;
  const deal = rows[0];
  if (!deal || deal.status !== "open") return [];
  if (!admin && deal.buyer_id !== userId) return [];
  return sql<{ id: string; sender: string; kind: string; body: string; file_name: string; created_at: string }>`select id, sender, kind, body, file_name, created_at::text as created_at from market_messages where deal_id = ${dealId} order by created_at asc`;
}

export async function addDealMessage(input: { userId: string; dealId: string; sender: "admin" | "user"; kind: string; body: string; fileName: string }) {
  const sql = await sqlReady();
  const rows = await sql<{ buyer_id: string; status: string }>`select buyer_id, status from market_deals where id = ${input.dealId} limit 1`;
  const deal = rows[0];
  if (!deal || deal.status !== "open") throw new Error("Chat opens after the deal is accepted.");
  if (input.sender === "admin") await requireAdmin(input.userId);
  if (input.sender === "user" && deal.buyer_id !== input.userId) throw new Error("This deal is not yours.");
  let body = input.kind === "text" ? input.body.slice(0, 4000) : input.body;
  if (input.kind !== "text") body = await parkShot(input.body, input.fileName || "file");
  await sql`
    insert into market_messages (id, deal_id, sender, kind, body, file_name)
    values (${crypto.randomUUID()}, ${input.dealId}, ${input.sender}, ${input.kind.slice(0, 20)}, ${body}, ${input.fileName.slice(0, 180)})
  `;
}

export async function readMarketFile(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const bytes = await readFile(join(mediaDir(), id));
    const meta = JSON.parse(await readFile(join(mediaDir(), `${id}.json`), "utf8")) as { mime: string; name: string };
    return { bytes, mime: meta.mime || "application/octet-stream", name: meta.name || "file" };
  } catch {
    return null;
  }
}

export function newCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export { TOPICS, CONTENTS };
