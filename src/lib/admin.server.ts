import { averageMinutes, detectPlatform, fetchProviderCatalog, keyedProviderBalance } from "@/lib/providers.server";
import { sellMarkupMajor, USD_TO_INR, usdQtyToPaise } from "@/lib/fx";
import { getSql } from "@/lib/db";
import { dripEnabled } from "@/lib/drip-flag";
import { PROVIDER_MIN } from "@/lib/organic";

export const BINDING_SLOTS = ["views", "likes", "saves", "shares", "reposts", "single"] as const;

export type ProviderKey = { api_url: string; api_key: string };

export type Binding = {
  slot: string;
  api_url: string;
  api_key: string;
  service_id: string;
  pick_mode: string;
  pinned_ids: string[];
  min_quantity: number;
  price_per_1k_paise: number;
  rate_min_units: number;
  rate_max_units: number;
  section_enabled: boolean;
  providers: ProviderKey[];
};

const PLATFORMS = ["instagram", "tiktok"] as const;
const TYPES = ["views", "likes", "saves", "shares", "reposts", "comments"] as const;
const ENGAGEMENT_SLOTS = PLATFORMS.flatMap((platform) => TYPES.map((type) => `${platform}:${type}`));

export async function deskRole(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ role: string }>`select role from user_roles where user_id = ${userId} limit 1`;
  return rows[0]?.role === "admin" ? "admin" : "customer";
}

export async function requireAdmin(userId: string) {
  if ((await deskRole(userId)) !== "admin") throw new Error("Admin only.");
}

export async function bindingMap() {
  const rows = await listBindings();
  return Object.fromEntries(
    rows.filter((row) => row.section_enabled === false || row.api_key || row.providers?.some((item) => item.api_key)).map((row) => [row.slot, row]),
  ) as Record<string, Binding>;
}

function readPins(raw: unknown): string[] {
  const text = String(raw || "");
  let values: string[] = [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) values = parsed.map((item) => String(item || ""));
  } catch {
    values = text.split(/[\s,]+/);
  }
  const seen = new Set<string>();
  const pins: string[] = [];
  for (const item of values) {
    const id = item.replace(/[^\d]/g, "").slice(0, 20);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    pins.push(id);
    if (pins.length === 12) break;
  }
  return pins;
}

function defaultMin(slot: string) {
  const type = slot.includes(":") ? slot.split(":")[1] : slot;
  return PROVIDER_MIN[type] ?? 10;
}

function parseProviders(raw: string, fallbackUrl: string, fallbackKey: string): ProviderKey[] {
  let parsed: ProviderKey[] = [];
  try {
    const value = JSON.parse(raw || "[]");
    if (Array.isArray(value)) {
      parsed = value
        .map((item) => ({
          api_url: String(item?.api_url || "").trim(),
          api_key: String(item?.api_key || "").trim(),
        }))
        .filter((item) => item.api_key);
    }
  } catch {
    parsed = [];
  }
  if (parsed.length === 0 && fallbackKey.trim() && fallbackUrl.trim()) {
    parsed = [{ api_url: fallbackUrl.trim(), api_key: fallbackKey.trim() }];
  }
  return parsed;
}

