import { readFileSync } from "node:fs";
import { dripEnabled } from "@/lib/drip-flag";
import { sellMarkupPaise, USD_TO_INR } from "@/lib/fx";

const FREE_MODELS = [
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "thinkingmachines/inkling-small:free",
];

type Secrets = { openrouter: string; yoyomedia: string };

export type LiveService = {
  id: number;
  platform: string;
  category: string;
  name: string;
  min: number;
  max: number;
  rateUsd: number;
  note: string;
  dripAllowed: boolean;
  averageMinutes?: number;
  serviceType?: string;
  managedId?: string;
  providerName?: string;
};

type RawService = {
  service: number | string;
  name: string;
  type?: string;
  category: string;
  rate: string | number;
  min: string | number;
  max: string | number;
  refill?: boolean;
  dripfeed?: boolean | number | string;
  drip_feed?: boolean | number | string;
  description?: string;
};

type ProviderLine = {
  engagement_type: string;
  quantity: number;
  runs?: number;
  intervalMinutes?: number;
  serviceId?: string;
  apiUrl?: string;
  apiKey?: string;
};
export type PlacedLine = { engagement_type: string; providerOrderId: string; label: string };

let catalogCache: { at: number; rows: RawService[] } | null = null;
let balanceCache: { at: number; balanceUsd: number; currency: string } | null = null;

function secrets(): Secrets {
  const fromEnv = {
    openrouter: process.env.OPENROUTER_API_KEY || "",
    yoyomedia: process.env.YOYOMEDIA_API_KEY || "",
  };
  if (fromEnv.openrouter && fromEnv.yoyomedia) return fromEnv;
  const candidates = [
    process.env.PROVIDERS_FILE || "",
    `${process.cwd()}/.secrets/providers.json`,
    "/workspace/.secrets/providers.json",
  ].filter(Boolean);
  let file: Secrets = { openrouter: "", yoyomedia: "" };
  for (const path of candidates) {
    try {
      file = JSON.parse(readFileSync(path, "utf8")) as Secrets;
      break;
    } catch {
      /* try the next location */
    }
  }
  return {
    openrouter: fromEnv.openrouter || file.openrouter,
    yoyomedia: fromEnv.yoyomedia || file.yoyomedia,
  };
}

async function yoyo(fields: Record<string, string>, apiUrl?: string, apiKey?: string) {
  const sent = await yoyoRaw(fields, apiUrl, apiKey);
  if (fields.action === "add") {
    if (!sent.order) throw new Error(sent.error || "Provider rejected the order.");
    return { order: sent.order } as Record<string, unknown>;
  }
  if (sent.error && !sent.raw.trim().startsWith("[") && !sent.raw.trim().startsWith("{")) {
    throw new Error(sent.error);
  }
  try {
    return JSON.parse(sent.raw) as Record<string, unknown>;
  } catch {
    throw new Error(sent.error || "Provider returned an unreadable response.");
  }
}

export const NO_PROVIDER = "No Provider Available";

const catalogMemo = new Map<string, { at: number; rows: RawService[] }>();

async function yoyoRaw(fields: Record<string, string>, apiUrl?: string, apiKey?: string) {
  const key = String(apiKey || "").trim();
  const url = String(apiUrl || "").trim();
  if (!key || !url) return { order: "", error: NO_PROVIDER, raw: "" };
  const body = new URLSearchParams({ key, ...fields });
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const raw = await response.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { order: "", error: raw.slice(0, 180) || `HTTP ${response.status}`, raw };
    }
    const order = json.order != null && String(json.order) !== "" && String(json.order) !== "0" ? String(json.order) : "";
    const error = typeof json.error === "string" && json.error ? json.error : "";
    return { order, error, raw };
  } catch (error) {
    return { order: "", error: error instanceof Error ? error.message : "Network error", raw: "" };
  }
}

