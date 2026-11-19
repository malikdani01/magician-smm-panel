import { getSql } from "@/lib/db";

export type SeoFlags = {
  seoTags: boolean;
  platformPages: boolean;
  footerLinks: boolean;
  hidePrivate: boolean;
  homeHeading: boolean;
  guides: boolean;
  indexNow: boolean;
  hostCompression: boolean;
  homeIndex: boolean;
};

export type SeoLinks = {
  instagram: string;
  youtube: string;
  telegram: string;
  whatsapp: string;
  facebook: string;
  twitter: string;
};

export type SeoSettings = {
  panelName: string;
  country: string;
  mainUrl: string;
  title: string;
  description: string;
  h1: string;
  homeText: string;
  keywords: string;
  extraKeywords: string;
  googleCode: string;
  bingCode: string;
  shareImage: string;
  twitterImage: string;
  ogTitle: string;
  ogDescription: string;
  gaId: string;
  gtmId: string;
  indexNowKey: string;
  robotsOverride: string;
  links: SeoLinks;
  flags: SeoFlags;
};

export type SeoCheck = { id: string; label: string; ok: boolean; level: "pass" | "warn" | "fail"; detail: string };
export type SeoService = { name: string; category: string; price: number; min: number; max: number };
export type SeoPage = {
  slug: string;
  path: string;
  title: string;
  description: string;
  h1: string;
  body: string;
  published: boolean;
  noindex: boolean;
  count: number;
  kind: "platform" | "guide" | "home";
  canonical: string;
  image: string;
  faqs: string;
  category: string;
  tags: string;
  author: string;
  publishedAt: string;
};

export type ProbeHit = {
  path: string;
  status: number;
  ms: number;
  encoding: string;
  cache: string;
  bytes: number;
  error: string;
};

export type SiteProbe = {
  at: string;
  root: string;
  ok: boolean;
  compressed: boolean;
  detail: string;
  hits: ProbeHit[];
};

const LIVE_SITE = "https://magiciansmm.online";
const OLD_SITES = ["https://155.248.246.105.sslip.io", "https://155-248-246-105.sslip.io", "http://155.248.246.105.sslip.io", "http://155-248-246-105.sslip.io"];

function swapOldSite(value: string) {
  let next = String(value || "");
  for (const old of OLD_SITES) next = next.split(old).join(LIVE_SITE);
  return next;
}

const DEFAULTS: SeoSettings = {
  panelName: "Magician SMM",
  country: "",
  mainUrl: LIVE_SITE,
  title: "Magician SMM Panel | Social Media Services Worldwide",
  description: "Magician SMM sells Instagram, TikTok, YouTube, Facebook, Telegram, X, Spotify and more. See the live price per 1,000 and order with a public link.",
  h1: "Magician SMM Panel for Every Social Network",
  homeText: "Magician SMM is a worldwide SMM panel. It is not only for Instagram. Enabled services can include Instagram, TikTok, YouTube, Facebook, Telegram, X, Spotify and any other network on your service list. Each row shows the live price per 1,000, the minimum and the maximum. Paste a public link. No password is asked. Start with a small order, then increase the quantity. New networks appear on their own page as soon as a service for them is enabled.",
  keywords: "smm panel, social media panel, instagram services, tiktok services, youtube services, facebook services, telegram members, twitter followers, spotify plays",
  extraKeywords: "buy instagram followers, buy tiktok likes, buy youtube views, buy facebook followers, telegram members, spotify plays",
  googleCode: "",
  bingCode: "",
  shareImage: "",
  twitterImage: "",
  ogTitle: "Magician SMM Panel | Social Media Services Worldwide",
  ogDescription: "Magician SMM sells Instagram, TikTok, YouTube, Facebook, Telegram, X, Spotify and more. See the live price per 1,000 and order with a public link.",
  gaId: "",
  gtmId: "",
  indexNowKey: "",
  robotsOverride: "",
  links: { instagram: "", youtube: "", telegram: "", whatsapp: "", facebook: "", twitter: "" },
  flags: {
    seoTags: true,
    platformPages: true,
    footerLinks: true,
    hidePrivate: true,
    homeHeading: true,
    guides: true,
    indexNow: true,
    hostCompression: false,
    homeIndex: true,
  },
};

const NAMES: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
  telegram: "Telegram",
  twitter: "Twitter / X",
  x: "Twitter / X",
  spotify: "Spotify",
  website: "Website Traffic",
  traffic: "Website Traffic",
};

const KINDS = [
  { id: "reels", label: "Reels", words: ["reel"] },
  { id: "followers", label: "Followers", words: ["follower"] },
  { id: "likes", label: "Likes", words: ["like"] },
  { id: "views", label: "Views", words: ["view", "watch"] },
  { id: "comments", label: "Comments", words: ["comment"] },
  { id: "shares", label: "Shares", words: ["share", "repost"] },
  { id: "saves", label: "Saves", words: ["save"] },
  { id: "subscribers", label: "Subscribers", words: ["subscriber"] },
  { id: "members", label: "Members", words: ["member"] },
  { id: "plays", label: "Plays", words: ["play", "stream", "listener"] },
] as const;

const GUIDES: [string, string, string, string][] = [
  ["what-is-an-smm-panel", "What is an SMM panel?", "SMM panel", "An SMM panel is a dashboard where you buy social engagement such as views, likes, followers or comments and send it to a public link. You pay from your balance. The panel never needs your password."],
  ["how-to-choose-an-smm-panel", "How to choose an SMM panel", "SMM panel", "Compare the live price per 1,000, the minimum, the maximum, and whether the description says refill or non-drop. Place a small test order before a large one."],
  ["buy-instagram-followers", "How to buy Instagram followers", "Instagram", "Open the Instagram followers page, read the minimum and the price per 1,000, then place a small order on a public profile link. Do not send the same link twice at the same time."],
  ["youtube-views", "How to get YouTube views", "YouTube", "Use a views service only on a public video. A slower delivery looks more natural than the full quantity in one minute. Keep the video public while the order runs."],
  ["grow-tiktok", "How to grow on TikTok", "TikTok", "Views, likes and shares should stay in a believable ratio. A video with a huge like count and almost no views looks automated. Start with views, then a smaller like order."],
  ["facebook-page-likes", "How to buy Facebook page likes", "Facebook", "Use a public Facebook page or post link. Compare the price per 1,000, the minimum and the maximum, then place a small test order before a larger one."],
  ["telegram-members", "How to buy Telegram members", "Telegram", "Open the Telegram services, check the live price per 1,000, and order on a public channel or group link. Do not send the same link twice at the same time."],
  ["twitter-x-followers", "How to buy X followers", "X", "X and Twitter services use a public profile or post link. Read the minimum first. A small order is the safest way to test a new service."],
  ["spotify-plays", "How to buy Spotify plays", "Spotify", "Spotify plays and listeners should be ordered on a public track. Check the price per 1,000 and keep the track available while the order runs."],
  ["smm-panel-safety", "Is an SMM panel safe?", "Safety", "Never share your password. A real panel only needs the public link of the post, video or profile. Start with a small order and do not buy the same link on two panels at once."],
];