export async function serviceActiveLimit() {
  const sql = await getSql();
  await sql`create table if not exists desk_meta (key text primary key, value text not null default '')`;
  const rows = await sql<{ value: string }>`select value from desk_meta where key = 'service_active_limit' limit 1`;
  const parsed = Math.floor(Number(rows[0]?.value));
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

export async function saveServiceActiveLimit(value: number) {
  const sql = await getSql();
  await sql`create table if not exists desk_meta (key text primary key, value text not null default '')`;
  const next = Math.max(1, Math.min(20, Math.floor(value) || 1));
  await sql`
    insert into desk_meta (key, value) values ('service_active_limit', ${String(next)})
    on conflict (key) do update set value = ${String(next)}
  `;
  return next;
}

export async function listBindings() {
  const sql = await getSql();
  await sql`alter table provider_bindings add column if not exists price_per_1k_paise integer not null default 0`;
  await sql`alter table provider_bindings add column if not exists section_enabled boolean not null default true`;
  await sql`alter table provider_bindings add column if not exists pinned_ids text not null default ''`;
  await sql`alter table provider_bindings add column if not exists rate_min_units integer not null default 0`;
  await sql`alter table provider_bindings add column if not exists rate_max_units integer not null default 0`;
  const rows = await sql<Binding & { providers_json?: string; pinned_ids?: string }>`
    select slot, api_url, api_key, service_id, coalesce(pick_mode, 'auto') as pick_mode,
           coalesce(pinned_ids, '') as pinned_ids,
           coalesce(min_quantity, 0)::int as min_quantity,
           coalesce(price_per_1k_paise, 0)::int as price_per_1k_paise,
           coalesce(rate_min_units, 0)::int as rate_min_units,
           coalesce(rate_max_units, 0)::int as rate_max_units,
           coalesce(section_enabled, true) as section_enabled,
           coalesce(providers_json, '') as providers_json
    from provider_bindings
  `;
  const map = Object.fromEntries(rows.map((row) => [row.slot, row]));
  const slots = [...ENGAGEMENT_SLOTS, "single"];
  return slots.map((slot) => {
    const row = map[slot];
    const fallback = defaultMin(slot);
    if (!row) {
      return { slot, api_url: "", api_key: "", service_id: "", pick_mode: "auto", pinned_ids: [] as string[], min_quantity: fallback, price_per_1k_paise: 0, rate_min_units: 0, rate_max_units: 0, section_enabled: !slot.endsWith(":comments"), providers: [] as ProviderKey[] };
    }
    const providers = parseProviders(row.providers_json || "", row.api_url, row.api_key);
    const first = providers[0];
    const mode = row.pick_mode === "ids" ? "ids" : "auto";
    return {
      ...row,
      api_url: first?.api_url || row.api_url || "",
      api_key: first?.api_key || row.api_key,
      pick_mode: mode,
      pinned_ids: readPins(row.pinned_ids),
      service_id: "",
      min_quantity: row.min_quantity > 0 ? row.min_quantity : fallback,
      price_per_1k_paise: Math.max(0, Number(row.price_per_1k_paise) || 0),
      rate_min_units: Math.max(0, Number(row.rate_min_units) || 0),
      rate_max_units: Math.max(0, Number(row.rate_max_units) || 0),
      section_enabled: row.section_enabled !== false,
      providers,
    };
  });
}

export async function panelTypeRates(platform: string) {
  const rows = await listBindings();
  const rates: Record<string, number> = {};
  for (const type of TYPES) {
    const row = rows.find((item) => item.slot === `${platform}:${type}`);
    if (row && row.price_per_1k_paise > 0) rates[type] = row.price_per_1k_paise;
  }
  return rates;
}

export async function saveBindings(rows: Binding[]) {
  const sql = await getSql();
  await sql`alter table provider_bindings add column if not exists price_per_1k_paise integer not null default 0`;
  await sql`alter table provider_bindings add column if not exists section_enabled boolean not null default true`;
  await sql`alter table provider_bindings add column if not exists pinned_ids text not null default ''`;
  await sql`alter table provider_bindings add column if not exists rate_min_units integer not null default 0`;
  await sql`alter table provider_bindings add column if not exists rate_max_units integer not null default 0`;
  const allowed = new Set([...ENGAGEMENT_SLOTS, "single"]);
  for (const row of rows) {
    if (!allowed.has(row.slot)) continue;
    const providers = (row.providers || [])
      .map((item) => ({
        api_url: String(item.api_url || "").trim().slice(0, 200),
        api_key: String(item.api_key || "").trim().slice(0, 200),
      }))
      .filter((item) => item.api_key && item.api_url)
      .slice(0, 8);
    const first = providers[0];
    const url = first?.api_url || "";
    const key = first?.api_key || "";
    const minQuantity = Math.max(1, Math.floor(Number(row.min_quantity) || defaultMin(row.slot)));
    const price = Math.max(0, Math.round(Number(row.price_per_1k_paise) || 0));
    const open = row.section_enabled !== false;
    const packed = JSON.stringify(providers);
    const mode = row.slot === "single" || row.pick_mode !== "ids" ? "auto" : "ids";
    const pins = JSON.stringify(readPins(row.pinned_ids));
    let rateMin = Math.max(0, Math.min(2000000000, Math.round(Number(row.rate_min_units) || 0)));
    let rateMax = Math.max(0, Math.min(2000000000, Math.round(Number(row.rate_max_units) || 0)));
    if (rateMin > 0 && rateMax > 0 && rateMin > rateMax) {
      const swap = rateMin;
      rateMin = rateMax;
      rateMax = swap;
    }
    await sql`
      insert into provider_bindings (slot, api_url, api_key, service_id, pick_mode, min_quantity, price_per_1k_paise, providers_json, section_enabled, pinned_ids, rate_min_units, rate_max_units)
      values (${row.slot}, ${url}, ${key}, '', ${mode}, ${minQuantity}, ${price}, ${packed}, ${open}, ${pins}, ${rateMin}, ${rateMax})
      on conflict (slot) do update set
        api_url = ${url}, api_key = ${key}, service_id = '', pick_mode = ${mode},
        min_quantity = ${minQuantity}, price_per_1k_paise = ${price}, providers_json = ${packed},
        section_enabled = ${open}, pinned_ids = ${pins},
        rate_min_units = ${rateMin}, rate_max_units = ${rateMax}
    `;
  }
}

export type SmmProvider = {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
  enabled: boolean;
  last_error: string;
  last_sync: string | null;
  currency: string;
};

export async function listProviders() {
  const sql = await getSql();
  return sql<SmmProvider>`
    select id, name, api_url, api_key, enabled, last_error, last_sync::text as last_sync,
           coalesce(currency, '') as currency
    from smm_providers
    order by name
  `;
}

export async function saveProvider(input: { id?: string; name: string; api_url: string; api_key: string; enabled: boolean }) {
  const sql = await getSql();
  const id = input.id || crypto.randomUUID();
  const name = input.name.trim().slice(0, 60);
  const url = input.api_url.trim().slice(0, 200);
  const key = input.api_key.trim().slice(0, 200);
  if (!name || !url || !key) throw new Error("Name, API URL and API key are required.");
  await sql`
    insert into smm_providers (id, name, api_url, api_key, enabled)
    values (${id}, ${name}, ${url}, ${key}, ${input.enabled})
    on conflict (id) do update set name = ${name}, api_url = ${url}, api_key = ${key}, enabled = ${input.enabled}
  `;
  return id;
}

export async function deleteProvider(id: string) {
  const sql = await getSql();
  const providerId = String(id || "").trim();
  if (!providerId) throw new Error("Missing provider.");
  await sql`delete from managed_services where provider_row_id = ${providerId}`;
  clearLiveCatalog();
  const removed = await sql<{ id: string }>`delete from smm_providers where id = ${providerId} returning id`;
  if (removed.length === 0) throw new Error("Provider not found.");
}

export async function providerKeys(providerRowId: string) {
  if (!providerRowId) return null;
  const sql = await getSql();
  const rows = await sql<{ api_url: string; api_key: string }>`
    select api_url, api_key from smm_providers where id = ${providerRowId} and enabled = true limit 1
  `;
  return rows[0] ?? null;
}

async function writeCatalog(providerRowId: string, rows: Awaited<ReturnType<typeof fetchProviderCatalog>>) {
  const sql = await getSql();
  const known = await sql<{ provider_service_id: string; customized: boolean }>`
    select provider_service_id, customized from managed_services where provider_row_id = ${providerRowId}
  `;
  const locked = new Set(known.filter((row) => row.customized).map((row) => row.provider_service_id));
  const fresh = rows.filter((row) => !locked.has(String(row.service)));
  const chunk = 40;
  for (let start = 0; start < rows.length; start += chunk) {
    const slice = rows.slice(start, start + chunk);
    const values: unknown[] = [];
    const groups = slice.map((row, index) => {
      const providerId = String(row.service);
      const base = values.length;
      values.push(
        crypto.randomUUID(),
        providerId,
        providerRowId,
        detectPlatform(String(row.category || ""), String(row.name || "")),
        String(row.category || "").slice(0, 300),
        String(row.name || "").slice(0, 500),
        String(row.description || "").slice(0, 4000),
        String(row.type || "").slice(0, 80),
        Math.max(0, Math.round(averageMinutes(row) || 0)),
        Math.min(2_000_000_000, Math.max(1, Math.floor(Number(row.rate) ? usdQtyToPaise(Number(row.rate) || 0, 1000) : 1))),
        Math.min(2_000_000_000, Math.max(1, Math.floor(Number(row.min) || 1))),
        Math.min(2_000_000_000, Math.max(1, Math.floor(Number(row.max) || 1))),
        dripEnabled(row.dripfeed ?? row.drip_feed),
        start + index,
      );
      const slot = Array.from({ length: 14 }, (_, index) => `$${base + index + 1}`);
      return `(${slot[0]}, 'api', ${slot.slice(1).join(", ")}, true, false)`;
    });
    await sql.query(
      `insert into managed_services (
        id, source, provider_service_id, provider_row_id, platform, category, name, description,
        service_type, average_minutes, price_per_1k_paise, min_quantity, max_quantity, drip_allowed, sort_index, enabled, customized
      ) values ${groups.join(", ")}
      on conflict (provider_row_id, provider_service_id) do update set
        name = excluded.name,
        category = excluded.category,
        platform = excluded.platform,
        description = excluded.description,
        service_type = excluded.service_type,
        average_minutes = excluded.average_minutes,
        price_per_1k_paise = case when managed_services.customized then managed_services.price_per_1k_paise else excluded.price_per_1k_paise end,
        min_quantity = excluded.min_quantity,
        max_quantity = excluded.max_quantity,
        drip_allowed = excluded.drip_allowed,
        sort_index = excluded.sort_index,
        enabled = case when managed_services.listed = false then false else true end,
        updated_at = now()`,
      values,
    );
  }
  const liveIds = rows.map((row) => String(row.service));
  if (providerRowId && liveIds.length > 0) {
    await sql`
      delete from managed_services
      where provider_row_id = ${providerRowId}
        and source = 'api'
        and not (provider_service_id = any(${liveIds}::text[]))
    `;
  }
  clearLiveCatalog();
  return { total: rows.length, added: fresh.length, updated: fresh.length };
}

function clearLiveCatalog() {
  delete (globalThis as { __liveCatalog?: unknown }).__liveCatalog;
}

export async function syncProviderCatalog(providerId: string) {
  const sql = await getSql();
  const rows = await sql<{ api_url: string; api_key: string; enabled: boolean }>`
    select api_url, api_key, enabled from smm_providers where id = ${providerId} limit 1
  `;
  const provider = rows[0];
  if (!provider) throw new Error("Provider not found.");
  if (!provider.enabled) throw new Error("Turn the provider on before fetching.");
  try {
    const catalog = await fetchProviderCatalog(provider.api_url, provider.api_key);
    const balance = await keyedProviderBalance(provider.api_url, provider.api_key);
    const currency = String(balance?.currency || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8);
    const result = await writeCatalog(providerId, catalog);
    await sql`update smm_providers set last_sync = now(), last_error = '', currency = case when ${currency} = '' then currency else ${currency} end where id = ${providerId}`;
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fetch failed.";
    await sql`update smm_providers set last_error = ${message.slice(0, 240)} where id = ${providerId}`;
    throw error;
  }
}

export async function syncManagedServices() {
  const providers = (await listProviders()).filter((row) => row.enabled);
  if (providers.length === 0) {
    const single = (await listBindings()).find((row) => row.slot === "single");
    const rows = await fetchProviderCatalog(single?.api_url || undefined, single?.api_key || undefined);
    return writeCatalog("", rows);
  }
  let total = 0;
  let added = 0;
  let updated = 0;
  for (const provider of providers) {
    const result = await syncProviderCatalog(provider.id);
    total += result.total;
    added += result.added;
    updated += result.updated;
  }
  return { total, added, updated };
}

let catalogSync: Promise<void> | null = null;
let checkedEmptyAverage = false;

/** Pull every provider again when the last fetch is older than 1 hour. */
export function ensureCatalogFresh() {
  if (catalogSync) return catalogSync;
  catalogSync = (async () => {
    const sql = await getSql();
    const providers = (await listProviders()).filter((row) => row.enabled);
    let stale = providers.some((row) => !row.last_sync || !row.currency || Date.now() - new Date(row.last_sync).getTime() > 60 * 60 * 1000);
    if (!stale) {
      const ranked = await sql<{ n: number; ranked: number }>`
        select count(*)::int as n, count(*) filter (where sort_index > 0)::int as ranked from managed_services
      `;
      if ((ranked[0]?.n || 0) > 1 && (ranked[0]?.ranked || 0) === 0) stale = true;
    }
    if (!stale && !checkedEmptyAverage && providers.length > 0) {
      checkedEmptyAverage = true;
      const count = await sql<{ filled: number; total: number }>`
        select count(*) filter (where average_minutes > 0)::int as filled, count(*)::int as total
        from managed_services where enabled = true and source = 'api'
      `;
      if ((count[0]?.total || 0) > 0 && (count[0]?.filled || 0) === 0) stale = true;
    }
    if (!stale) return;
    await syncManagedServices();
  })().finally(() => {
    catalogSync = null;
  });
  return catalogSync;
}

export type ManagedService = {
  id: string;
  source: string;
  provider_service_id: string;
  platform: string;
  category: string;
  name: string;
  description: string;
  service_type?: string;
  average_minutes?: number;
  price_per_1k_paise: number;
  min_quantity: number;
  max_quantity: number;
  drip_allowed: boolean;
  enabled: boolean;
  listed?: boolean;
};

export async function listManaged(query = "") {
  const sql = await getSql();
  const rows = await sql<ManagedService>`
    select id, source, provider_service_id, platform, category, name, description,
           price_per_1k_paise, min_quantity, max_quantity, drip_allowed, enabled, coalesce(listed, true) as listed
    from managed_services
    order by sort_index asc, category, name
  `;
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? rows.filter((row) => `${row.provider_service_id} ${row.name} ${row.category} ${row.platform}`.toLowerCase().includes(needle))
    : rows;
  return { total: rows.length, services: filtered.slice(0, 80) };
}

export async function setServiceListed(id: string, listed: boolean) {
  const sql = await getSql();
  const on = Boolean(listed);
  const rows = await sql<{ id: string }>`
    update managed_services
    set listed = ${on}, enabled = ${on}, updated_at = now()
    where id = ${id}
    returning id
  `;
  if (!rows.length) throw new Error("Service not found.");
  clearLiveCatalog();
}

export async function saveManaged(input: Omit<ManagedService, "source">) {
  const sql = await getSql();
  await sql`
    update managed_services
    set name = ${input.name.slice(0, 180)},
        category = ${input.category.slice(0, 160)},
        platform = ${input.platform.slice(0, 32)},
        description = ${input.description.slice(0, 500)},
        price_per_1k_paise = ${Math.max(1, Math.floor(input.price_per_1k_paise))},
        min_quantity = ${Math.max(1, Math.floor(input.min_quantity))},
        max_quantity = ${Math.max(1, Math.floor(input.max_quantity))},
        drip_allowed = ${Boolean(input.drip_allowed)},
        enabled = ${Boolean(input.enabled)},
        listed = ${Boolean(input.enabled)},
        customized = true,
        updated_at = now()
    where id = ${input.id}
  `;
  clearLiveCatalog();
}

export async function addCustomService(input: Omit<ManagedService, "id" | "source">) {
  const sql = await getSql();
  const id = crypto.randomUUID();
  await sql`
    insert into managed_services (
      id, source, provider_service_id, platform, category, name, description,
      price_per_1k_paise, min_quantity, max_quantity, drip_allowed, enabled, customized
    ) values (
      ${id}, 'custom', ${input.provider_service_id.slice(0, 40)}, ${input.platform.slice(0, 32)},
      ${input.category.slice(0, 160)}, ${input.name.slice(0, 180)}, ${input.description.slice(0, 500)},
      ${Math.max(1, Math.floor(input.price_per_1k_paise))}, ${Math.max(1, Math.floor(input.min_quantity))},
      ${Math.max(1, Math.floor(input.max_quantity))}, ${Boolean(input.drip_allowed)}, ${Boolean(input.enabled)}, true
    )
  `;
  return id;
}

/** One FX read, then a fast markup for every service. */
export async function loadMarkup() {
  const { base, rates } = await ratesForBase();
  return (currency: string, seed: string | number) => {
    const major = sellMarkupMajor(seed);
    const code = String(currency || base || "INR").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8) || base;
    if (code === base) return major * 100;
    const perBase = Number(rates[code]) || 0;
    if (!(perBase > 0)) {
      if (code === "USD") return Math.round(major * USD_TO_INR * 100);
      return major * 100;
    }
    return Math.max(1, Math.round((major / perBase) * 100));
  };
}