export function readRemains(status: string, remains: string) {
  const text = String(status || "").toLowerCase();
  if (text.includes("complete") && !text.includes("progress")) return 0;
  const raw = String(remains ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Math.max(0, value);
}

export function deliveryPhase(status: string) {
  const live = String(status || "").trim().toLowerCase();
  if (!live || live === "unknown") return "unknown" as const;
  if (/cancel|fail|refund/.test(live)) return "closed" as const;
  if (live.includes("partial")) return "partial" as const;
  if (live.includes("complete")) return "complete" as const;
  if (/in[\s-]*progress|processing|\bprogress\b/.test(live)) return "running" as const;
  if (/pending|await|queue/.test(live)) return "pending" as const;
  return "unknown" as const;
}

export function providerPhase(status: string) {
  const live = String(status || "").toLowerCase();
  if (/cancel|fail|refund/.test(live)) return "closed" as const;
  if (live.includes("partial")) return "partial" as const;
  if (live.includes("complete")) return "complete" as const;
  return "open" as const;
}

const keyBalance = new Map<string, { at: number; amount: number; currency: string }>();

export async function keyedProviderBalance(apiUrl?: string, apiKey?: string) {
  const url = String(apiUrl || "").trim();
  const key = String(apiKey || "").trim();
  if (!url || !key) return null;
  const cacheKey = `${url}|${key}`;
  const hit = keyBalance.get(cacheKey);
  if (hit && Date.now() - hit.at < 45_000) return hit;
  try {
    const json = await yoyo({ action: "balance" }, url, key);
    const amount = Number(json.balance);
    const row = { at: Date.now(), amount: Number.isFinite(amount) ? amount : 0, currency: String(json.currency || "USD") };
    keyBalance.set(cacheKey, row);
    return row;
  } catch {
    return null;
  }
}

function affordable(balance: number, rate: number, quantity: number) {
  if (balance <= 0) return false;
  if (rate <= 0) return balance >= 0.01;
  return balance + 1e-9 >= (quantity / 1000) * rate;
}

export async function providerOrderStatus(orderId: string, apiUrl?: string, apiKey?: string) {
  const json = await yoyo({ action: "status", order: orderId }, apiUrl, apiKey);
  return {
    status: String(json.status || "unknown"),
    remains: String(json.remains ?? ""),
    startCount: String(json.start_count ?? ""),
  };
}

export async function fetchProviderCatalog(apiUrl?: string, apiKey?: string) {
  const url = String(apiUrl || "").trim();
  const key = String(apiKey || "").trim();
  const cacheKey = `${url}|${key}`;
  const hit = catalogMemo.get(cacheKey);
  if (hit && Date.now() - hit.at < 60_000) return hit.rows;
  const rows = (await yoyo({ action: "services" }, url, key)) as unknown as RawService[];
  if (!Array.isArray(rows)) throw new Error("Provider did not return a service list.");
  catalogMemo.set(cacheKey, { at: Date.now(), rows });
  return rows;
}

export function detectPlatform(category: string, name: string) {
  const text = `${name} ${category}`.toLowerCase();
  if (/instagram|\binsta\b|\bigtv\b/.test(text)) return "instagram";
  if (/tik\s?tok|musical\.?ly/.test(text)) return "tiktok";
  if (/you\s?tube|\byt\b/.test(text)) return "youtube";
  if (/facebook|\bfb\b/.test(text)) return "facebook";
  if (/twitter|retweet/.test(text)) return "twitter";
  if (/telegram|\btg\b/.test(text)) return "telegram";
  if (/whats\s?app/.test(text)) return "whatsapp";
  if (/spotify/.test(text)) return "spotify";
  if (/linkedin/.test(text)) return "linkedin";
  if (/discord/.test(text)) return "discord";
  if (/twitch/.test(text)) return "twitch";
  if (/snapchat|\bsnap\b/.test(text)) return "snapchat";
  if (/kwai/.test(text)) return "kwai";
  return "other";
}

export async function savedProviderKeys() {
  const { bindingMap } = await import("@/lib/admin.server");
  const map = await bindingMap();
  const found: { apiUrl: string; apiKey: string }[] = [];
  for (const slot of Object.values(map)) {
    for (const item of slot.providers || []) {
      const apiKey = String(item.api_key || "").trim();
      const apiUrl = String(item.api_url || "").trim();
      if (!apiKey || !apiUrl) continue;
      if (found.some((row) => row.apiKey === apiKey && row.apiUrl === apiUrl)) continue;
      found.push({ apiUrl, apiKey });
    }
  }
  return found;
}

async function rawServices() {
  if (catalogCache && Date.now() - catalogCache.at < 60_000) return catalogCache.rows;
  const keys = await savedProviderKeys();
  if (keys.length === 0) return [] as RawService[];
  const merged: RawService[] = [];
  for (const key of keys) {
    try {
      const rows = await fetchProviderCatalog(key.apiUrl, key.apiKey);
      for (const row of rows) merged.push(row);
    } catch {
      /* skip a provider that does not answer */
    }
  }
  catalogCache = { at: Date.now(), rows: merged };
  return merged;
}

function toLive(row: RawService): LiveService {
  const note = String(row.description || "").trim();
  return {
    id: Number(row.service),
    platform: detectPlatform(row.category, row.name),
    category: row.category,
    name: row.name,
    min: Number(row.min) || 1,
    max: Number(row.max) || 1,
    rateUsd: ((Number(row.rate) || 0) * USD_TO_INR * 100 + sellMarkupPaise(row.service)) / (USD_TO_INR * 100),
    note: note.slice(0, 4000),
    dripAllowed: dripEnabled(row.dripfeed ?? row.drip_feed),
    averageMinutes: averageMinutes(row) ?? 0,
    serviceType: String(row.type || ""),
  };
}

export async function providerBalance() {
  if (balanceCache && Date.now() - balanceCache.at < 60 * 1000) return balanceCache;
  const keys = await savedProviderKeys();
  const first = keys[0];
  if (!first) return { at: Date.now(), balanceUsd: 0, currency: "USD" };
  const json = await yoyo({ action: "balance" }, first.apiUrl, first.apiKey);
  balanceCache = { at: Date.now(), balanceUsd: Number(json.balance) || 0, currency: String(json.currency || "USD") };
  return balanceCache;
}

export type ApiBalance = {
  label: string;
  host: string;
  keyTail: string;
  balance: number;
  currency: string;
  low: boolean;
  error: string;
};

function shortBalanceError(message: string) {
  const text = message.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const named = text.match(/40[0-9] [^<\s][^.]{0,40}|50[0-9] [^<\s][^.]{0,40}|not allowed|unauthorized|forbidden|not found/i);
  return (named ? named[0] : text).slice(0, 80) || "Balance failed";
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url.slice(0, 42);
  }
}