const PRIVATE_PREFIXES = [
  "/admin",
  "/dashboard",
  "/wallet",
  "/orders",
  "/order",
  "/settings",
  "/login",
  "/api",
  "/engagement-order",
  "/engagement-orders",
  "/single-order",
  "/mass",
  "/detect",
  "/instagram",
  "/tiktok",
  "/telegram-bot",
  "/support",
  "/api-access",
];

function clip(value: unknown, max: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function block(value: unknown, max: number) {
  return String(value ?? "").replace(/\r/g, "").trim().slice(0, max);
}

function flag(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function metaToken(raw: string) {
  const match = raw.match(/content\s*=\s*["']([^"']+)["']/i);
  return (match?.[1] || raw).replace(/[<>"']/g, "").trim().slice(0, 180);
}

export function cleanUrl(raw: string) {
  const value = clip(raw, 300);
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function slugify(input: string) {
  return clip(input, 180).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export function platformLabel(platform: string) {
  const key = platform.toLowerCase();
  return NAMES[key] || key.slice(0, 1).toUpperCase() + key.slice(1);
}

export function isPrivatePath(pathname: string) {
  const path = pathname.split("?")[0] || "/";
  return PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function sanitizeSeo(input: Partial<SeoSettings> | null | undefined): SeoSettings {
  const links = input?.links || ({} as SeoLinks);
  const flags = input?.flags || ({} as SeoFlags);
  const ga = clip(input?.gaId, 32);
  const gtm = clip(input?.gtmId, 32);
  return {
    panelName: clip(input?.panelName, 80) || DEFAULTS.panelName,
    country: clip(input?.country, 60),
    mainUrl: cleanUrl(input?.mainUrl || ""),
    title: clip(input?.title, 180),
    description: clip(input?.description, 320),
    h1: clip(input?.h1, 160),
    homeText: block(input?.homeText, 2000),
    keywords: clip(input?.keywords, 400),
    extraKeywords: clip(input?.extraKeywords, 400),
    googleCode: metaToken(clip(input?.googleCode, 400)),
    bingCode: metaToken(clip(input?.bingCode, 400)),
    shareImage: cleanUrl(input?.shareImage || ""),
    twitterImage: cleanUrl(input?.twitterImage || ""),
    ogTitle: clip(input?.ogTitle, 180),
    ogDescription: clip(input?.ogDescription, 320),
    gaId: /^G-[A-Z0-9]+$/i.test(ga) ? ga : "",
    gtmId: /^GTM-[A-Z0-9]+$/i.test(gtm) ? gtm : "",
    indexNowKey: clip(input?.indexNowKey, 128).replace(/[^a-zA-Z0-9-]/g, ""),
    robotsOverride: block(input?.robotsOverride, 4000),
    links: {
      instagram: cleanUrl(links.instagram),
      youtube: cleanUrl(links.youtube),
      telegram: cleanUrl(links.telegram),
      whatsapp: cleanUrl(links.whatsapp),
      facebook: cleanUrl(links.facebook),
      twitter: cleanUrl(links.twitter),
    },
    flags: {
      seoTags: flag(flags.seoTags, true),
      platformPages: flag(flags.platformPages, true),
      footerLinks: flag(flags.footerLinks, true),
      hidePrivate: flag(flags.hidePrivate, true),
      homeHeading: flag(flags.homeHeading, true),
      guides: flag(flags.guides, true),
      indexNow: flag(flags.indexNow, false),
      hostCompression: flag(flags.hostCompression, false),
      homeIndex: flag(flags.homeIndex, true),
    },
  };
}

export function publicSettings(seo: SeoSettings) {
  const { indexNowKey: _key, ...safe } = seo;
  return safe;
}

let schemaReady = false;

async function ready() {
  const sql = await getSql();
  if (schemaReady) return sql;
  await sql`create table if not exists desk_meta (key text primary key, value text not null default '')`;
  await sql`
    create table if not exists seo_pages (
      slug text primary key,
      title text not null default '',
      description text not null default '',
      h1 text not null default '',
      body text not null default '',
      published boolean not null default true,
      noindex boolean not null default false,
      updated_at timestamptz not null default now()
    )
  `;
  await sql`alter table seo_pages add column if not exists canonical text not null default ''`;
  await sql`alter table seo_pages add column if not exists image text not null default ''`;
  await sql`alter table seo_pages add column if not exists faqs text not null default ''`;
  await sql`alter table seo_pages add column if not exists category text not null default ''`;
  await sql`alter table seo_pages add column if not exists tags text not null default ''`;
  await sql`alter table seo_pages add column if not exists author text not null default ''`;
  await sql`alter table seo_pages add column if not exists published_at timestamptz`;
  await sql`
    create table if not exists seo_audits (
      id text primary key,
      score integer not null default 0,
      report text not null default '',
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists seo_index_log (
      id text primary key,
      ok boolean not null default false,
      detail text not null default '',
      url_count integer not null default 0,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists seo_redirects (
      from_path text primary key,
      to_path text not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`update seo_pages set canonical = replace(replace(replace(replace(canonical, 'https://155.248.246.105.sslip.io', 'https://magiciansmm.online'), 'https://155-248-246-105.sslip.io', 'https://magiciansmm.online'), 'http://155.248.246.105.sslip.io', 'https://magiciansmm.online'), 'http://155-248-246-105.sslip.io', 'https://magiciansmm.online') where canonical like '%sslip.io%'`;
  await sql`update seo_pages set image = replace(replace(replace(replace(image, 'https://155.248.246.105.sslip.io', 'https://magiciansmm.online'), 'https://155-248-246-105.sslip.io', 'https://magiciansmm.online'), 'http://155.248.246.105.sslip.io', 'https://magiciansmm.online'), 'http://155-248-246-105.sslip.io', 'https://magiciansmm.online') where image like '%sslip.io%'`;
  await sql`update seo_pages set body = replace(replace(replace(replace(body, 'https://155.248.246.105.sslip.io', 'https://magiciansmm.online'), 'https://155-248-246-105.sslip.io', 'https://magiciansmm.online'), 'http://155.248.246.105.sslip.io', 'https://magiciansmm.online'), 'http://155-248-246-105.sslip.io', 'https://magiciansmm.online') where body like '%sslip.io%'`;
  schemaReady = true;
  return sql;
}

function blank(value: string) {
  return !String(value || "").trim();
}

function completeSeo(seo: SeoSettings): SeoSettings {
  const next: SeoSettings = { ...seo, links: { ...seo.links }, flags: { ...seo.flags } };
  if (blank(next.mainUrl) || OLD_SITES.some((old) => next.mainUrl.startsWith(old))) next.mainUrl = DEFAULTS.mainUrl;
  next.mainUrl = swapOldSite(next.mainUrl);
  next.shareImage = swapOldSite(next.shareImage);
  next.twitterImage = swapOldSite(next.twitterImage);
  next.homeText = swapOldSite(next.homeText);
  if (blank(next.country) || next.country.toLowerCase() === "pakistan") next.country = "";
  const oldTitle = next.title === "Magician SMM Panel | Instagram, YouTube, TikTok, Facebook" || next.title === "Magician SMM Panel Pakistan | Instagram, YouTube, TikTok";
  const oldCopy = /pakistan|instagram, youtube, tiktok and facebook|people in pakistan|people anywhere who want/i;
  if (blank(next.title) || oldCopy.test(next.title) || oldTitle) next.title = DEFAULTS.title;
  if (blank(next.description) || oldCopy.test(next.description)) next.description = DEFAULTS.description;
  if (blank(next.h1) || oldCopy.test(next.h1) || next.h1 === "Magician SMM Panel" || next.h1 === "Magician SMM Panel in Pakistan") next.h1 = DEFAULTS.h1;
  if (blank(next.homeText) || oldCopy.test(next.homeText)) next.homeText = DEFAULTS.homeText;
  if (blank(next.keywords) || oldCopy.test(next.keywords) || next.keywords.startsWith("smm panel, cheapest smm panel, instagram followers")) next.keywords = DEFAULTS.keywords;
  if (blank(next.extraKeywords) || oldCopy.test(next.extraKeywords) || next.extraKeywords.startsWith("buy instagram followers, buy youtube views, buy tiktok likes, magician")) next.extraKeywords = DEFAULTS.extraKeywords;
  if (blank(next.ogTitle) || oldCopy.test(next.ogTitle) || oldTitle) next.ogTitle = DEFAULTS.ogTitle;
  if (blank(next.ogDescription) || oldCopy.test(next.ogDescription)) next.ogDescription = DEFAULTS.ogDescription;
  if (blank(next.indexNowKey)) {
    next.indexNowKey = freshIndexKey();
    next.flags.indexNow = true;
  }
  return sanitizeSeo(next);
}

export async function loadSeo(): Promise<SeoSettings> {
  const sql = await ready();
  const rows = await sql<{ value: string }>`select value from desk_meta where key = 'seo_config' limit 1`;
  let parsed = DEFAULTS;
  if (rows[0]?.value) {
    try {
      parsed = sanitizeSeo(JSON.parse(rows[0].value) as Partial<SeoSettings>);
    } catch {
      parsed = DEFAULTS;
    }
  }
  const next = completeSeo(parsed);
  if (JSON.stringify(next) !== JSON.stringify(parsed)) {
    const packed = JSON.stringify(next);
    await sql`
      insert into desk_meta (key, value) values ('seo_config', ${packed})
      on conflict (key) do update set value = ${packed}
    `;
  }
  return next;
}

export async function saveSeo(input: Partial<SeoSettings>) {
  const sql = await ready();
  const current = await loadSeo();
  const next = sanitizeSeo({
    ...current,
    ...input,
    links: { ...current.links, ...(input.links || {}) },
    flags: { ...current.flags, ...(input.flags || {}) },
  });
  const packed = JSON.stringify(next);
  await sql`
    insert into desk_meta (key, value) values ('seo_config', ${packed})
    on conflict (key) do update set value = ${packed}
  `;
  return next;
}

function kindOf(text: string) {
  const hay = text.toLowerCase();
  return KINDS.find((kind) => kind.words.some((word) => hay.includes(word)))?.id || "other";
}

async function catalog() {
  const sql = await ready();
  const managed = await sql<{ platform: string; category: string; name: string; price: number; min: number; max: number }>`
    select platform, category, name, price_per_1k_paise as price, min_quantity as min, max_quantity as max
    from managed_services
    where enabled = true
    order by price_per_1k_paise asc
  `.catch(() => []);
  if (managed.length > 0) return managed;
  return sql<{ platform: string; category: string; name: string; price: number; min: number; max: number }>`
    select platform, engagement_type as category, name, price_per_1k_paise as price, min_quantity as min, max_quantity as max
    from services
    order by price_per_1k_paise asc
  `.catch(() => []);
}

type Override = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  body: string;
  published: boolean;
  noindex: boolean;
  canonical: string;
  image: string;
  faqs: string;
  category: string;
  tags: string;
  author: string;
  published_at: string | null;
};

async function overrides() {
  const sql = await ready();
  const rows = await sql<Override>`
    select slug, title, description, h1, body, published, noindex, canonical, image, faqs, category, tags, author, published_at
    from seo_pages
  `;
  return new Map(rows.map((row) => [row.slug, row]));
}

function scheduledOff(row?: Override) {
  if (!row?.published_at) return false;
  const at = new Date(row.published_at).getTime();
  return Number.isFinite(at) && at > Date.now();
}

function applyOverride(page: SeoPage, row?: Override): SeoPage {
  if (!row) return page;
  const merged: SeoPage = {
    ...page,
    title: row.title || page.title,
    description: row.description || page.description,
    h1: row.h1 || page.h1,
    body: row.body || page.body,
    published: row.published && !scheduledOff(row),
    noindex: row.noindex,
    canonical: row.canonical || "",
    image: row.image || "",
    faqs: row.faqs || "",
    category: row.category || page.category,
    tags: row.tags || "",
    author: row.author || page.author,
    publishedAt: row.published_at || "",
  };
  return merged;
}

export function resolvedCopy(seo: SeoSettings, serviceCount: number) {
  const place = seo.country ? ` in ${seo.country}` : "";
  const title = seo.title || `${seo.panelName} - SMM Panel${place} | All Social Media`;
  const description = seo.description || `${seo.panelName} is an SMM panel${place}. ${serviceCount > 0 ? `${serviceCount} live services` : "Social services"} with prices per 1,000. Orders start from a public link. No password is required.`;
  const h1 = seo.h1 || `${seo.panelName} - SMM Panel${place}`;
  const homeText = seo.homeText || description;
  return { title: title.slice(0, 180), description: description.slice(0, 320), h1, homeText };
}

export function parseFaqs(raw: string) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [q, ...rest] = line.split("||");
      return { q: (q || "").trim(), a: rest.join("||").trim() };
    })
    .filter((item) => item.q && item.a)
    .slice(0, 12);
}

export async function buildPages(input?: SeoSettings) {
  const seo = input ?? await loadSeo();
  const rows = await catalog();
  const saved = await overrides();
  const pages: SeoPage[] = [];
  const grouped = new Map<string, Map<string, SeoService[]>>();
  for (const row of rows) {
    const platform = clip(row.platform, 32).toLowerCase().replace(/[^a-z0-9]+/g, "") || "other";
    const kind = kindOf(`${row.category} ${row.name}`);
    if (!grouped.has(platform)) grouped.set(platform, new Map());
    const bucket = grouped.get(platform)!;
    if (!bucket.has(kind)) bucket.set(kind, []);
    bucket.get(kind)!.push({
      name: row.name,
      category: row.category,
      price: Number(row.price) || 0,
      min: Number(row.min) || 0,
      max: Number(row.max) || 0,
    });
  }
  for (const [platform, kinds] of grouped) {
    const total = [...kinds.values()].reduce((sum, list) => sum + list.length, 0);
    if (total === 0) continue;
    const label = platformLabel(platform);
    pages.push(applyOverride({
      slug: `page/${platform}`,
      path: `/smm-panel/${platform}`,
      title: `${label} SMM Panel - ${seo.panelName}`,
      description: `${total} ${label} services on ${seo.panelName}. Live price per 1,000, minimum and maximum order. Public link only.`,
      h1: `${label} SMM Panel`,
      body: `${seo.panelName} lists ${total} live ${label} services. The price per 1,000, the minimum and the maximum come from the services that are turned on. Paste a public link, start with a small order, and do not send the same link twice at the same time.`,
      published: true,
      noindex: false,
      count: total,
      kind: "platform",
      canonical: "",
      image: "",
      faqs: `What is the ${label} page on ${seo.panelName}?||It lists the live ${label} services and the current price per 1,000.\nDo I need to share my password?||No. Only the public link of the profile, post or video is used.\nHow should I start?||Order the minimum first and check the delivery before a larger quantity.`,
      category: label,
      tags: "",
      author: seo.panelName,
      publishedAt: "",
    }, saved.get(`page/${platform}`)));
    for (const [kind, list] of kinds) {
      if (list.length === 0) continue;
      const nice = kind === "other" ? "Services" : (KINDS.find((item) => item.id === kind)?.label || "Services");
      pages.push(applyOverride({
        slug: `page/${platform}/${kind}`,
        path: `/smm-panel/${platform}/${kind}`,
        title: `Buy ${label} ${nice} - ${seo.panelName}`,
        description: `${list.length} ${label} ${nice.toLowerCase()} services. Cheapest price is listed first. Public link only, no password.`,
        h1: `Buy ${label} ${nice}`,
        body: `${seo.panelName} has ${list.length} ${label} ${nice.toLowerCase()} services. The cheapest price is shown first. Read the minimum and maximum, then place the order on a public link. No password is required.`,
        published: true,
        noindex: false,
        count: list.length,
        kind: "platform",
        canonical: "",
        image: "",
        faqs: `How do I buy ${label} ${nice.toLowerCase()}?||Open this page, pick a service, and order the quantity on a public link.\nIs the price per view or per 1,000?||The price in the table is for 1,000.\nCan I order a private account?||No. The link has to be public while the order runs.`,
        category: label,
        tags: nice.toLowerCase(),
        author: seo.panelName,
        publishedAt: "",
      }, saved.get(`page/${platform}/${kind}`)));
    }
  }
  await ensureGuides(saved);
  const after = await overrides();
  for (const row of after.values()) {
    if (!row.slug.startsWith("guide/")) continue;
    const slug = row.slug.slice(6);
    if (!slug) continue;
    pages.push({
      slug: row.slug,
      path: `/smm-panel/guide/${slug}`,
      title: row.title,
      description: row.description,
      h1: row.h1 || row.title,
      body: row.body,
      published: row.published && !scheduledOff(row),
      noindex: row.noindex,
      count: 0,
      kind: "guide",
      canonical: row.canonical || "",
      image: row.image || "",
      faqs: row.faqs || "",
      category: row.category || "Guide",
      tags: row.tags || "",
      author: row.author || seo.panelName,
      publishedAt: row.published_at || "",
    });
  }
  return { pages, grouped };
}

async function ensureGuides(_saved: Map<string, Override>) {
  const sql = await ready();
  await seedGuides();
  await sql`
    insert into desk_meta (key, value) values ('seo_guides_seeded', '1')
    on conflict (key) do update set value = '1'
  `;
}

async function seedGuides() {
  const sql = await ready();
  for (const [slug, title, category, body] of GUIDES) {
    await sql`
      insert into seo_pages (slug, title, description, h1, body, published, noindex, category, author)
      values (${`guide/${slug}`}, ${title}, ${body.slice(0, 300)}, ${title}, ${body}, true, false, ${category}, ${"Magician SMM"})
      on conflict (slug) do nothing
    `;
  }
}

function dupes(pages: SeoPage[], field: "title" | "description") {
  const seen = new Map<string, number>();
  for (const page of pages) {
    if (!page.published) continue;
    const key = page[field].trim().toLowerCase();
    if (!key) continue;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  return [...seen.values()].filter((count) => count > 1).length;
}

export function scoreOf(seo: SeoSettings, pages: SeoPage[], probe?: SiteProbe | null) {
  const serviceCount = pages.filter((page) => page.kind === "platform" && !page.slug.includes("/", 5)).reduce((sum, page) => sum + page.count, 0);
  const copy = resolvedCopy(seo, serviceCount);
  const titleLen = copy.title.length;
  const descLen = copy.description.length;
  const livePages = pages.filter((page) => page.published && !page.noindex && page.kind === "platform");
  const guides = pages.filter((page) => page.published && page.kind === "guide");
  const titleDupes = dupes(pages, "title");
  const descDupes = dupes(pages, "description");
  const paths = new Set(pages.map((page) => page.path));
  const homeHit = probe?.hits.find((hit) => hit.path === "/");
  const speedOk = Boolean(homeHit && homeHit.status >= 200 && homeHit.status < 400 && homeHit.ms > 0 && homeHit.ms < 2500);
  const compressed = Boolean(probe?.compressed);
  const checks: SeoCheck[] = [
    { id: "title", label: "Home page title", ok: titleLen >= 15, level: titleLen >= 15 ? "pass" : "fail", detail: copy.title || "Add a title." },
    { id: "title-len", label: `Home page title length (${titleLen})`, ok: titleLen >= 45 && titleLen <= 70, level: titleLen >= 45 && titleLen <= 70 ? "pass" : titleLen >= 15 ? "warn" : "fail", detail: "Best is 50–65 letters, with the main phrase near the start." },
    { id: "https", label: "Secure address (https)", ok: seo.mainUrl.startsWith("https://"), level: seo.mainUrl.startsWith("https://") ? "pass" : "fail", detail: seo.mainUrl ? "Main URL must start with https." : "Set the main website URL." },
    { id: "sitemap", label: "sitemap.xml", ok: true, level: "pass", detail: "Live at /sitemap.xml. It lists only public, published pages." },
    { id: "robots", label: "robots.txt", ok: !seo.robotsOverride || /sitemap:/i.test(seo.robotsOverride), level: !seo.robotsOverride || /sitemap:/i.test(seo.robotsOverride) ? "pass" : "warn", detail: seo.robotsOverride ? "Using your custom robots.txt." : "Generated at /robots.txt. Private pages are disallowed." },
    { id: "description", label: "Home page description", ok: descLen >= 40, level: descLen >= 40 ? "pass" : "fail", detail: copy.description ? `${descLen} letters.` : "Add a description." },
    { id: "description-len", label: `Home page description length (${descLen})`, ok: descLen >= 120 && descLen <= 170, level: descLen >= 120 && descLen <= 170 ? "pass" : descLen >= 80 ? "warn" : "fail", detail: "Best is 120–160 letters." },
    { id: "google", label: "Google Search Console code", ok: seo.googleCode.length > 8, level: seo.googleCode.length > 8 ? "pass" : "fail", detail: seo.googleCode ? "The code is added to the public site head. This does not mean Google has verified the property until you click Verify." : "Paste the HTML tag from Google Search Console." },
    { id: "bing", label: "Bing Webmaster code", ok: seo.bingCode.length > 8, level: seo.bingCode.length > 8 ? "pass" : "fail", detail: seo.bingCode ? "The code is added to the public site head. Confirm verification inside Bing." : "Paste the msvalidate.01 tag from Bing." },
    { id: "h1", label: "Home page heading", ok: seo.flags.homeHeading && copy.h1.length > 8, level: seo.flags.homeHeading && copy.h1.length > 8 ? "pass" : "warn", detail: seo.flags.homeHeading ? copy.h1 : "Turn on heading and text." },
    { id: "text", label: "Home page text", ok: seo.flags.homeHeading && copy.homeText.length > 40, level: seo.flags.homeHeading && copy.homeText.length > 40 ? "pass" : "warn", detail: "Shown under the front page when the heading option is on." },
    { id: "image", label: "Share picture", ok: seo.shareImage.startsWith("https://"), level: seo.shareImage.startsWith("https://") ? "pass" : seo.shareImage ? "warn" : "fail", detail: seo.shareImage || "Add a 1200×630 https image address." },
    { id: "pages", label: `Platform pages (${livePages.length})`, ok: livePages.length > 0 && seo.flags.platformPages, level: livePages.length > 0 && seo.flags.platformPages ? "pass" : "fail", detail: livePages.length ? "Built from enabled services. Empty categories are not published." : "No enabled services yet, so no landing page is published." },
    { id: "canonical", label: "Canonical URL", ok: Boolean(seo.mainUrl), level: seo.mainUrl ? "pass" : "warn", detail: seo.mainUrl || "Set the main URL so canonical links are absolute." },
    { id: "alts", label: "Image alt text", ok: true, level: "pass", detail: "Public SEO images use the service or guide name as alt text. Decorative backgrounds stay empty on purpose." },
    { id: "dup-title", label: "Duplicate titles", ok: titleDupes === 0, level: titleDupes === 0 ? "pass" : "warn", detail: titleDupes ? `${titleDupes} titles are reused. Edit those pages.` : "Published pages have distinct titles." },
    { id: "dup-desc", label: "Duplicate descriptions", ok: descDupes === 0, level: descDupes === 0 ? "pass" : "warn", detail: descDupes ? `${descDupes} descriptions are reused.` : "Published pages have distinct descriptions." },
    { id: "links", label: "Internal links", ok: paths.size === pages.length, level: paths.size === pages.length ? "pass" : "warn", detail: "Footer and related links only point at published SEO pages." },
    { id: "speed", label: "Page loading", ok: speedOk, level: speedOk ? "pass" : probe ? "warn" : "warn", detail: homeHit ? `Home responded ${homeHit.status} in ${homeHit.ms} ms.` : "Run Test my site. No timing is stored yet." },
    { id: "speed-fail", label: "Home page reachable", ok: !probe || Boolean(homeHit && homeHit.status >= 200 && homeHit.status < 400), level: !probe ? "warn" : homeHit && homeHit.status >= 200 && homeHit.status < 400 ? "pass" : "fail", detail: probe?.detail || "Not tested yet." },
    { id: "compression", label: "Compression + browser cache", ok: compressed, level: compressed ? "pass" : "warn", detail: compressed ? "The last test saw gzip or brotli on the home page." : "Gzip/Brotli is a host setting. This app cannot turn it on by itself. Public SEO files send a short cache header." },
    { id: "indexnow", label: "IndexNow key", ok: seo.indexNowKey.length >= 8 && seo.mainUrl.startsWith("https://"), level: seo.indexNowKey.length >= 8 && seo.mainUrl.startsWith("https://") ? "pass" : "warn", detail: seo.indexNowKey ? `Key file: /seo-key/${seo.indexNowKey}. A 200 from IndexNow is not indexing.` : "Create a key, then submit URLs." },
    { id: "private", label: "Customer pages hidden", ok: seo.flags.hidePrivate, level: seo.flags.hidePrivate ? "pass" : "fail", detail: "Login, wallet, orders, admin and payment pages stay noindex when this is on." },
    { id: "guides", label: `SMM guides (${guides.length})`, ok: seo.flags.guides && guides.length > 0, level: seo.flags.guides && guides.length > 0 ? "pass" : "warn", detail: seo.flags.guides ? "Guides live under /smm-panel/guide." : "Guides are turned off." },
    { id: "schema", label: "Structured data", ok: true, level: "pass", detail: "Public pages include Organization, Breadcrumb and FAQ data. No fake reviews or ratings." },
  ];
  const points = checks.reduce((sum, item) => sum + (item.level === "pass" ? 1 : item.level === "warn" ? 0.45 : 0), 0);
  const score = Math.round((points / checks.length) * 100);
  return { checks, score, copy, passed: checks.filter((item) => item.level === "pass").length, warnings: checks.filter((item) => item.level === "warn").length, errors: checks.filter((item) => item.level === "fail").length };
}

async function readProbe(): Promise<SiteProbe | null> {
  const sql = await ready();
  const rows = await sql<{ value: string }>`select value from desk_meta where key = 'seo_probe' limit 1`;
  if (!rows[0]?.value) return null;
  try {
    return JSON.parse(rows[0].value) as SiteProbe;
  } catch {
    return null;
  }
}

export async function seoDesk() {
  const seo = await loadSeo();
  const { pages } = await buildPages(seo);
  const probe = await readProbe();
  const scored = scoreOf(seo, pages, probe);
  const sql = await ready();
  const audits = await sql<{ id: string; score: number; created_at: string; report: string }>`
    select id, score, created_at, report from seo_audits order by created_at desc limit 8
  `.catch(() => []);
  const indexLog = await sql<{ id: string; ok: boolean; detail: string; url_count: number; created_at: string }>`
    select id, ok, detail, url_count, created_at from seo_index_log order by created_at desc limit 12
  `.catch(() => []);
  const redirects = await sql<{ from_path: string; to_path: string }>`
    select from_path, to_path from seo_redirects order by created_at desc limit 30
  `.catch(() => []);
  const stamp = await sql<{ value: string }>`select value from desk_meta where key = 'seo_sitemap_at' limit 1`;
  return { seo, pages, probe, audits, indexLog, redirects, sitemapAt: stamp[0]?.value || "", ...scored };
}

export async function publicHead() {
  const seo = await loadSeo();
  const { pages } = await buildPages(seo);
  const scored = scoreOf(seo, pages, await readProbe());
  return {
    ...publicSettings(seo),
    title: scored.copy.title,
    description: scored.copy.description,
    h1: scored.copy.h1,
    homeText: scored.copy.homeText,
    pages: pages.filter((page) => page.published && !page.noindex).map((page) => ({ path: page.path, title: page.h1 || page.title, kind: page.kind })),
  };
}

export async function servicesFor(platform: string, kind?: string) {
  const seo = await loadSeo();
  const { grouped } = await buildPages(seo);
  const bucket = grouped.get(platform.toLowerCase());
  if (!bucket) return [];
  if (!kind) return [...bucket.values()].flat();
  return bucket.get(kind) || [];
}

function relatedTo(pages: SeoPage[], page: SeoPage) {
  return pages
    .filter((item) => item.published && !item.noindex && item.path !== page.path && (item.slug.startsWith(page.slug.split("/").slice(0, 2).join("/")) || item.kind === "guide"))
    .slice(0, 8)
    .map((item) => ({ path: item.path, title: item.h1 || item.title, kind: item.kind }));
}

export async function pageByPath(platform: string, kind?: string) {
  const seo = await loadSeo();
  if (!seo.flags.platformPages) return null;
  const cleanPlatform = slugify(platform).replace(/-/g, "");
  const cleanKind = kind ? slugify(kind) : "";
  const { pages } = await buildPages(seo);
  const path = cleanKind ? `/smm-panel/${cleanPlatform}/${cleanKind}` : `/smm-panel/${cleanPlatform}`;
  const page = pages.find((item) => item.path === path && item.kind === "platform");
  if (!page || !page.published) return null;
  const services = await servicesFor(cleanPlatform, cleanKind || undefined);
  if (services.length === 0) return null;
  return { seo: publicSettings(seo), page, services, related: relatedTo(pages, page), origin: seo.mainUrl };
}

export async function guideBySlug(slug: string) {
  const seo = await loadSeo();
  if (!seo.flags.guides) return null;
  const clean = slugify(slug);
  const { pages } = await buildPages(seo);
  const page = pages.find((item) => item.slug === `guide/${clean}`);
  if (!page || !page.published) return null;
  const related = pages.filter((item) => item.kind === "guide" && item.published && item.slug !== page.slug).slice(0, 4).map((item) => ({ path: item.path, title: item.h1 || item.title }));
  return { seo: publicSettings(seo), page, related, origin: seo.mainUrl };
}

export async function publicHub() {
  const seo = await loadSeo();
  const { pages, grouped } = await buildPages(seo);
  const platforms = [];
  if (seo.flags.platformPages) {
    for (const [platform, kinds] of grouped) {
      const page = pages.find((item) => item.slug === `page/${platform}` && item.published && !item.noindex);
      if (!page) continue;
      const services = [...kinds.values()].flat();
      const cheapest = services.reduce((min, item) => Math.min(min, item.price), Number.POSITIVE_INFINITY);
      platforms.push({
        platform,
        path: page.path,
        title: page.h1 || page.title,
        count: services.length,
        cheapest: Number.isFinite(cheapest) ? cheapest : 0,
        kinds: [...kinds.entries()].map(([kind, list]) => {
          const child = pages.find((item) => item.slug === `page/${platform}/${kind}` && item.published && !item.noindex);
          if (!child) return null;
          return { kind, path: child.path, title: child.h1 || child.title, count: list.length };
        }).filter((item) => item != null),
      });
    }
  }
  const guides = seo.flags.guides
    ? pages.filter((page) => page.kind === "guide" && page.published && !page.noindex).map((page) => ({
      path: page.path,
      title: page.h1 || page.title,
      description: page.description,
      category: page.category,
    }))
    : [];
  const scored = scoreOf(seo, pages);
  return { seo: publicSettings(seo), platforms, guides, copy: scored.copy };
}

export async function resolveRedirect(pathname: string) {
  const sql = await ready();
  const rows = await sql<{ to_path: string }>`select to_path from seo_redirects where from_path = ${pathname} limit 1`;
  return rows[0]?.to_path || "";
}

type PageInput = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  body: string;
  published: boolean;
  noindex: boolean;
  canonical?: string;
  image?: string;
  faqs?: string;
  category?: string;
  tags?: string;
  author?: string;
  publishedAt?: string;
  newSlug?: string;
  silent?: boolean;
};

export async function savePage(input: PageInput) {
  const slug = clip(input.slug, 120);
  if (!/^(guide|page)\/[a-z0-9/-]{2,100}$/.test(slug)) throw new Error("Bad page slug.");
  let nextSlug = slug;
  if (input.newSlug && slug.startsWith("guide/")) {
    const renamed = `guide/${slugify(input.newSlug.replace(/^guide\//, ""))}`;
    if (renamed.length > 8 && renamed !== slug) nextSlug = renamed;
  }
  const sql = await ready();
  const title = clip(input.title, 180);
  const description = clip(input.description, 320);
  const h1 = clip(input.h1, 160);
  const body = block(input.body, 20000);
  const canonical = cleanUrl(input.canonical || "");
  const image = cleanUrl(input.image || "");
  const faqs = block(input.faqs, 4000);
  const category = clip(input.category, 60);
  const tags = clip(input.tags, 200);
  const author = clip(input.author, 80);
  const publishedAt = input.publishedAt && !Number.isNaN(new Date(input.publishedAt).getTime())
    ? new Date(input.publishedAt).toISOString()
    : null;
  if (nextSlug !== slug) {
    const from = `/smm-panel/guide/${slug.slice(6)}`;
    const to = `/smm-panel/guide/${nextSlug.slice(6)}`;
    await sql`
      insert into seo_redirects (from_path, to_path) values (${from}, ${to})
      on conflict (from_path) do update set to_path = ${to}, created_at = now()
    `;
    await sql`delete from seo_pages where slug = ${slug}`;
  }
  await sql`
    insert into seo_pages (slug, title, description, h1, body, published, noindex, canonical, image, faqs, category, tags, author, published_at, updated_at)
    values (${nextSlug}, ${title}, ${description}, ${h1}, ${body}, ${Boolean(input.published)}, ${Boolean(input.noindex)}, ${canonical}, ${image}, ${faqs}, ${category}, ${tags}, ${author}, ${publishedAt}, now())
    on conflict (slug) do update set
      title = ${title}, description = ${description}, h1 = ${h1}, body = ${body},
      published = ${Boolean(input.published)}, noindex = ${Boolean(input.noindex)},
      canonical = ${canonical}, image = ${image}, faqs = ${faqs}, category = ${category},
      tags = ${tags}, author = ${author}, published_at = ${publishedAt}, updated_at = now()
  `;
  if (!input.silent && input.published) {
    const seo = await loadSeo();
    if (seo.flags.indexNow && seo.mainUrl) {
      const path = nextSlug.startsWith("guide/") ? `/smm-panel/guide/${nextSlug.slice(6)}` : `/smm-panel/${nextSlug.slice(5)}`;
      await pushIndexNow(seo, [`${seo.mainUrl}${path}`]);
    }
  }
  return nextSlug;
}

export async function createGuide(input: { title: string; body: string }) {
  const title = clip(input.title, 180);
  const base = slugify(title);
  if (base.length < 3) throw new Error("Give the guide a longer title.");
  let slug = `guide/${base}`;
  const sql = await ready();
  const existing = await sql<{ slug: string }>`select slug from seo_pages where slug = ${slug}`;
  if (existing[0]) slug = `guide/${base}-${Date.now().toString(36)}`;
  await savePage({
    slug,
    title,
    description: block(input.body, 300),
    h1: title,
    body: input.body || title,
    published: false,
    noindex: true,
    category: "Guide",
    author: (await loadSeo()).panelName,
  });
  return slug;
}

export async function removePage(slug: string) {
  const clean = clip(slug, 120);
  if (!clean.startsWith("guide/")) throw new Error("Only guides can be deleted. Platform pages follow your services.");
  const sql = await ready();
  await sql`delete from seo_pages where slug = ${clean}`;
  const seo = await loadSeo();
  if (seo.flags.indexNow && seo.mainUrl) {
    await pushIndexNow(seo, [`${seo.mainUrl}/smm-panel/guide/${clean.slice(6)}`]);
  }
}

export async function bulkPlatforms(mode: "publish" | "hide" | "index" | "noindex") {
  const { pages } = await buildPages();
  for (const page of pages) {
    if (page.kind !== "platform") continue;
    await savePage({
      slug: page.slug,
      title: page.title,
      description: page.description,
      h1: page.h1,
      body: page.body,
      published: mode === "hide" ? false : mode === "publish" ? true : page.published,
      noindex: mode === "noindex" ? true : mode === "index" ? false : page.noindex,
      canonical: page.canonical,
      image: page.image,
      faqs: page.faqs,
      category: page.category,
      tags: page.tags,
      author: page.author,
      silent: true,
    });
  }
  const seo = await loadSeo();
  if (seo.flags.indexNow && (mode === "publish" || mode === "index")) return submitPublicUrls();
  return { ok: true, detail: "Platform page visibility saved." };
}

export function robotsText(origin: string, seo: SeoSettings) {
  const root = (seo.mainUrl || origin).replace(/\/$/, "");
  if (seo.robotsOverride.trim()) {
    const custom = seo.robotsOverride.trim();
    if (/sitemap:/i.test(custom)) return `${custom}\n`;
    return `${custom}\n\nSitemap: ${root}/sitemap.xml\n`;
  }
  return [
    "User-agent: *",
    "Allow: /",
    "Allow: /smm-panel",
    "Allow: /assets/",
    "Disallow: /admin",
    "Disallow: /dashboard",
    "Disallow: /wallet",
    "Disallow: /orders",
    "Disallow: /order",
    "Disallow: /settings",
    "Disallow: /login",
    "Disallow: /api/",
    "Disallow: /engagement-order",
    "Disallow: /engagement-orders",
    "Disallow: /single-order",
    "Disallow: /mass",
    "Disallow: /detect",
    "Disallow: /instagram",
    "Disallow: /tiktok",
    "Disallow: /telegram-bot",
    "Disallow: /support",
    "Disallow: /api-access",
    "",
    `Sitemap: ${root}/sitemap.xml`,
    "",
  ].join("\n");
}

export async function sitemapText(origin: string) {
  const seo = await loadSeo();
  const root = (seo.mainUrl || origin).replace(/\/$/, "");
  const { pages } = await buildPages(seo);
  const today = new Date().toISOString().slice(0, 10);
  const urls = [`/`];
  urls.push("/smm-panel");
  if (seo.flags.platformPages) {
    for (const page of pages) if (page.kind === "platform" && page.published && !page.noindex) urls.push(page.path);
  }
  if (seo.flags.guides) {
    urls.push("/smm-panel/guide");
    for (const page of pages) if (page.kind === "guide" && page.published && !page.noindex) urls.push(page.path);
  }
  const unique = [...new Set(urls)];
  const body = unique.map((path) => {
    const page = pages.find((item) => item.path === path);
    const loc = page?.canonical || `${root}${path}`;
    return `  <url><loc>${escapeXml(loc)}</loc><lastmod>${today}</lastmod><changefreq>${path.includes("/guide/") ? "weekly" : "daily"}</changefreq></url>`;
  }).join("\n");
  const sql = await ready();
  const stamp = new Date().toISOString();
  await sql`
    insert into desk_meta (key, value) values ('seo_sitemap_at', ${stamp})
    on conflict (key) do update set value = ${stamp}
  `;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&" + "amp;")
    .replaceAll("<", "&" + "lt;")
    .replaceAll(">", "&" + "gt;")
    .replaceAll('"', "&" + "quot;");
}

async function logIndex(ok: boolean, detail: string, urlCount: number) {
  const sql = await ready();
  const id = crypto.randomUUID();
  await sql`
    insert into seo_index_log (id, ok, detail, url_count) values (${id}, ${ok}, ${detail.slice(0, 500)}, ${urlCount})
  `;
}

export async function pushIndexNow(seo: SeoSettings, urls: string[]) {
  const clean = [...new Set(urls.map((url) => url.trim()).filter((url) => url.startsWith("http")))].slice(0, 100);
  if (!seo.indexNowKey || !seo.mainUrl || clean.length === 0) {
    const detail = "Set the main https URL and an IndexNow key first.";
    await logIndex(false, detail, clean.length);
    return { ok: false, detail };
  }
  let host = "";
  try {
    host = new URL(seo.mainUrl).host;
  } catch {
    const detail = "Main URL is not a valid address.";
    await logIndex(false, detail, clean.length);
    return { ok: false, detail };
  }
  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        host,
        key: seo.indexNowKey,
        keyLocation: `${seo.mainUrl}/seo-key/${seo.indexNowKey}`,
        urlList: clean,
      }),
      signal: AbortSignal.timeout(12000),
    });
    const detail = `IndexNow replied HTTP ${response.status}. That only means the submission was received. It does not mean Google or Bing indexed the page.`;
    const ok = response.ok || response.status === 202;
    await logIndex(ok, detail, clean.length);
    return { ok, detail };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "IndexNow request failed.";
    await logIndex(false, detail, clean.length);
    return { ok: false, detail };
  }
}

export async function submitPublicUrls(extra: string[] = []) {
  const seo = await loadSeo();
  const { pages } = await buildPages(seo);
  if (!seo.mainUrl) return { ok: false, detail: "Set the main website URL first." };
  const urls = [`${seo.mainUrl}/`, `${seo.mainUrl}/smm-panel`];
  for (const page of pages) if (page.published && !page.noindex) urls.push(`${seo.mainUrl}${page.path}`);
  for (const raw of extra) {
    const value = raw.trim();
    if (value.startsWith(seo.mainUrl)) urls.push(value);
  }
  return pushIndexNow(seo, urls);
}

export function freshIndexKey() {
  return crypto.randomUUID().replace(/-/g, "");
}

async function hit(url: string, path: string): Promise<ProbeHit> {
  const started = Date.now();
  try {
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000) });
    const text = await response.text();
    return {
      path,
      status: response.status,
      ms: Date.now() - started,
      encoding: response.headers.get("content-encoding") || "",
      cache: response.headers.get("cache-control") || "",
      bytes: text.length,
      error: "",
    };
  } catch (err) {
    return { path, status: 0, ms: Date.now() - started, encoding: "", cache: "", bytes: 0, error: err instanceof Error ? err.message : "Request failed" };
  }
}

export async function probeSite(origin: string) {
  const seo = await loadSeo();
  const root = (seo.mainUrl || origin || "").replace(/\/$/, "");
  if (!root.startsWith("http")) {
    return { ok: false, compressed: false, detail: "Set the main website URL, or open this page on the live site and test again.", hits: [] as ProbeHit[], root, at: new Date().toISOString() };
  }
  const hits = [];
  for (const path of ["/", "/robots.txt", "/sitemap.xml", "/smm-panel"]) {
    hits.push(await hit(`${root}${path === "/" ? "/" : path}`, path));
  }
  const compressed = hits.some((item) => /gzip|br|deflate/i.test(item.encoding));
  const home = hits[0];
  const ok = hits.every((item) => item.status >= 200 && item.status < 400);
  const detail = ok
    ? `All four addresses responded. Home was ${home.ms} ms${compressed ? " and compressed." : ". No gzip/brotli header was found."}`
    : `Some addresses failed. Home status ${home?.status || 0}${home?.error ? `: ${home.error}` : ""}.`;
  const probe: SiteProbe = { at: new Date().toISOString(), root, ok, compressed, detail, hits };
  const sql = await ready();
  const packed = JSON.stringify(probe);
  await sql`
    insert into desk_meta (key, value) values ('seo_probe', ${packed})
    on conflict (key) do update set value = ${packed}
  `;
  if (compressed && !seo.flags.hostCompression) await saveSeo({ flags: { ...seo.flags, hostCompression: true } });
  if (!compressed && seo.flags.hostCompression) await saveSeo({ flags: { ...seo.flags, hostCompression: false } });
  return probe;
}

export async function runAudit(origin: string) {
  const probe = await probeSite(origin);
  const desk = await seoDesk();
  const issues = desk.checks.filter((item) => item.level !== "pass").map((item) => ({
    id: item.id,
    severity: item.level,
    explanation: item.detail,
    label: item.label,
  }));
  const report = JSON.stringify({ score: desk.score, issues, probe });
  const sql = await ready();
  await sql`insert into seo_audits (id, score, report) values (${crypto.randomUUID()}, ${desk.score}, ${report})`;
  return { ...desk, probe };
}

export function buyTarget(slug: string) {
  const clean = slugify(slug);
  if (!clean.startsWith("buy-")) return null;
  const rest = clean.slice(4);
  const kindIds = ["reels", "followers", "likes", "views", "comments", "shares", "saves", "subscribers", "members", "plays", "services"];
  const kind = kindIds.find((id) => rest.endsWith(`-${id}`));
  if (!kind) return null;
  const platform = rest.slice(0, -(kind.length + 1)).replace(/-/g, "");
  if (!platform) return null;
  return { platform, kind: kind === "services" ? "other" : kind };
}