/** 8, 9, or 10 of the provider's own currency, stored as base minor units. PKR panel adds PKR. INR panel adds INR. */
export async function catalogMarkupMinor(currency: string, seed: string | number) {
  const markup = await loadMarkup();
  return markup(currency, seed);
}

export function managedToLive(row: ManagedService, extraMinor = 0) {
  return {
    id: Number(row.provider_service_id) || 0,
    platform: row.platform,
    category: row.category,
    name: row.name,
    min: row.min_quantity,
    max: row.max_quantity,
    rateUsd: (row.price_per_1k_paise + Math.max(0, Math.round(extraMinor))) / (USD_TO_INR * 100),
    note: row.description,
    serviceType: row.service_type || "",
    averageMinutes: Math.max(0, Math.floor(Number(row.average_minutes) || 0)),
    dripAllowed: Boolean(row.drip_allowed),
    managedId: row.id,
    providerName: (row as ManagedService & { provider_name?: string }).provider_name || "",
  };
}

export async function enabledCatalog() {
  const sql = await getSql();
  const count = await sql<{ n: number }>`select count(*)::int as n from managed_services`;
  if (!count[0]?.n) return null;
  const rows = await sql<ManagedService & { provider_name: string }>`
    select m.id, m.source, m.provider_service_id, m.platform, m.category, m.name, m.description,
           coalesce(m.service_type, '') as service_type, m.average_minutes, m.price_per_1k_paise, m.min_quantity, m.max_quantity, m.drip_allowed, m.enabled,
           coalesce(p.name, '') as provider_name, coalesce(p.currency, '') as provider_currency
    from managed_services m
    left join smm_providers p on p.id = m.provider_row_id
    where m.enabled = true and coalesce(m.listed, true) = true
    order by m.sort_index asc, m.category, m.name
  `;
  return rows;
}