export async function listApiBalances(): Promise<ApiBalance[]> {
  const found: { label: string; apiUrl: string; apiKey: string }[] = [];
  const push = (label: string, apiUrl?: string | null, apiKey?: string | null) => {
    const url = String(apiUrl || "").trim();
    const key = String(apiKey || "").trim();
    if (!url || !key) return;
    const existing = found.find((item) => item.apiUrl === url && item.apiKey === key);
    if (existing) {
      if (!existing.label.includes(label)) existing.label = `${existing.label} · ${label}`;
      return;
    }
    found.push({ label, apiUrl: url, apiKey: key });
  };
  const allowed = /^(instagram|tiktok):(views|likes|saves|shares|reposts|comments)$/;
  try {
    const { listBindings } = await import("@/lib/admin.server");
    const rows = await listBindings();
    for (const row of rows) {
      if (!allowed.test(row.slot)) continue;
      const providers = (row.providers || []).filter((item) => item.api_url.trim() && item.api_key.trim());
      providers.forEach((item, index) => push(providers.length > 1 ? `${row.slot} #${index + 1}` : row.slot, item.api_url, item.api_key));
    }
  } catch {
    /* bindings optional */
  }
  const rows = await Promise.all(found.map(async (item) => {
    try {
      const json = await yoyo({ action: "balance" }, item.apiUrl, item.apiKey);
      const balance = Number(json.balance);
      const amount = Number.isFinite(balance) ? balance : 0;
      return {
        label: item.label,
        host: hostOf(item.apiUrl),
        keyTail: item.apiKey.slice(-4),
        balance: amount,
        currency: String(json.currency || "USD"),
        low: amount < 5,
        error: "",
      };
    } catch (error) {
      return {
        label: item.label,
        host: hostOf(item.apiUrl),
        keyTail: item.apiKey.slice(-4),
        balance: 0,
        currency: "",
        low: true,
        error: shortBalanceError(error instanceof Error ? error.message : "Balance failed"),
      };
    }
  }));
  return rows.sort((a, b) => Number(a.error !== "") - Number(b.error !== "") || a.balance - b.balance);
}

export async function listSingleOrderBalances() {
  const { listProviders } = await import("@/lib/admin.server");
  const providers = (await listProviders()).filter((item) => item.enabled && item.api_url.trim() && item.api_key.trim());
  return Promise.all(providers.map(async (item) => {
    try {
      const json = await yoyo({ action: "balance" }, item.api_url, item.api_key);
      const balance = Number(json.balance);
      const amount = Number.isFinite(balance) ? balance : 0;
      return {
        id: item.id,
        name: item.name,
        host: hostOf(item.api_url),
        balance: amount,
        currency: String(json.currency || "USD"),
        low: amount < 5,
        error: "",
      };
    } catch (error) {
      return {
        id: item.id,
        name: item.name,
        host: hostOf(item.api_url),
        balance: 0,
        currency: "",
        low: true,
        error: shortBalanceError(error instanceof Error ? error.message : "Balance failed"),
      };
    }
  }));
}

export async function browseProvider(input: { platform: string; category: string; query: string }) {
  const rows = (await rawServices()).map(toLive).filter((row) => input.platform === "all" || row.platform === input.platform);
  const names = Array.from(new Set(rows.map((row) => row.category))).sort((a, b) => a.localeCompare(b));
  const categories = ["All categories", ...names];
  const category = categories.includes(input.category) ? input.category : "All categories";
  const query = input.query.trim().toLowerCase();
  let services = category === "All categories" ? rows : rows.filter((row) => row.category === category);
  if (query) services = rows.filter((row) => `${row.id} ${row.name} ${row.category}`.toLowerCase().includes(query));
  return { categories, category, services };
}

export async function findLiveService(id: number) {
  const row = (await rawServices()).find((item) => Number(item.service) === id);
  return row ? toLive(row) : null;
}

const TYPE_RULE: Record<string, { yes: RegExp; no: RegExp }> = {
  views: { yes: /\bviews?\b/, no: /\b(likes?|shares?|saves?|favourites?|favorites?|comments?|followers?|reposts?|subscribers?)\b/ },
  likes: { yes: /\blikes?\b/, no: /\b(views?|shares?|saves?|favourites?|favorites?|comments?|followers?|reposts?|subscribers?|live)\b/ },
  comments: { yes: /\bcomments?\b/, no: /\b(views?|likes?|shares?|saves?|favourites?|favorites?|followers?|reposts?|live)\b/ },
  shares: { yes: /\bshares?\b/, no: /\b(views?|likes?|saves?|favourites?|favorites?|comments?|followers?|live)\b/ },
  saves: { yes: /\b(saves?|favourites?|favorites?)\b/, no: /\b(views?|likes?|shares?|comments?|followers?|reposts?|live)\b/ },
  reposts: { yes: /\breposts?\b/, no: /\b(views?|likes?|shares?|saves?|favourites?|favorites?|comments?|followers?|live)\b/ },
  followers: { yes: /\bfollowers?\b/, no: /\b(views?|likes?|shares?|saves?|favourites?|favorites?|comments?|reposts?)\b/ },
};

export async function pickRandomService(platform: string, type: string, quantity: number, apiUrl?: string, apiKey?: string) {
  const rows = await fetchProviderCatalog(apiUrl, apiKey);
  const rule = TYPE_RULE[type] || { yes: new RegExp(`\\b${type}\\b`, "i"), no: /$^/ };
  const candidates = rows.filter((row) => {
    if (detectPlatform(row.category, row.name) !== platform) return false;
    if (row.type && row.type !== "Default") return false;
    const name = String(row.name || "").toLowerCase();
    if (!rule.yes.test(name) || rule.no.test(name)) return false;
    if (/combo|package|\+|free /.test(name)) return false;
    if (serviceTier(row, type) === "reject") return false;
    const min = Number(row.min);
    const max = Number(row.max);
    return quantity >= min && quantity <= max;
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const tier = (row: RawService) => (serviceTier(row, type) === "good" ? 1 : 0);
    const speed = (row: RawService) => averageMinutes(row) ?? 100000;
    const rank = (row: RawService) => guaranteeRank(`${row.name || ""} ${row.category || ""} ${row.description || ""}`.toLowerCase());
    return tier(b) - tier(a) || rank(b) - rank(a) || speed(a) - speed(b) || stableScore(b, type) - stableScore(a, type) || Number(a.rate) - Number(b.rate);
  });
  const choice = candidates[0];
  return { serviceId: String(choice.service), name: String(choice.name) };
}