export async function findManagedById(id: string) {
  const sql = await getSql();
  const rows = await sql<ManagedService & { provider_row_id: string }>`
    select id, source, provider_service_id, provider_row_id, platform, category, name, description,
           price_per_1k_paise, min_quantity, max_quantity, drip_allowed, enabled
    from managed_services
    where id = ${id}
    limit 1
  `;
  return rows[0] ?? null;
}

export async function findManagedByProviderId(providerServiceId: string) {
  const sql = await getSql();
  const rows = await sql<ManagedService & { provider_row_id: string }>`
    select id, source, provider_service_id, provider_row_id, platform, category, name, description,
           price_per_1k_paise, min_quantity, max_quantity, drip_allowed, enabled
    from managed_services
    where provider_service_id = ${providerServiceId} and enabled = true
    order by updated_at desc
    limit 1
  `;
  return rows[0] ?? null;
}

let accessTableReady = false;

async function ensureAccessTable(sql: Awaited<ReturnType<typeof getSql>>) {
  if (accessTableReady) return;
  await sql`
    create table if not exists user_access (
      user_id text primary key references "user" (id) on delete cascade,
      suspended boolean not null default false,
      blocked boolean not null default false,
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists email_lock (
      email text primary key,
      suspended boolean not null default false,
      blocked boolean not null default false,
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists panel_gate (
      id text primary key,
      auth_open boolean not null default true
    )
  `;
  await sql`insert into panel_gate (id, auth_open) values ('desk', true) on conflict (id) do nothing`;
  await sql`
    insert into email_lock (email, suspended, blocked)
    select lower(u.email), a.suspended, a.blocked
    from user_access a
    join "user" u on u.id = a.user_id
    where u.email <> ''
    on conflict (email) do update set
      suspended = email_lock.suspended or excluded.suspended,
      blocked = email_lock.blocked or excluded.blocked,
      updated_at = now()
  `;
  try {
    await sql`create unique index if not exists user_email_lower_idx on "user" (lower(email))`;
  } catch {
    /* existing mixed-case duplicates stay until cleaned; signup still checks lower(email) */
  }
  accessTableReady = true;
}