type DropRead = { nonDrop: boolean; unknown: boolean; maxPct: number | null; noRefill: boolean };

function readDrop(text: string): DropRead {
  const nonDrop = /non[-\s]?drop|no[-\s]?drop|nondrop|drop\s*:\s*non\s*drop/.test(text);
  const unknown = /drop\s*:\s*unknown/.test(text);
  const noRefill = /no[-\s]?refill|without refill|non[-\s]?refill/.test(text);
  let maxPct: number | null = null;
  for (const match of text.matchAll(/drop\s*:\s*(\d+(?:\.\d+)?)\s*(?:-|–|to)?\s*(\d+(?:\.\d+)?)?\s*%/gi)) {
    const low = Number(match[1]);
    const high = match[2] ? Number(match[2]) : low;
    const top = Math.max(low, high);
    if (Number.isFinite(top)) maxPct = maxPct == null ? top : Math.max(maxPct, top);
  }
  return { nonDrop, unknown, maxPct, noRefill };
}

function flags(text: string) {
  const nonDrop = /non[-\s]?drop|no[-\s]?drop|nondrop|\bnd\b|zero[-\s]?drop|no\s*loss/.test(text);
  const guaranteed = /100\s*%\s*guaranteed|lifetime\s*guarantee|\bguaranteed\b/.test(text);
  const stable = /\bstable\b|high\s*quality|high\s*retention/.test(text);
  const instantStart = /instant\s*start|immediate\s*start|0\s*[-–to]{1,3}\s*5\s*min/.test(text);
  const fast = /fast\s*start|instant\s*delivery|\binstant\b/.test(text);
  return { nonDrop, guaranteed, stable, instantStart, fast };
}

const GUARANTEE_TYPES = ["views", "likes", "shares", "saves", "comments", "reposts"];

function minutesOf(value: string): number | null {
  const text = value.toLowerCase().trim();
  if (!text || /not enough|unknown|n\/a|null/.test(text)) return null;
  let total = 0;
  let seen = false;
  const day = text.match(/(\d+(?:\.\d+)?)\s*d/);
  const hour = text.match(/(\d+(?:\.\d+)?)\s*h/);
  const min = text.match(/(\d+(?:\.\d+)?)\s*m/);
  if (day) { total += Number(day[1]) * 1440; seen = true; }
  if (hour) { total += Number(hour[1]) * 60; seen = true; }
  if (min) { total += Number(min[1]); seen = true; }
  if (seen) return total > 0 ? total : null;
  const plain = Number(text);
  if (!Number.isFinite(plain) || plain <= 0) return null;
  return plain;
}

export function averageMinutes(row: RawService): number | null {
  const bag = row as RawService & Record<string, unknown>;
  const raw = bag.average_time ?? bag.avg_time ?? bag.averageTime ?? bag.average ?? bag.avg ?? "";
  const fromField = minutesOf(String(raw ?? ""));
  if (fromField != null) return fromField;
  const text = `${row.name || ""} ${row.description || ""}`.toLowerCase();
  const written = text.match(/average(?:\s*completion)?\s*time[^0-9]{0,16}(\d+(?:\.\d+)?)(?:\s*(h(?:ours?|rs?)?|m(?:inutes?|in)?|d(?:ays?)?))/);
  if (!written) return null;
  const unit = written[2] || "m";
  const amount = Number(written[1]);
  if (!(amount > 0)) return null;
  if (unit.startsWith("d")) return amount * 1440;
  if (unit.startsWith("h")) return amount * 60;
  return amount;
}

function hasRequiredGuarantee(text: string) {
  return guaranteeRank(text) > 0;
}

function guaranteeRank(text: string): 0 | 1 | 2 {
  const clean = text.replace(/not\s+guaranteed|no\s+guaranteed|non[-\s]?guaranteed|without\s+guarantee/g, " ");
  if (/lifetime\s+guarante/.test(clean)) return 2;
  if (/30\s*days?\s*guarante/.test(clean)) return 1;
  if (/\bguaranteed\b/.test(clean)) return 2;
  return 0;
}

function rejectedService(text: string, nonDrop: boolean) {
  if (/high\s*drops?/.test(text)) return true;
  if (/refill\s*only/.test(text) && !nonDrop) return true;
  if (/slow\s*start|delayed\s*start|gradual\s*delivery|drip\s*feed/.test(text)) return true;
  if (/\bunknown\b|\bunstable\b|low\s*quality/.test(text)) return true;
  if (/start\s*:?\s*(12|24)\s*(h|hr|hrs|hour|hours)\b/.test(text)) return true;
  if (hasDropAmount(text)) return true;
  return false;
}

function hasDropAmount(text: string) {
  const plain = text
    .replace(/drops?\s*[:=]?\s*non\s*drops?/g, " ")
    .replace(/non[-\s]?drops?|no[-\s]?drops?|nondrops?|zero[-\s]?drops?/g, " ");
  const patterns = [
    /(\d+(?:\.\d+)?)(?:\s*(?:-|–|to|\/)\s*(\d+(?:\.\d+)?))?\s*%?\s*drops?/g,
    /drops?\s*[:=-]?\s*(\d+(?:\.\d+)?)(?:\s*(?:-|–|to|\/)\s*(\d+(?:\.\d+)?))?\s*%?/g,
  ];
  for (const pattern of patterns) {
    for (const match of plain.matchAll(pattern)) {
      const low = Number(match[1]);
      const high = match[2] ? Number(match[2]) : low;
      if (Math.max(low, high) > 0) return true;
    }
  }
  return /\bdrops?\b/.test(plain);
}

function qualifiedScore(text: string) {
  if (!hasRequiredGuarantee(text)) return 0;
  const mark = flags(text);
  if (rejectedService(text, mark.nonDrop)) return 0;
  let score = 100;
  if (mark.instantStart || /0\s*[-–to]{1,3}\s*5\s*min/.test(text)) score += 900;
  else if (/\binstant\b|instant\s*delivery|immediate\s*start/.test(text)) score += 800;
  else if (mark.fast || /fast\s*start|0\s*[-–to]{1,3}\s*(10|15|30)\s*min/.test(text)) score += 500;
  else if (/start\s*:?\s*0\s*[-–to]{1,3}\s*1\s*h/.test(text)) score += 280;
  if (/lifetime\s*guarante/.test(text)) score += 60;
  if (mark.nonDrop) score += 80;
  if (mark.guaranteed) score += 40;
  if (mark.stable) score += 20;
  return score;
}

function qualityScore(text: string, refillFlag: boolean, type?: string) {
  if (type && GUARANTEE_TYPES.includes(type)) return qualifiedScore(text);
  let score = 0;
  if (/non[-\s]?drop|no[-\s]?drop|nondrop|drop\s*:\s*non\s*drop/.test(text)) score += 100;
  if (/\bstable\b/.test(text)) score += 80;
  if (/guaranteed|guarantee/.test(text)) score += 70;
  if (/\brefill\b/.test(text) || refillFlag) score += 40;
  return score;
}

/** Views, likes, shares, saves, comments, and reposts require Guaranteed or Lifetime Guaranteed. */
export function serviceTier(row: RawService, type?: string): "good" | "soft" | "reject" {
  const text = `${row.name || ""} ${row.category || ""} ${row.description || ""}`.toLowerCase();
  const watched = Boolean(type && GUARANTEE_TYPES.includes(type));
  if (watched) {
    const mark = flags(text);
    if (!hasRequiredGuarantee(text)) return "reject";
    if (/no[-\s]?refill|without refill|non[-\s]?refill/.test(text)) return "reject";
    if (rejectedService(text, mark.nonDrop)) return "reject";
    return "good";
  }
  const info = readDrop(text);
  if (info.noRefill || info.unknown) return "reject";
  if (info.maxPct != null && info.maxPct > 15) return "reject";
  const quality = qualityScore(text, Boolean(row.refill), type);
  if (quality > 0) return "good";
  if (info.maxPct != null && info.maxPct >= 10 && info.maxPct <= 15) return "soft";
  return "reject";
}

function stableScore(row: RawService, type?: string) {
  if (serviceTier(row, type) === "reject") return 0;
  const text = `${row.name || ""} ${row.category || ""} ${row.description || ""}`.toLowerCase();
  return qualityScore(text, Boolean(row.refill), type) || (serviceTier(row, type) === "soft" ? 1 : 0);
}

function matchService(rows: RawService[], platform: string, type: string, quantity: number, preferDrip = false) {
  const rule = TYPE_RULE[type] || { yes: new RegExp(`\\b${type}\\b`, "i"), no: /$^/ };
  const candidates = rows.filter((row) => {
    if (detectPlatform(row.category, row.name) !== platform) return false;
    if (row.type && row.type !== "Default") return false;
    const name = String(row.name || "").toLowerCase();
    if (!rule.yes.test(name) || rule.no.test(name)) return false;
    if (/combo|package|\+|free /.test(name)) return false;
    if (serviceTier(row, type) === "reject") return false;
    const min = Number(row.min);
    const max = Number(row.max);
    return quantity >= min && quantity <= max;
  });
  candidates.sort((a, b) => {
    const tier = (row: RawService) => (serviceTier(row, type) === "good" ? 1 : 0);
    const speed = (row: RawService) => averageMinutes(row) ?? 100000;
    const rank = (row: RawService) => guaranteeRank(`${row.name || ""} ${row.category || ""} ${row.description || ""}`.toLowerCase());
    return tier(b) - tier(a) || rank(b) - rank(a) || speed(a) - speed(b) || stableScore(b, type) - stableScore(a, type) || Number(a.rate) - Number(b.rate);
  });
  const pool = preferDrip && candidates.some((row) => dripEnabled(row.dripfeed ?? row.drip_feed))
    ? candidates.filter((row) => dripEnabled(row.dripfeed ?? row.drip_feed))
    : candidates;
  return pool[0] || null;
}

type RoutedChoice = {
  id: string;
  name: string;
  score: number;
  tier: "good" | "soft";
  rate: number;
  apiUrl: string;
  apiKey: string;
  ms: number;
  fresh: boolean;
  pending: number;
  reusedService: boolean;
  active: number;
  minutes: number;
  rank: number;
};