export async function lockedEmail(email: string) {
  const sql = await getSql();
  await ensureAccessTable(sql);
  const needle = String(email || "").trim().toLowerCase();
  if (!needle) return "" as const;
  const rows = await sql<{ suspended: boolean; blocked: boolean }>`
    select suspended, blocked from email_lock where email = ${needle} limit 1
  `;
  if (rows[0]?.blocked) return "blocked" as const;
  if (rows[0]?.suspended) return "suspended" as const;
  return "" as const;
}

export async function authOpen() {
  const sql = await getSql();
  await ensureAccessTable(sql);
  const rows = await sql<{ auth_open: boolean }>`select auth_open from panel_gate where id = 'desk' limit 1`;
  return rows[0]?.auth_open !== false;
}

export async function setAuthOpen(open: boolean) {
  const sql = await getSql();
  await ensureAccessTable(sql);
  await sql`
    insert into panel_gate (id, auth_open) values ('desk', ${open})
    on conflict (id) do update set auth_open = ${open}
  `;
  if (!open) {
    await sql`delete from session where "userId" not in (select user_id from user_roles where role = 'admin')`;
  }
  return { open };
}

async function isAdminUser(sql: Awaited<ReturnType<typeof getSql>>, userId: string) {
  const role = await sql<{ role: string }>`select role from user_roles where user_id = ${userId} limit 1`;
  return role[0]?.role === "admin";
}

export async function assertCustomerEntry(input: { userId?: string; email?: string; creating?: boolean }) {
  const sql = await getSql();
  await ensureAccessTable(sql);
  const email = String(input.email || "").trim().toLowerCase();
  const admin = input.userId ? await isAdminUser(sql, input.userId) : false;
  if (!(await authOpen()) && !admin) throw new Error("Login and registration are closed.");
  if (email) {
    const locked = await sql<{ suspended: boolean; blocked: boolean }>`
      select suspended, blocked from email_lock where email = ${email} limit 1
    `;
    if (locked[0]?.blocked) throw new Error("You are blocked");
    if (locked[0]?.suspended) throw new Error("You are suspended");
    if (input.creating) {
      const existing = await sql<{ id: string }>`select id from "user" where lower(email) = ${email} limit 1`;
      if (existing[0]) throw new Error("An account with this email already exists. Sign in instead.");
    }
  }
  if (input.userId && !admin) {
    const lock = await customerLock(input.userId);
    if (lock === "blocked") throw new Error("You are blocked");
    if (lock === "suspended") throw new Error("You are suspended");
  }
}

export async function customerLock(userId: string) {
  const sql = await getSql();
  await ensureAccessTable(sql);
  const rows = await sql<{ suspended: boolean; blocked: boolean }>`
    select suspended, blocked from user_access where user_id = ${userId} limit 1
  `;
  if (rows[0]?.blocked) return "blocked" as const;
  if (rows[0]?.suspended) return "suspended" as const;
  return "" as const;
}

export async function toggleCustomerAccess(actorId: string, userId: string, kind: "suspended" | "blocked") {
  if (actorId === userId) throw new Error("You cannot change your own access.");
  const sql = await getSql();
  await ensureAccessTable(sql);
  const role = await sql<{ role: string }>`select role from user_roles where user_id = ${userId} limit 1`;
  if (role[0]?.role === "admin") throw new Error("Admin accounts cannot be suspended or blocked.");
  const current = await sql<{ suspended: boolean; blocked: boolean }>`
    select suspended, blocked from user_access where user_id = ${userId} limit 1
  `;
  const suspended = kind === "suspended" ? !current[0]?.suspended : Boolean(current[0]?.suspended);
  const blocked = kind === "blocked" ? !current[0]?.blocked : Boolean(current[0]?.blocked);
  const found = await sql<{ email: string }>`select lower(email) as email from "user" where id = ${userId} limit 1`;
  const email = String(found[0]?.email || "").trim().toLowerCase();
  await sql`
    insert into user_access (user_id, suspended, blocked)
    values (${userId}, ${suspended}, ${blocked})
    on conflict (user_id) do update set suspended = ${suspended}, blocked = ${blocked}, updated_at = now()
  `;
  if (email) {
    await sql`
      insert into email_lock (email, suspended, blocked)
      values (${email}, ${suspended}, ${blocked})
      on conflict (email) do update set suspended = ${suspended}, blocked = ${blocked}, updated_at = now()
    `;
  }
  if (suspended || blocked) await sql`delete from session where "userId" = ${userId}`;
  return { suspended, blocked };
}

export async function listCustomers() {
  const sql = await getSql();
  await ensureAccessTable(sql);
  return sql<{
    id: string;
    name: string;
    email: string;
    created_at: string;
    role: string;
    balance_paise: number;
    orders: number;
    suspended: boolean;
    blocked: boolean;
  }>`
    select u.id, u.name, u.email, u."createdAt"::text as created_at,
           coalesce(r.role, 'customer') as role,
           coalesce(w.balance_paise, 0)::int as balance_paise,
           (select count(*)::int from engagement_orders o where o.user_id = u.id) as orders,
           coalesce(a.suspended, false) as suspended,
           coalesce(a.blocked, false) as blocked
    from "user" u
    left join user_roles r on r.user_id = u.id
    left join wallets w on w.user_id = u.id
    left join user_access a on a.user_id = u.id
    order by u."createdAt" desc
  `;
}