export async function placeChunk(input: {
  platform: string;
  type: string;
  link: string;
  quantity: number;
  providers?: { apiUrl?: string; apiKey?: string }[];
  apiUrl?: string;
  apiKey?: string;
  usedKeys?: string[];
  usedServiceIds?: Record<string, string[]>;
  pendingByKey?: Record<string, number>;
  activeByService?: Record<string, number>;
  serviceLimit?: number;
  rateMinUsd?: number;
  rateMaxUsd?: number;
}) {
  const qtyAsked = Math.max(1, Math.floor(input.quantity));
  let qty = qtyAsked;
  const providers = (input.providers?.length ? input.providers : [{ apiUrl: input.apiUrl, apiKey: input.apiKey }])
    .map((item) => ({ apiUrl: String(item.apiUrl || "").trim(), apiKey: String(item.apiKey || "").trim() }))
    .filter((item) => item.apiKey && item.apiUrl);
  if (providers.length === 0) throw new Error(NO_PROVIDER);
  const rule = TYPE_RULE[input.type] || { yes: new RegExp(`\\b${input.type}\\b`, "i"), no: /$^/ };
  const used = new Set((input.usedKeys || []).map((key) => key.trim()).filter(Boolean));
  const pendingByKey = input.pendingByKey || {};
  const usedServices = input.usedServiceIds || {};
  const activeByService = input.activeByService || {};
  const limit = Math.max(1, Math.floor(input.serviceLimit || 1));
  const minUsd = Number(input.rateMinUsd) > 0 ? Number(input.rateMinUsd) : 0;
  const maxUsd = Number(input.rateMaxUsd) > 0 ? Number(input.rateMaxUsd) : 0;
  const priced = minUsd > 0 || maxUsd > 0;
  const rateOk = (rate: number) => {
    if (!priced) return true;
    if (!Number.isFinite(rate) || rate <= 0) return false;
    if (minUsd > 0 && rate + 1e-9 < minUsd) return false;
    if (maxUsd > 0 && rate - 1e-9 > maxUsd) return false;
    return true;
  };
  const scans = await Promise.all(providers.map(async (provider) => {
    const started = Date.now();
    try {
      const rows = await fetchProviderCatalog(provider.apiUrl, provider.apiKey);
      return { provider, rows, ms: Date.now() - started };
    } catch (error) {
      const message = error instanceof Error ? error.message : "catalog failed";
      console.log(`[drops] catalog skip ${provider.apiUrl}: ${message}`);
      return { provider, rows: [] as RawService[], ms: Date.now() - started };
    }
  }));
  const choices: RoutedChoice[] = [];
  for (const scan of scans) {
    const fresh = !used.has(scan.provider.apiKey);
    const pending = pendingByKey[scan.provider.apiKey] ?? 0;
    const seen = new Set(usedServices[scan.provider.apiKey] || []);
    for (const row of scan.rows) {
      if (detectPlatform(row.category, row.name) !== input.platform) continue;
      if (row.type && String(row.type).toLowerCase() !== "default") continue;
      const label = String(row.name || "").toLowerCase();
      const blob = `${row.name || ""} ${row.category || ""}`.toLowerCase();
      if (!rule.yes.test(blob) || rule.no.test(label)) continue;
      if (/combo|package|\+|free /.test(label)) continue;
      const tier = serviceTier(row, input.type);
      const min = Number(row.min) || 0;
      const max = Number(row.max) || 0;
      if (qty < min || (max > 0 && qty > max)) continue;
      if (tier === "reject") continue;
      const rate = Number(row.rate) || 0;
      if (!rateOk(rate)) continue;
      const id = String(row.service);
      const active = activeByService[`${scan.provider.apiKey}::${id}`] || 0;
      choices.push({
        id,
        name: String(row.name || `Service ${row.service}`),
        score: stableScore(row, input.type),
        tier,
        rate,
        apiUrl: scan.provider.apiUrl,
        apiKey: scan.provider.apiKey,
        ms: scan.ms,
        fresh,
        pending,
        reusedService: seen.has(id),
        active,
        minutes: averageMinutes(row) ?? 100000,
        rank: guaranteeRank(`${row.name || ""} ${row.category || ""} ${row.description || ""}`.toLowerCase()) || 2,
      });
    }
  }
  const noise = new Map(choices.map((choice) => [choice, Math.random()]));
  const ranked = [...choices].sort((a, b) => {
    const aFree = a.active < limit ? 0 : 1;
    const bFree = b.active < limit ? 0 : 1;
    if (aFree !== bFree) return aFree - bFree;
    if (a.tier !== b.tier) return a.tier === "good" ? -1 : 1;
    if (a.rank !== b.rank) return b.rank - a.rank;
    if (a.minutes !== b.minutes) return a.minutes - b.minutes;
    if (b.score !== a.score) return b.score - a.score;
    if (a.active !== b.active) return a.active - b.active;
    if (a.reusedService !== b.reusedService) return a.reusedService ? 1 : -1;
    if (a.rate !== b.rate) return a.rate - b.rate;
    return (noise.get(a) || 0) - (noise.get(b) || 0);
  });
  const unique: RoutedChoice[] = [];
  for (const choice of ranked) {
    if (unique.some((item) => item.apiKey === choice.apiKey && item.id === choice.id)) continue;
    unique.push(choice);
    if (unique.length === 12) break;
  }
  if (unique.length === 0 && !GUARANTEE_TYPES.includes(input.type)) {
    for (const scan of scans) {
      const fresh = !used.has(scan.provider.apiKey);
      const pending = pendingByKey[scan.provider.apiKey] ?? 0;
      const seen = new Set(usedServices[scan.provider.apiKey] || []);
      for (const row of scan.rows) {
        if (detectPlatform(row.category, row.name) !== input.platform) continue;
        const label = String(row.name || "").toLowerCase();
        const blob = `${row.name || ""} ${row.category || ""}`.toLowerCase();
        if (!rule.yes.test(blob) || rule.no.test(label)) continue;
        if (/combo|package|\+|free /.test(label)) continue;
        const min = Number(row.min) || 0;
        const max = Number(row.max) || 0;
        if (qty < min || (max > 0 && qty > max)) continue;
        const rate = Number(row.rate) || 0;
        if (!rateOk(rate)) continue;
        const id = String(row.service);
        const active = activeByService[`${scan.provider.apiKey}::${id}`] || 0;
        choices.push({
          id,
          name: String(row.name || `Service ${row.service}`),
          score: 1,
          tier: "soft",
          rate,
          apiUrl: scan.provider.apiUrl,
          apiKey: scan.provider.apiKey,
          ms: scan.ms,
          fresh,
          pending,
          reusedService: seen.has(id),
          active,
          minutes: averageMinutes(row) ?? 100000,
          rank: 2,
        });
      }
    }
  }
  if (choices.length > ranked.length) {
    ranked.length = 0;
    ranked.push(...[...choices].sort((a, b) => {
      const aFree = a.active < limit ? 0 : 1;
      const bFree = b.active < limit ? 0 : 1;
      if (aFree !== bFree) return aFree - bFree;
      if (a.minutes !== b.minutes) return a.minutes - b.minutes;
      if (a.active !== b.active) return a.active - b.active;
      if (a.rate !== b.rate) return a.rate - b.rate;
      return (noise.get(a) || Math.random()) - (noise.get(b) || 0);
    }));
    unique.length = 0;
    for (const choice of ranked) {
      if (unique.some((item) => item.apiKey === choice.apiKey && item.id === choice.id)) continue;
      unique.push(choice);
      if (unique.length === 12) break;
    }
  }
  if (unique.length === 0) {
    let lowest = 0;
    for (const scan of scans) {
      for (const row of scan.rows) {
        if (detectPlatform(row.category, row.name) !== input.platform) continue;
        const blob = `${row.name || ""} ${row.category || ""}`.toLowerCase();
        const label = String(row.name || "").toLowerCase();
        if (!rule.yes.test(blob) || rule.no.test(label)) continue;
        const min = Number(row.min) || 0;
        if (min > lowest) lowest = min;
      }
    }
    const hint = lowest > qty ? ` Lowest ${input.type} minimum on the connected API is ${lowest}.` : "";
    const rangeNote = priced ? " No service inside the saved price range matched." : "";
    const guaranteeNote = GUARANTEE_TYPES.includes(input.type) ? " Guaranteed, Lifetime Guaranteed, or 30 Days Guaranteed is required." : "";
    throw new Error(`No suitable ${input.platform} ${input.type} service accepts quantity ${qty}.${hint}${rangeNote}${guaranteeNote}`);
  }
  const primary = unique.filter((item) => item.rank >= 2);
  const backup = unique.filter((item) => item.rank === 1);
  const primaryOpen = primary.filter((item) => item.active < limit);
  const backupOpen = backup.filter((item) => item.active < limit);
  const pull = (list: RoutedChoice[], count: number, into: RoutedChoice[]) => {
    for (const choice of list) {
      if (into.some((item) => item.apiKey === choice.apiKey && item.id === choice.id)) continue;
      into.push(choice);
      if (into.filter((item) => list.includes(item)).length >= count) break;
    }
  };
  const queue: RoutedChoice[] = [];
  if (primaryOpen.length) {
    pull(primaryOpen, 3, queue);
    pull(backupOpen.length ? backupOpen : backup, 2, queue);
  } else if (backupOpen.length) {
    pull(backupOpen, 3, queue);
  } else {
    pull(primary, 3, queue);
    pull(backup, 2, queue);
  }
  console.log(`[drops] ${input.type} x${qty} queue: ${queue.slice(0, 3).map((item) => `#${item.id} ${item.fresh ? "fresh" : "return"} ${item.tier} ${item.name}`).join(" | ")}`);
  let last = "Provider rejected the order.";
  const tryChoice = async (choice: RoutedChoice) => {
    const balance = await keyedProviderBalance(choice.apiUrl, choice.apiKey);
    if (balance && !affordable(balance.amount, choice.rate, qty)) {
      last = `hold: API balance ${balance.amount} ${balance.currency} is too low for ${qty} ${input.type}`;
      console.log(`[drops] #${choice.id} held: ${last}`);
      return null;
    }
    const sent = await yoyoRaw({
      action: "add",
      service: choice.id,
      link: input.link.trim(),
      quantity: String(qty),
    }, choice.apiUrl, choice.apiKey);
    if (sent.order) {
      console.log(`[drops] placed once on #${choice.id} via ${choice.apiUrl}. Other APIs were not used.`);
      return { orderId: sent.order, serviceId: choice.id, label: choice.name, apiUrl: choice.apiUrl, apiKey: choice.apiKey, quantity: qty };
    }
    last = sent.error || last;
    console.log(`[drops] #${choice.id} refused, trying next eligible only: ${last}`);
    return null;
  };
  for (const choice of queue) {
    const placed = await tryChoice(choice);
    if (placed) return placed;
  }
  if (/^hold: API balance/i.test(last)) throw new Error(last);
  const step = input.type === "views" ? 100 : 0;
  if (step > 1 && /multiples of/i.test(last)) {
    const snapped = Math.floor(qty / step) * step;
    if (snapped >= step && snapped !== qty) {
      qty = snapped;
      last = "Provider rejected the order.";
      for (const choice of queue) {
        const placed = await tryChoice(choice);
        if (placed) return placed;
      }
    }
  }
  throw new Error(last);
}

async function cancelOrders(ids: string[]) {
  await Promise.all(ids.map(async (id) => {
    try {
      await yoyo({ action: "cancel", order: id });
    } catch {
      /* provider may reject cancel; the caller still surfaces the original error */
    }
  }));
}

export async function placeProviderLines(platform: string, link: string, lines: ProviderLine[]): Promise<PlacedLine[]> {
  const placed: PlacedLine[] = [];
  try {
    for (const line of lines) {
      if (!line.apiKey || !line.apiUrl) throw new Error(NO_PROVIDER);
      const sent = await placeChunk({
        platform,
        type: line.engagement_type,
        link,
        quantity: line.quantity,
        providers: [{ apiUrl: line.apiUrl, apiKey: line.apiKey }],
      });
      placed.push({
        engagement_type: line.engagement_type,
        providerOrderId: sent.orderId,
        label: sent.label,
      });
    }
    return placed;
  } catch (error) {
    await cancelOrders(placed.map((line) => line.providerOrderId));
    throw error;
  }
}

export async function placeExactOnProvider(input: {
  serviceId: string;
  link: string;
  quantity: number;
  apiUrl?: string;
  apiKey?: string;
  extra?: Record<string, string>;
}) {
  let quantity = Math.max(1, Math.floor(input.quantity));
  const balance = await keyedProviderBalance(input.apiUrl, input.apiKey);
  if (balance && balance.amount <= 0) throw new Error(`hold: API balance ${balance.amount} ${balance.currency} is too low for this run`);
  const fields = (qty: number) => {
    const body: Record<string, string> = {
      action: "add",
      service: String(input.serviceId),
      link: input.link.trim(),
      quantity: String(qty),
    };
    for (const [key, value] of Object.entries(input.extra || {})) {
      const text = String(value || "").trim();
      if (text) body[key] = text;
    }
    return body;
  };
  let sent = await yoyoRaw(fields(quantity), input.apiUrl, input.apiKey);
  const step = Number(String(sent.error || "").match(/multiples of\s*(\d+)/i)?.[1] || 0);
  if (!sent.order && step > 1) {
    const snapped = Math.floor(quantity / step) * step;
    if (snapped >= step && snapped !== quantity) {
      quantity = snapped;
      sent = await yoyoRaw(fields(quantity), input.apiUrl, input.apiKey);
    }
  }
  if (!sent.order) {
    const problem = /quantity|multiple|minimal|minimum/i.test(sent.error || "");
    if (problem) {
      for (const extra of [1, 2]) {
        const retryQty = quantity + extra;
        const retry = await yoyoRaw(fields(retryQty), input.apiUrl, input.apiKey);
        if (retry.order) return { orderId: retry.order, serviceId: String(input.serviceId), quantity: retryQty };
        sent = retry;
      }
    }
  }
  if (!sent.order) throw new Error(sent.error || "Provider rejected this order.");
  return { orderId: sent.order, serviceId: String(input.serviceId), quantity };
}

export async function placeExactService() {
  throw new Error(NO_PROVIDER);
}

export async function liveRateMap() {
  const keys = await savedProviderKeys();
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const extra = await sql<{ api_url: string; api_key: string }>`select api_url, api_key from smm_providers where enabled = true`;
    for (const row of extra) {
      const apiUrl = String(row.api_url || "").trim();
      const apiKey = String(row.api_key || "").trim();
      if (!apiUrl || !apiKey) continue;
      if (keys.some((item) => item.apiKey === apiKey && item.apiUrl === apiUrl)) continue;
      keys.push({ apiUrl, apiKey });
    }
  } catch {
    /* managed provider table can be empty */
  }
  const map: Record<string, number> = {};
  for (const key of keys) {
    try {
      const rows = await fetchProviderCatalog(key.apiUrl, key.apiKey);
      for (const row of rows) {
        const id = String(row.service);
        const rate = Number(row.rate) || 0;
        if (rate > 0 && (map[id] == null || rate < map[id])) map[id] = rate;
      }
    } catch {
      /* one provider can be down */
    }
  }
  return map;
}

export async function liveTypeRates(platform: string) {
  const { bindingMap } = await import("@/lib/admin.server");
  const map = await bindingMap();
  const rates: Record<string, number> = {};
  for (const type of ["views", "likes", "saves", "shares", "reposts", "comments"]) {
    const slot = map[`${platform}:${type}`];
    const providers = (slot?.providers || []).filter((item) => item.api_key && item.api_url);
    let best = 0;
    for (const provider of providers) {
      try {
        const rows = await fetchProviderCatalog(provider.api_url, provider.api_key);
        for (const row of rows) {
          if (detectPlatform(row.category, row.name) !== platform) continue;
          if (serviceTier(row, type) !== "good") continue;
          const rule = TYPE_RULE[type];
          const name = String(row.name || "").toLowerCase();
          if (!rule?.yes.test(name) || rule.no.test(name)) continue;
          const rate = Number(row.rate) || 0;
          if (rate > 0 && (best === 0 || rate < best)) best = rate;
        }
      } catch {
        /* one provider can be down */
      }
    }
    if (best > 0) rates[type] = best;
  }
  return rates;
}

export async function cancelProviderOrder(id: string, apiUrl?: string, apiKey?: string) {
  if (apiUrl && apiKey) {
    await yoyoRaw({ action: "cancel", order: id }, apiUrl, apiKey);
    return;
  }
  await cancelOrders([id]);
}

export async function askFreeModel(system: string, prompt: string) {
  const key = secrets().openrouter;
  if (!key) throw new Error("OpenRouter key is missing.");
  let last = "The free model did not answer.";
  for (const model of FREE_MODELS) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://127.0.0.1:8080",
          "X-Title": "Magiciansmm",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          max_tokens: 400,
          temperature: 0.2,
        }),
      });
      const json = (await response.json()) as {
        error?: { message?: string };
        choices?: { message?: { content?: string | null; reasoning?: string | null } }[];
      };
      if (!response.ok) throw new Error(json.error?.message || `${model} failed.`);
      const message = json.choices?.[0]?.message;
      const text = (message?.content || message?.reasoning || "").trim();
      if (!text) throw new Error(`${model} returned an empty reply.`);
      return text;
    } catch (error) {
      last = error instanceof Error ? error.message : last;
    }
  }
  throw new Error(last);
}