async function ratesForBase() {
  const sql = await getSql();
  const baseRow = await sql<{ value: string }>`select value from desk_meta where key = 'base_currency' limit 1`;
  const base = (baseRow[0]?.value || "INR").toUpperCase();
  const fxRow = await sql<{ value: string }>`select value from desk_meta where key = 'fx_cache' limit 1`;
  let rates: Record<string, number> = {};
  try {
    const parsed = JSON.parse(fxRow[0]?.value || "{}") as { rates?: Record<string, number> };
    rates = parsed.rates || {};
  } catch { rates = {}; }
  if (!(Number(rates.USD) > 0) || !(Number(rates.PKR) > 0 && base !== "PKR")) {
    try {
      const response = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base.toLowerCase()}.json`);
      if (response.ok) {
        const json = await response.json() as Record<string, unknown>;
        const table = json[base.toLowerCase()];
        if (table && typeof table === "object") {
          const next: Record<string, number> = { [base]: 1 };
          for (const [key, value] of Object.entries(table as Record<string, unknown>)) {
            const rate = Number(value);
            if (rate > 0 && Number.isFinite(rate)) next[key.toUpperCase()] = rate;
          }
          rates = next;
          const packed = JSON.stringify({ base, at: Date.now(), rates });
          await sql`insert into desk_meta (key, value) values ('fx_cache', ${packed}) on conflict (key) do update set value = excluded.value`;
        }
      }
    } catch { /* keep whatever is cached */ }
  }
  rates[base] = 1;
  return { base, rates };
}

/** Face value in its own currency → stored base minor units. 100 PKR stays 100 PKR on screen. 100 INR stays 100 INR. */
export async function nativeToBaseMinor(major: number, currency: string) {
  const typed = Math.round((Number(major) || 0) * 100) / 100;
  if (typed < 1) throw new Error("Enter at least 1.");
  const code = String(currency || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8);
  const { base, rates } = await ratesForBase();
  const chosen = code.length >= 3 ? code : base;
  if (chosen === base) return Math.round(typed * 100);
  if (chosen === "USD") {
    const usdPerBase = Number(rates.USD) || 0;
    const pkrPerBase = base === "PKR" ? 1 : Number(rates.PKR) || 0;
    if (usdPerBase > 0 && pkrPerBase > 0) {
      const fullPkr = pkrPerBase / usdPerBase;
      const shownPkr = Math.max(fullPkr - 8, fullPkr * 0.5);
      return Math.max(1, Math.round(typed * (1 / usdPerBase) * (shownPkr / fullPkr) * 100));
    }
  }
  const rate = Number(rates[chosen]) || 0;
  if (!(rate > 0)) throw new Error(`${chosen} rate is not loaded yet. Refresh the panel and try again.`);
  return Math.max(1, Math.round((typed / rate) * 100));
}

/** Typed amount is in the admin's selected currency. Store the base minor units that display back as that same amount. */
export async function displayMajorToMinor(major: number, currency: string) {
  return nativeToBaseMinor(major, currency);
}

export async function creditCustomer(userId: string, paise: number, note: string) {
  const sql = await getSql();
  await sql`
    insert into wallets (user_id, balance_paise) values (${userId}, ${paise})
    on conflict (user_id) do update set balance_paise = wallets.balance_paise + ${paise}, updated_at = now()
  `;
  await sql`
    insert into wallet_transactions (id, user_id, kind, amount_paise, note)
    values (${crypto.randomUUID()}, ${userId}, 'credit', ${paise}, ${note.slice(0, 180)})
  `;
}

export async function paymentDesk() {
  const sql = await getSql();
  const rows = await sql<{ qr_image: string; upi_id: string; note: string }>`
    select qr_image, upi_id, note from payment_settings where id = 'desk' limit 1
  `;
  return rows[0] ?? { qr_image: "", upi_id: "", note: "" };
}

export async function savePaymentDesk(input: { qr_image: string; upi_id: string; note: string }) {
  const sql = await getSql();
  const image = input.qr_image.startsWith("data:image/") ? input.qr_image.slice(0, 700000) : "";
  await sql`
    insert into payment_settings (id, qr_image, upi_id, note)
    values ('desk', ${image}, ${input.upi_id.slice(0, 80)}, ${input.note.slice(0, 240)})
    on conflict (id) do update set qr_image = ${image}, upi_id = ${input.upi_id.slice(0, 80)}, note = ${input.note.slice(0, 240)}
  `;
}

export type Gateway = {
  id: string;
  name: string;
  account_title: string;
  account_number: string;
  ifsc: string;
  instructions: string;
  qr_image: string;
  min_paise: number;
  max_paise: number;
  enabled: boolean;
  sort_order: number;
  pay_mode: string;
  pay_currency: string;
  network: string;
  pay_kind: string;
};

async function ensureGatewayCols(sql: Awaited<ReturnType<typeof getSql>>) {
  await sql`alter table payment_gateways add column if not exists pay_mode text not null default 'manual'`;
  await sql`alter table payment_gateways add column if not exists pay_currency text not null default 'INR'`;
  await sql`alter table payment_gateways add column if not exists network text not null default ''`;
  await sql`alter table payment_gateways add column if not exists pay_kind text not null default 'other'`;
  await sql`alter table payment_gateways alter column ifsc type text`;
  await sql`update payment_gateways set min_paise = 10000, pay_currency = 'INR' where pay_kind = 'razorpay' and min_paise = 20000`;
  await sql`update payment_gateways set pay_currency = 'PKR', min_paise = 10000 where pay_kind = 'jazzcash' and coalesce(pay_currency, 'INR') = 'INR' and min_paise in (10000, 20000)`;
  await sql`alter table payment_claims add column if not exists pay_amount numeric not null default 0`;
  await sql`alter table payment_claims add column if not exists pay_currency text not null default ''`;
}

export async function publicGateways() {
  const sql = await getSql();
  await ensureGatewayCols(sql);
  return sql<Gateway>`
    select id, name, account_title, account_number, ifsc, instructions, qr_image, min_paise, max_paise, enabled, sort_order,
           coalesce(pay_mode, 'manual') as pay_mode, coalesce(pay_currency, 'INR') as pay_currency, coalesce(network, '') as network,
           coalesce(pay_kind, 'other') as pay_kind
    from payment_gateways
    where enabled = true and archived = false
    order by sort_order, name
  `;
}

export async function adminGateways() {
  const sql = await getSql();
  await ensureGatewayCols(sql);
  return sql<Gateway & { archived: boolean }>`
    select id, name, account_title, account_number, ifsc, instructions, qr_image, min_paise, max_paise, enabled, sort_order, archived,
           coalesce(pay_mode, 'manual') as pay_mode, coalesce(pay_currency, 'INR') as pay_currency, coalesce(network, '') as network,
           coalesce(pay_kind, 'other') as pay_kind
    from payment_gateways
    order by archived, sort_order, name
  `;
}

export async function saveGateway(input: Gateway & { archived?: boolean }) {
  const sql = await getSql();
  await ensureGatewayCols(sql);
  const id = input.id || crypto.randomUUID();
  const image = input.qr_image.startsWith("data:image/") ? input.qr_image.slice(0, 700000) : "";
  const mode = input.pay_mode === "auto" ? "auto" : "manual";
  const currency = String(input.pay_currency || "INR").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8) || "INR";
  const network = String(input.network || "").slice(0, 4000);
  const kind = ["upi", "jazzcash", "crypto", "talk", "other", "razorpay", "usdt"].includes(input.pay_kind) ? input.pay_kind : "other";
  const ifsc = input.ifsc.slice(0, 40);
  await sql`
    insert into payment_gateways (
      id, name, account_title, account_number, ifsc, instructions, qr_image, min_paise, max_paise, enabled, sort_order, archived, pay_mode, pay_currency, network, pay_kind
    ) values (
      ${id}, ${input.name.slice(0, 60)}, ${input.account_title.slice(0, 80)}, ${input.account_number.slice(0, 120)},
      ${ifsc}, ${input.instructions.slice(0, 400)}, ${image},
      ${input.min_paise}, ${input.max_paise}, ${input.enabled}, ${input.sort_order}, ${Boolean(input.archived)},
      ${mode}, ${currency}, ${network}, ${kind}
    )
    on conflict (id) do update set
      name = ${input.name.slice(0, 60)},
      account_title = ${input.account_title.slice(0, 80)},
      account_number = ${input.account_number.slice(0, 120)},
      ifsc = ${ifsc},
      instructions = ${input.instructions.slice(0, 400)},
      qr_image = case when ${image} = '' then payment_gateways.qr_image else ${image} end,
      min_paise = ${input.min_paise},
      max_paise = ${input.max_paise},
      enabled = ${input.enabled},
      sort_order = ${input.sort_order},
      archived = ${Boolean(input.archived)},
      pay_mode = ${mode},
      pay_currency = ${currency},
      network = ${network},
      pay_kind = ${kind}
  `;
  return id;
}

export async function submitClaim(userId: string, amountPaise: number, screenshot: string, reference: string, gatewayId: string, displayMajor = 0, nativeMajor = 0, nativeCurrency = "") {
  const shot = screenshot.startsWith("data:image/") ? screenshot.slice(0, 700000) : "";
  const sql = await getSql();
  await ensureGatewayCols(sql);
  const gates = await sql<{ min_paise: number; max_paise: number; pay_currency: string; pay_kind: string; name: string }>`
    select min_paise, max_paise, coalesce(pay_currency, 'INR') as pay_currency, coalesce(pay_kind, 'other') as pay_kind, name from payment_gateways
    where id = ${gatewayId} and enabled = true and archived = false
    limit 1
  `;
  const gate = gates[0];
  if (!gate) throw new Error("That payment method is not available.");
  const kind = (gate.pay_kind || "").toLowerCase();
  const canon = kind === "crypto" || kind === "usdt" || /crypto|usdt/i.test(gate.name)
    ? { min: 2, max: 500, cur: "USD" }
    : kind === "jazzcash" || /jazz/i.test(gate.name)
      ? { min: 100, max: 50000, cur: "PKR" }
      : { min: 100, max: 50000, cur: "INR" };
  const typed = Math.round((Number(displayMajor) || 0) * 100) / 100;
  const native = Math.round((Number(nativeMajor) || 0) * 100) / 100;
  const nativeCur = (nativeCurrency || canon.cur).toUpperCase();
  let credit = amountPaise;
  let gateMajor = typed;
  if (native >= 1 && nativeCur === canon.cur) {
    gateMajor = native;
    credit = await nativeToBaseMinor(native, nativeCur);
  } else if (typed >= 1) {
    const prefs = await sql<{ display_currency: string | null }>`select display_currency from user_prefs where user_id = ${userId} limit 1`;
    const baseRow = await sql<{ value: string }>`select value from desk_meta where key = 'base_currency' limit 1`;
    const fxRow = await sql<{ value: string }>`select value from desk_meta where key = 'fx_cache' limit 1`;
    const display = (prefs[0]?.display_currency || baseRow[0]?.value || "INR").toUpperCase();
    const base = (baseRow[0]?.value || "INR").toUpperCase();
    let displayRate = 1;
    let gateRate = 1;
    try {
      const parsed = JSON.parse(fxRow[0]?.value || "{}") as { rates?: Record<string, number> };
      const shown = Number(parsed.rates?.[display]);
      const nativeRate = Number(parsed.rates?.[canon.cur]);
      if (display !== base && shown > 0) displayRate = shown;
      if (canon.cur !== base && nativeRate > 0) gateRate = nativeRate;
    } catch { /* use 1 */ }
    const baseMajor = typed / displayRate;
    gateMajor = baseMajor * gateRate;
    credit = Math.max(1, Math.round(baseMajor * 100));
  } else {
    gateMajor = amountPaise / 100;
  }
  if (gateMajor < canon.min - 0.02 || gateMajor > canon.max + 0.02) {
    throw new Error(`Amount must be between ${canon.min} and ${canon.max} ${canon.cur}.`);
  }
  const ref = reference.trim();
  if (ref.length < 6) throw new Error("Enter the UTR or transaction reference.");
  const dup = await sql<{ id: string }>`
    select id from payment_claims
    where lower(reference) = lower(${ref}) and status in ('pending', 'approved')
    limit 1
  `;
  if (dup.length > 0) throw new Error("This UTR is already submitted.");
  const gatesKind = await sql<{ pay_kind: string; name: string }>`select coalesce(pay_kind, 'other') as pay_kind, name from payment_gateways where id = ${gatewayId} limit 1`;
  const payKind = gatesKind[0]?.pay_kind || "other";
  const needsShot = payKind === "jazzcash" || /jazz/i.test(gatesKind[0]?.name || "");
  if (needsShot && !shot) throw new Error("Upload the payment screenshot.");
  if (payKind === "upi" && !/^\d{12}$/.test(ref)) throw new Error("Enter the 12-digit UTR.");
  if ((payKind === "other" || payKind === "crypto") && !shot && ref.length < 6) throw new Error("Add the transaction id or a screenshot.");
  const id = `PAY-${Math.floor(100000 + Math.random() * 900000)}`;
  await sql`
    insert into payment_claims (id, user_id, amount_paise, screenshot, reference, status, gateway_id, pay_amount, pay_currency)
    values (${id}, ${userId}, ${credit}, ${shot}, ${ref.slice(0, 80)}, 'pending', ${gatewayId}, ${gateMajor}, ${canon.cur})
  `;
  return id;
}

export async function myClaims(userId: string) {
  const sql = await getSql();
  await ensureGatewayCols(sql);
  return sql<{ id: string; amount_paise: number; status: string; created_at: string; pay_amount: number; pay_currency: string; gateway_name: string }>`
    select c.id, c.amount_paise, c.status, c.created_at::text as created_at,
           coalesce(c.pay_amount, 0)::float as pay_amount, coalesce(c.pay_currency, '') as pay_currency,
           coalesce(g.name, '') as gateway_name
    from payment_claims c
    left join payment_gateways g on g.id = c.gateway_id
    where c.user_id = ${userId}
    order by c.created_at desc
    limit 20
  `;
}

export async function listClaims() {
  const sql = await getSql();
  await ensureGatewayCols(sql);
  return sql<{
    id: string;
    user_id: string;
    email: string;
    name: string;
    amount_paise: number;
    pay_amount: number;
    pay_currency: string;
    screenshot: string;
    reference: string;
    status: string;
    created_at: string;
    gateway_id: string;
    gateway_name: string;
    reject_reason: string;
  }>`
    select c.id, c.user_id, u.email, u.name, c.amount_paise, coalesce(c.pay_amount, 0)::float as pay_amount,
           coalesce(c.pay_currency, '') as pay_currency, c.screenshot, c.reference, c.status,
           c.created_at::text as created_at, c.gateway_id, coalesce(g.name, 'Payment') as gateway_name, c.reject_reason
    from payment_claims c
    join "user" u on u.id = c.user_id
    left join payment_gateways g on g.id = c.gateway_id
    order by case when c.status = 'pending' then 0 else 1 end, c.created_at desc
    limit 40
  `;
}

export async function reviewClaim(claimId: string, approve: boolean, reason = "") {
  const sql = await getSql();
  await ensureGatewayCols(sql);
  if (!approve) {
    const rows = await sql<{ id: string }>`
      update payment_claims
      set status = 'declined', reject_reason = ${reason.slice(0, 180)}, reviewed_at = now()
      where id = ${claimId} and status = 'pending'
      returning id
    `;
    if (rows.length === 0) throw new Error("This payment is already reviewed.");
    return;
  }
  const rows = await sql<{ user_id: string; amount_paise: number; pay_amount: number; pay_currency: string; gateway_name: string }>`
    update payment_claims
    set status = 'approved', reviewed_at = now()
    where id = ${claimId} and status = 'pending'
    returning user_id, amount_paise, coalesce(pay_amount, 0)::float as pay_amount, coalesce(pay_currency, '') as pay_currency,
      coalesce((select name from payment_gateways g where g.id = payment_claims.gateway_id), 'Payment') as gateway_name
  `;
  const claim = rows[0];
  if (!claim) throw new Error("This payment is already reviewed.");
  const face = Number(claim.pay_amount) || 0;
  const cur = (claim.pay_currency || "").toUpperCase();
  const minor = face >= 1 && cur ? await nativeToBaseMinor(face, cur) : claim.amount_paise;
  const method = /jazz/i.test(claim.gateway_name) ? "JazzCash" : /crypto|usdt/i.test(claim.gateway_name) ? "Crypto" : /upi|razor/i.test(claim.gateway_name) ? "UPI" : claim.gateway_name;
  const label = face >= 1 && cur ? `${face} ${cur}` : "";
  await creditCustomer(claim.user_id, minor, `Payment ${claimId} approved · ${label} · ${method}`.replace(" ·  · ", " · "));
}

export async function removeCustomer(actorId: string, userId: string) {
  if (actorId === userId) throw new Error("You cannot delete the signed-in admin.");
  const sql = await getSql();
  await sql`delete from payment_claims where user_id = ${userId}`;
  await sql`delete from mass_batch_links where user_id = ${userId}`;
  await sql`delete from mass_batches where user_id = ${userId}`;
  await sql`delete from user_prefs where user_id = ${userId}`;
  await sql`delete from support_tickets where user_id = ${userId}`;
  await sql`delete from delivery_drops where user_id = ${userId}`;
  await sql`delete from engagement_order_items where user_id = ${userId}`;
  await sql`delete from engagement_orders where user_id = ${userId}`;
  await sql`delete from wallet_transactions where user_id = ${userId}`;
  await sql`delete from wallets where user_id = ${userId}`;
  await sql`delete from user_roles where user_id = ${userId}`;
  await sql`delete from session where "userId" = ${userId}`;
  await sql`delete from account where "userId" = ${userId}`;
  await sql`delete from "user" where id = ${userId}`;
}
