import { getSql } from "@/lib/db";
import { mixDrops } from "@/lib/organic";

export type DropPlan = {
  hours: number;
  runs: number;
  variance?: number;
  peak?: boolean;
  curve?: number[];
  start?: string;
};

export type DropRow = {
  id: string;
  order_id: string;
  engagement_type: string;
  quantity: number;
  place_at: string;
  status: string;
  provider_order_id: string | null;
  service_label: string | null;
  error: string | null;
  sent?: number | null;
  remains?: number | null;
  pct?: number | null;
  live_status?: string | null;
  start_count?: string | null;
  video_now?: number | null;
  count_source?: string | null;
};

const globalWorker = globalThis as typeof globalThis & { __dropWorker?: ReturnType<typeof setInterval> };

const CORE_TYPES = new Set(["views", "likes", "saves", "shares", "reposts", "comments", "followers"]);

function guessKind(text: string) {
  const name = text.toLowerCase();
  if (/\breposts?\b/.test(name)) return "reposts";
  if (/\b(saves?|favourites?|favorites?)\b/.test(name)) return "saves";
  if (/\bshares?\b/.test(name)) return "shares";
  if (/\bcomments?\b/.test(name)) return "comments";
  if (/\bfollowers?\b/.test(name)) return "followers";
  if (/\blikes?\b/.test(name)) return "likes";
  if (/\bviews?\b/.test(name)) return "views";
  return "views";
}

async function providersFor(platform: string, kind: string) {
  const { bindingMap } = await import("@/lib/admin.server");
  const found: { apiUrl: string; apiKey: string }[] = [];
  const push = (apiUrl?: string | null, apiKey?: string | null) => {
    const key = String(apiKey || "").trim();
    const url = String(apiUrl || "").trim();
    if (!key || !url || found.some((item) => item.apiKey === key)) return;
    found.push({ apiUrl: url, apiKey: key });
  };
  try {
    const bindings = await bindingMap();
    const slot = bindings[`${platform}:${kind}`] || (kind === "single" ? bindings.single : undefined);
    for (const item of slot?.providers || []) push(item.api_url, item.api_key);
    push(slot?.api_url, slot?.api_key);
  } catch {
    /* bindings optional */
  }
  return found;
}

async function rememberVideoBase(orderId: string, link: string) {
  const sql = await getSql();
  await sql`alter table engagement_orders add column if not exists video_base text`;
  await sql`alter table engagement_orders add column if not exists video_now text`;
  const rows = await sql<{ video_base: string | null }>`select video_base from engagement_orders where id = ${orderId} limit 1`;
  if (rows[0]?.video_base) return;
  try {
    const { readVideoCounts } = await import("@/lib/video-stats");
    const counts = await readVideoCounts(link);
    if (!counts) return;
    const packed = JSON.stringify({ ...counts, snap: "order" });
    await sql`update engagement_orders set video_base = ${packed}, video_now = ${packed} where id = ${orderId}`;
  } catch {
    /* public video count is optional */
  }
}

async function attachVideo(rows: DropRow[]) {
  if (rows.length === 0) return rows;
  const sql = await getSql();
  await sql`alter table delivery_drops add column if not exists tracked_sent integer not null default 0`;
  await sql`alter table delivery_drops add column if not exists count_after timestamptz`;
  const orderId = rows[0].order_id;
  const saved = await sql<{ id: string; tracked_sent: number; count_after: string | null }>`
    select id, coalesce(tracked_sent, 0)::int as tracked_sent, count_after::text as count_after
    from delivery_drops
    where order_id = ${orderId}
  `;
  const tracked = new Map(saved.map((row) => [row.id, row]));
  const orders = await sql<{ video_now: string | null }>`select video_now from engagement_orders where id = ${orderId} limit 1`;
  const { parseCounts } = await import("@/lib/video-stats");
  const now = parseCounts(orders[0]?.video_now);
  return rows.map((row) => {
    const slot = tracked.get(row.id);
    const videoNow = now ? now[row.engagement_type as "views"] : null;
    if (row.status !== "placed") return { ...row, video_now: typeof videoNow === "number" ? videoNow : row.video_now };
    const phase = row.live_status ? (row.live_status.toLowerCase().includes("complete") && !row.live_status.toLowerCase().includes("progress") ? "complete" : "") : "";
    const sent = phase === "complete" ? row.quantity : Math.max(0, Math.min(row.quantity, slot?.tracked_sent ?? row.sent ?? 0));
    const waiting = Boolean(slot?.count_after) && new Date(slot?.count_after || 0).getTime() > Date.now() && sent < row.quantity;
    return {
      ...row,
      sent,
      remains: Math.max(0, row.quantity - sent),
      pct: row.quantity > 0 ? Math.round((sent / row.quantity) * 100) : 0,
      video_now: typeof videoNow === "number" ? videoNow : row.video_now,
      count_source: waiting ? "waiting" : sent > 0 ? "video" : row.count_source || "video",
    };
  });
}

const METRICS = ["views", "likes", "comments", "shares", "saves"] as const;

function nextQuantity(quantity: number, message: string) {
  const step = Number(message.match(/multiple(?:s)? of\s*(\d+)/i)?.[1] || 0);
  if (step > 1) {
    const up = Math.ceil((quantity + 1) / step) * step;
    return up > quantity ? up : quantity + step;
  }
  const min = Number(message.match(/(?:min(?:imum)?|at least|less than|minimal)[^\d]{0,16}(\d+)/i)?.[1] || 0);
  if (min > quantity && min <= quantity + 30) return min;
  return quantity + 1;
}

function paidGain(type: string, delta: number, room: number, earlier: number[]) {
  if (delta <= 2 || room < 1) return 0;
  const drip = earlier.filter((value) => value >= 0 && value <= 3);
  const usual = drip.length ? drip.reduce((sum, value) => sum + value, 0) / drip.length : 0;
  const floor = type === "views" ? Math.max(4, Math.min(12, Math.ceil(room * 0.08))) : Math.max(4, Math.min(6, Math.ceil(room * 0.2)));
  const sudden = delta >= floor && delta >= usual * 3 + 2;
  const piece = delta >= Math.max(floor, Math.ceil(room * (type === "views" ? 0.12 : 0.25)));
  const whole = delta >= room && room >= floor;
  if (sudden || piece || whole) return Math.min(room, delta);
  return 0;
}

async function trackOrder(orderId: string) {
  const sql = await getSql();
  await sql`alter table engagement_orders add column if not exists video_samples text`;
  await sql`alter table delivery_drops add column if not exists provider_status text`;
  await sql`alter table delivery_drops add column if not exists tracked_sent integer not null default 0`;
  await sql`alter table delivery_drops add column if not exists count_after timestamptz`;
  const orders = await sql<{ link: string; video_samples: string | null; video_now: string | null }>`
    select link, video_samples, video_now from engagement_orders where id = ${orderId} limit 1
  `;
  const order = orders[0];
  if (!order?.link) return;
  const { parseCounts, readVideoCounts } = await import("@/lib/video-stats");
  const { deliveryPhase } = await import("@/lib/providers.server");
  let samples: { at: number; views: number; likes: number; comments: number; shares: number; saves: number }[] = [];
  try {
    const parsed = JSON.parse(order.video_samples || "[]");
    if (Array.isArray(parsed)) samples = parsed.filter((row) => row && typeof row.at === "number");
  } catch {
    samples = [];
  }
  const last = samples[samples.length - 1];
  let fresh = last && Date.now() - last.at < 2_000 ? last : null;
  if (!fresh) {
    try {
      const read = await readVideoCounts(order.link);
      if (read) {
        fresh = read;
        samples.push(read);
        samples = samples.slice(-40);
        const packed = JSON.stringify(samples);
        await sql`update engagement_orders set video_samples = ${packed}, video_now = ${JSON.stringify(read)} where id = ${orderId}`;
      }
    } catch {
      fresh = parseCounts(order.video_now);
    }
  }
  if (!fresh || !last || fresh.at === last.at) return;
  const gap = fresh.at - last.at;
  if (gap < 1_000 || gap > 20_000) return;
  const deltas = (metric: "views" | "likes" | "comments" | "shares" | "saves") => {
    const values: number[] = [];
    for (let index = 1; index < samples.length; index += 1) {
      const wait = samples[index].at - samples[index - 1].at;
      if (wait < 800 || wait > 20_000) continue;
      values.push(Math.max(0, samples[index][metric] - samples[index - 1][metric]));
    }
    return values;
  };
  const drops = await sql<{
    id: string;
    engagement_type: string;
    quantity: number;
    status: string;
    provider_status: string | null;
    tracked_sent: number;
    count_after: string | null;
    place_at: string;
  }>`
    select id, engagement_type, quantity, status, provider_status, coalesce(tracked_sent, 0)::int as tracked_sent,
           count_after::text as count_after, place_at::text as place_at
    from delivery_drops
    where order_id = ${orderId} and status = 'placed'
    order by place_at asc
  `;
  const seen = new Set<string>();
  for (const drop of drops) {
    if (!METRICS.includes(drop.engagement_type as "views")) continue;
    if (seen.has(drop.engagement_type)) continue;
    const metric = drop.engagement_type as "views";
    const phase = deliveryPhase(drop.provider_status || "");
    const tracked = drop.tracked_sent || 0;
    if (phase === "complete") {
      if (tracked < drop.quantity) await sql`update delivery_drops set tracked_sent = ${drop.quantity} where id = ${drop.id}`;
      seen.add(drop.engagement_type);
      continue;
    }
    if (phase === "closed" || phase === "partial") {
      seen.add(drop.engagement_type);
      continue;
    }
    if (phase === "pending") {
      seen.add(drop.engagement_type);
      continue;
    }
    if (tracked >= drop.quantity) continue;
    const readyAt = drop.count_after ? new Date(drop.count_after).getTime() : 0;
    if (!readyAt) {
      const start = phase === "running" ? Date.now() + 75_000 : new Date(drop.place_at).getTime() + 90_000;
      await sql`update delivery_drops set count_after = ${new Date(start).toISOString()} where id = ${drop.id} and count_after is null`;
      seen.add(drop.engagement_type);
      continue;
    }
    if (Date.now() < readyAt) {
      seen.add(drop.engagement_type);
      continue;
    }
    const history = deltas(metric);
    const delta = history[history.length - 1] ?? 0;
    const gain = paidGain(metric, delta, drop.quantity - tracked, history.slice(0, -1));
    if (gain > 0) await sql`update delivery_drops set tracked_sent = ${tracked + gain} where id = ${drop.id}`;
    seen.add(drop.engagement_type);
  }
}

export async function armOrder(input: {
  userId: string;
  orderId: string;
  platform: string;
  link: string;
  lines: { engagement_type: string; quantity: number }[];
  plans: Record<string, DropPlan>;
  drops?: { type: string; amount: number; at: string }[];
}) {
  const sql = await getSql();
  const { bindingMap } = await import("@/lib/admin.server");
  let bindings: Record<string, { pick_mode?: string; service_id?: string; api_url?: string; api_key?: string; min_quantity?: number; providers?: { api_url: string; api_key: string }[] }> = {};
  try {
    bindings = await bindingMap();
  } catch (error) {
    console.error("[drops] bindings", error);
  }
  for (const line of input.lines) {
    const slot = bindings[`${input.platform}:${line.engagement_type}`];
    const ready = (slot?.providers || []).some((item) => item.api_key && item.api_url) || Boolean(slot?.api_key && slot?.api_url);
    if (!ready) throw new Error("No Provider Available");
  }
  await rememberVideoBase(input.orderId, input.link);
  const custom = (input.drops ?? []).filter((drop) => drop.amount > 0 && input.lines.some((line) => line.engagement_type === drop.type));
  const mixed = custom.length
    ? custom
        .map((drop) => ({ type: drop.type, at: new Date(drop.at), amount: Math.floor(drop.amount) }))
        .filter((drop) => !Number.isNaN(drop.at.getTime()) && drop.amount > 0)
        .sort((a, b) => a.at.getTime() - b.at.getTime())
    : mixDrops(
        input.lines.map((line) => {
          const plan = input.plans[line.engagement_type];
          const binding = bindings[`${input.platform}:${line.engagement_type}`];
          return {
            type: line.engagement_type,
            quantity: line.quantity,
            runs: plan?.runs ?? 4,
            hours: plan?.hours ?? 24,
            curve: plan?.curve,
            variance: plan?.variance ?? 25,
            peak: Boolean(plan?.peak),
            min: binding?.min_quantity || undefined,
          };
        }),
        Number.isNaN(new Date(input.plans[input.lines[0]?.engagement_type || ""]?.start || "").getTime()) ? new Date() : new Date(input.plans[input.lines[0]?.engagement_type || ""]?.start || Date.now()),
      );
  const { liftOffMinimum, PROVIDER_MIN } = await import("@/lib/organic");
  const placed = liftOffMinimum(mixed, (type) => bindings[`${input.platform}:${type}`]?.min_quantity || PROVIDER_MIN[type] || 1);
  for (const drop of placed) {
    const binding = bindings[`${input.platform}:${drop.type}`];
    const serviceId = binding?.pick_mode === "random" ? "random" : binding?.service_id || null;
    await sql`
      insert into delivery_drops (
        id, order_id, user_id, platform, link, engagement_type, quantity, place_at, status,
        provider_service_id, api_url, api_key
      ) values (
        ${crypto.randomUUID()}, ${input.orderId}, ${input.userId}, ${input.platform}, ${input.link},
        ${drop.type}, ${drop.amount}, ${drop.at.toISOString()}, 'waiting',
        ${serviceId}, ${binding?.api_url || null}, ${binding?.api_key || null}
      )
    `;
  }
  await flushDueDrops(input.orderId);
}

export async function listOrderDrops(userId: string, orderId: string) {
  const sql = await getSql();
  const read = () => sql<DropRow>`
    select id, order_id, engagement_type, quantity, place_at::text as place_at, status, provider_order_id, service_label, error
    from delivery_drops
    where user_id = ${userId} and order_id = ${orderId}
    order by place_at asc
  `;
  let rows = await read();
  if (rows.length === 0) {
    await backfillDrops(userId, orderId);
    rows = await read();
  }
  // Place any due runs on every poll, so tracking updates even if the background interval died.
  try {
    await trackOrder(orderId);
    await flushDueDrops(orderId);
  } catch (error) {
    console.error("[drops] flush on list", error);
  }
  return attachVideo(await attachLive(await read()));
}

async function backfillDrops(userId: string, orderId: string) {
  const sql = await getSql();
  const existing = await sql<{ id: string }>`select id from delivery_drops where user_id = ${userId} and order_id = ${orderId} limit 1`;
  if (existing.length > 0) return;
  const orders = await sql<{ platform: string; link: string; interval_hours: number; variance_percent: number; created_at: string }>`
    select platform, link, interval_hours, variance_percent, created_at::text as created_at
    from engagement_orders
    where id = ${orderId} and user_id = ${userId}
  `;
  const order = orders[0];
  if (!order) return;
  const created = new Date(order.created_at).getTime();
  if (!Number.isFinite(created) || Date.now() - created > 6 * 60 * 60 * 1000) return;
  const items = await sql<{ engagement_type: string; quantity: number }>`
    select engagement_type, quantity from engagement_order_items
    where order_id = ${orderId} and user_id = ${userId} and quantity > 0
  `;
  if (items.length === 0) return;
  const plans: Record<string, DropPlan> = {};
  for (const item of items) {
    const chunk = item.engagement_type === "views" ? 100 : item.engagement_type === "saves" ? 50 : 10;
    const runs = Math.max(1, Math.floor(item.quantity / chunk));
    const gap = Math.max(1, Number(order.interval_hours) || 1);
    plans[item.engagement_type] = {
      hours: Math.max(gap, gap * Math.max(runs - 1, 1)),
      runs,
      variance: order.variance_percent ?? 25,
      start: new Date().toISOString(),
    };
  }
  await armOrder({
    userId,
    orderId,
    platform: order.platform,
    link: order.link,
    lines: items,
    plans,
  });
}

type DueDrop = {
  id: string;
  order_id: string;
  user_id: string;
  platform: string;
  link: string;
  engagement_type: string;
  quantity: number;
  provider_service_id: string | null;
  api_url: string | null;
  api_key: string | null;
  place_at?: string;
  error?: string | null;
};

async function serviceActiveLimit() {
  const sql = await getSql();
  await sql`create table if not exists desk_meta (key text primary key, value text not null default '')`;
  const rows = await sql<{ value: string }>`select value from desk_meta where key = 'service_active_limit' limit 1`;
  const parsed = Math.floor(Number(rows[0]?.value));
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

async function activeServiceLoads(platform: string, type: string) {
  const sql = await getSql();
  await sql`alter table delivery_drops add column if not exists provider_status text`;
  const rows = await sql<{ api_key: string | null; provider_service_id: string | null; n: number }>`
    select api_key, provider_service_id, count(*)::int as n
    from delivery_drops
    where platform = ${platform}
      and engagement_type = ${type}
      and status = 'placed'
      and provider_service_id is not null
      and lower(coalesce(provider_status, 'pending')) not in ('completed', 'complete', 'partial', 'canceled', 'cancelled', 'failed', 'refunded')
    group by api_key, provider_service_id
  `;
  const loads: Record<string, number> = {};
  for (const row of rows) {
    const key = String(row.api_key || "");
    const service = String(row.provider_service_id || "");
    if (!key || !service) continue;
    loads[`${key}::${service}`] = Number(row.n) || 0;
  }
  return loads;
}

async function stampDropPhase(providerOrderId: string, status: string, phase: string) {
  const sql = await getSql();
  await sql`alter table delivery_drops add column if not exists finished_at timestamptz`;
  const live = String(status || "pending").toLowerCase().slice(0, 40);
  if (phase === "complete" || phase === "closed" || phase === "partial") {
    await sql`
      update delivery_drops
      set provider_status = ${live}, finished_at = coalesce(finished_at, now())
      where provider_order_id = ${providerOrderId}
    `;
    return;
  }
  await sql`update delivery_drops set provider_status = ${live} where provider_order_id = ${providerOrderId}`;
}

async function placePinnedService(input: {
  platform: string;
  type: string;
  link: string;
  quantity: number;
  dropId: string;
  ids: string[];
  providers: { apiUrl: string; apiKey: string }[];
  rateMinUsd?: number;
  rateMaxUsd?: number;
}) {
  const sql = await getSql();
  await sql`alter table delivery_drops add column if not exists finished_at timestamptz`;
  const { placeExactOnProvider, providerOrderStatus, providerPhase, fetchProviderCatalog } = await import("@/lib/providers.server");
  const open = await sql<{ provider_order_id: string | null; api_url: string | null; api_key: string | null; provider_service_id: string | null }>`
    select provider_order_id, api_url, api_key, provider_service_id
    from delivery_drops
    where platform = ${input.platform}
      and engagement_type = ${input.type}
      and status = 'placed'
      and finished_at is null
      and provider_order_id is not null
    order by place_at desc
    limit 24
  `;
  const wanted = new Set(input.ids);
  for (const row of open) {
    if (!wanted.has(String(row.provider_service_id || "")) || !row.provider_order_id || !row.api_key) continue;
    try {
      const status = await providerOrderStatus(row.provider_order_id, row.api_url || undefined, row.api_key);
      await stampDropPhase(row.provider_order_id, status.status, providerPhase(status.status));
    } catch {
      /* leave the row busy until the provider answers */
    }
  }
  const busyRows = await sql<{ provider_service_id: string | null; n: number }>`
    select provider_service_id, count(*)::int as n
    from delivery_drops
    where platform = ${input.platform}
      and engagement_type = ${input.type}
      and id <> ${input.dropId}
      and status in ('placed', 'placing')
      and provider_service_id is not null
      and finished_at is null
      and lower(coalesce(provider_status, 'pending')) not in ('completed', 'complete', 'partial', 'canceled', 'cancelled', 'failed', 'refunded')
    group by provider_service_id
  `;
  const cooling = await sql<{ provider_service_id: string | null }>`
    select provider_service_id
    from delivery_drops
    where platform = ${input.platform}
      and engagement_type = ${input.type}
      and provider_service_id is not null
      and finished_at is not null
      and finished_at > now() - interval '50 seconds'
    group by provider_service_id
  `;
  const last = await sql<{ provider_service_id: string | null }>`
    select provider_service_id
    from delivery_drops
    where platform = ${input.platform}
      and engagement_type = ${input.type}
      and id <> ${input.dropId}
      and provider_service_id is not null
      and status in ('placed', 'placing', 'failed')
    order by place_at desc
    limit 1
  `;
  const limit = await serviceActiveLimit();
  const busy = new Map(busyRows.map((row) => [String(row.provider_service_id || ""), Number(row.n) || 0]));
  const cool = new Set(cooling.map((row) => String(row.provider_service_id || "")));
  const lastId = String(last[0]?.provider_service_id || "");
  const at = input.ids.indexOf(lastId);
  const start = at < 0 ? 0 : (at + 1) % input.ids.length;
  const ordered = [...input.ids.slice(start), ...input.ids.slice(0, start)];
  const free = ordered.filter((id) => (busy.get(id) || 0) < limit && !cool.has(id));
  if (free.length === 0) throw new Error("hold: pinned service IDs are busy or cooling for 50 seconds");
  const minUsd = Number(input.rateMinUsd) > 0 ? Number(input.rateMinUsd) : 0;
  const maxUsd = Number(input.rateMaxUsd) > 0 ? Number(input.rateMaxUsd) : 0;
  let eligible = free;
  if (minUsd > 0 || maxUsd > 0) {
    const rates = new Map<string, number>();
    for (const provider of input.providers) {
      try {
        const rows = await fetchProviderCatalog(provider.apiUrl, provider.apiKey);
        for (const row of rows) {
          const id = String(row.service);
          if (!rates.has(id)) rates.set(id, Number(row.rate) || 0);
        }
      } catch {
        /* this API can still be tried if the rate is unknown */
      }
    }
    eligible = free.filter((id) => {
      if (!rates.has(id)) return true;
      const rate = rates.get(id) || 0;
      if (rate <= 0) return false;
      if (minUsd > 0 && rate + 1e-9 < minUsd) return false;
      if (maxUsd > 0 && rate - 1e-9 > maxUsd) return false;
      return true;
    });
    if (eligible.length === 0) throw new Error("Saved service IDs are outside the price range.");
  }
  let lastError = "Provider rejected this service ID.";
  for (const id of eligible) {
    for (const provider of input.providers) {
      try {
        await sql`update delivery_drops set provider_service_id = ${id} where id = ${input.dropId}`;
        const exact = await placeExactOnProvider({
          serviceId: id,
          link: input.link,
          quantity: input.quantity,
          apiUrl: provider.apiUrl,
          apiKey: provider.apiKey,
        });
        console.log(`[drops] pinned ${input.type} x${input.quantity} on #${id}`);
        return {
          orderId: exact.orderId,
          serviceId: exact.serviceId,
          label: `#${exact.serviceId}`,
          apiUrl: provider.apiUrl,
          apiKey: provider.apiKey,
          quantity: exact.quantity || input.quantity,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : lastError;
        if (/hold: API balance|not enough funds|insufficient balance|not enough balance|multiples of|accepts quantity/i.test(message)) throw error;
        lastError = message;
      }
    }
  }
  throw new Error(lastError);
}

async function pendingLoads(type: string, providers: { apiUrl: string; apiKey: string }[]) {
  const sql = await getSql();
  const { providerOrderStatus, providerPhase, readRemains } = await import("@/lib/providers.server");
  const keys = new Set(providers.map((item) => item.apiKey));
  const rows = await sql<{ api_key: string | null; api_url: string | null; provider_order_id: string | null; quantity: number }>`
    select api_key, api_url, provider_order_id, quantity
    from delivery_drops
    where engagement_type = ${type} and status = 'placed' and provider_order_id is not null
    order by place_at desc
    limit 30
  `;
  const loads: Record<string, number> = {};
  for (const row of rows) {
    const key = String(row.api_key || "");
    if (!key || !keys.has(key) || !row.provider_order_id) continue;
    try {
      const status = await providerOrderStatus(row.provider_order_id, row.api_url || undefined, key);
      const phase = providerPhase(status.status);
      const remains = readRemains(status.status, status.remains);
      const left = phase === "open" || remains == null ? row.quantity : remains;
      loads[key] = (loads[key] || 0) + left;
    } catch {
      loads[key] = (loads[key] || 0) + row.quantity;
    }
  }
  return loads;
}

async function attachLive(rows: DropRow[]) {
  if (rows.length === 0) return rows;
  const { providerOrderStatus, providerPhase, readRemains } = await import("@/lib/providers.server");
  const sql = await getSql();
  const keys = await sql<{ id: string; api_url: string | null; api_key: string | null }>`
    select id, api_url, api_key from delivery_drops where order_id = ${rows[0].order_id} and status = 'placed'
  `;
  const byId = new Map(keys.map((row) => [row.id, row]));
  return Promise.all(rows.map(async (row) => {
    const meta = byId.get(row.id);
    if (row.status !== "placed" || !meta?.api_key || !row.provider_order_id) return row;
    try {
      const status = await providerOrderStatus(row.provider_order_id, meta.api_url || undefined, meta.api_key);
      const phase = providerPhase(status.status);
      await stampDropPhase(row.provider_order_id, status.status, phase);
      const parsed = readRemains(status.status, status.remains);
      const left = phase === "open" || parsed == null ? row.quantity : Math.max(0, Math.min(row.quantity, parsed));
      const sent = phase === "open" ? 0 : Math.max(0, row.quantity - left);
      const pct = sent == null || row.quantity <= 0 ? null : Math.round((sent / row.quantity) * 100);
      return { ...row, sent, remains: left, pct, live_status: status.status, start_count: status.startCount || null };
    } catch {
      return { ...row, sent: null, remains: null, pct: null, live_status: "pending" };
    }
  }));
}

export async function flushDueDrops(orderId?: string) {
  const sql = await getSql();
  await sql`alter table delivery_drops add column if not exists tracked_sent integer not null default 0`;
  await sql`
    update delivery_drops
    set status = 'waiting',
        quantity = ((quantity + 99) / 100) * 100,
        error = 'retry: views snapped to a multiple of 100',
        place_at = now()
    where status = 'failed'
      and engagement_type = 'views'
      and coalesce(error, '') ilike '%multiples of%'
      and order_id not in (select id from engagement_orders where status in ('paused', 'cancelled'))
  `;
  await sql`
    update delivery_drops set status = 'waiting'
    where status = 'placing' and place_at < now() - interval '2 minutes'
      and order_id not in (select id from engagement_orders where status in ('paused', 'cancelled'))
  `;
  await sql`
    update delivery_drops set status = 'waiting', error = 'retry 1: recovered'
    where status = 'failed'
      and place_at > now() - interval '12 hours'
      and coalesce(error, '') not like 'gaveup%'
      and coalesce(error, '') not like 'retry%'
      and order_id not in (select id from engagement_orders where status in ('paused', 'cancelled'))
  `;
  const due = orderId
    ? await sql<DueDrop>`
        select id, order_id, user_id, platform, link, engagement_type, quantity, provider_service_id, api_url, api_key, error
        from delivery_drops
        where status = 'waiting' and place_at <= now() and order_id = ${orderId}
          and order_id not in (select id from engagement_orders where status in ('paused', 'cancelled'))
        order by place_at asc
        limit 30
      `
    : await sql<DueDrop>`
        select id, order_id, user_id, platform, link, engagement_type, quantity, provider_service_id, api_url, api_key, error
        from delivery_drops
        where status = 'waiting' and place_at <= now()
          and order_id not in (select id from engagement_orders where status in ('paused', 'cancelled'))
        order by place_at asc
        limit 30
      `;
  if (due.length > 0) console.log(`[drops] ${due.length} due${orderId ? ` for ${orderId.slice(0, 8)}` : ""}`);
  else if (orderId) {
    const waiting = await sql<DueDrop>`
      select id, order_id, user_id, platform, link, engagement_type, quantity, provider_service_id, api_url, api_key, error, place_at::text as place_at
      from delivery_drops
      where order_id = ${orderId} and status = 'waiting'
        and order_id not in (select id from engagement_orders where status in ('paused', 'cancelled'))
      order by place_at asc
    `;
    const now = Date.now();
    const overdue = waiting.filter((drop) => new Date(drop.place_at || 0).getTime() <= now + 5000);
    if (overdue.length > 0) {
      console.log(`[drops] ${overdue.length} overdue by clock for ${orderId.slice(0, 8)}`);
      due.push(...overdue);
    } else if (waiting[0]) {
      const mins = Math.round((new Date(waiting[0].place_at || 0).getTime() - now) / 60000);
      if (mins <= 2) console.log(`[drops] next ${waiting[0].engagement_type} in ${mins}m`);
    }
  }
  const { placeChunk, providerOrderStatus, providerPhase, deliveryPhase, NO_PROVIDER } = await import("@/lib/providers.server");
  for (const drop of due) {
    const claimed = await sql<{ id: string }>`
      update delivery_drops set status = 'placing' where id = ${drop.id} and status = 'waiting' returning id
    `;
    if (claimed.length === 0) {
      console.log(`[drops] skip ${drop.engagement_type} ${drop.id.slice(0, 8)} — already claimed`);
      continue;
    }
    const open = await sql<{ provider_order_id: string | null; api_url: string | null; api_key: string | null; quantity: number; engagement_type: string; tracked_sent: number; provider_status: string | null }>`
      select provider_order_id, api_url, api_key, quantity, engagement_type, coalesce(tracked_sent, 0)::int as tracked_sent, provider_status
      from delivery_drops
      where order_id = ${drop.order_id}
        and engagement_type = ${drop.engagement_type}
        and status = 'placed'
        and id <> ${drop.id}
      order by place_at asc
    `;
    let blocked = false;
    for (const prev of open) {
      if ((prev.tracked_sent || 0) >= prev.quantity) continue;
      let phase = deliveryPhase(prev.provider_status || "");
      if (prev.provider_order_id && prev.api_key) {
        try {
          const status = await providerOrderStatus(prev.provider_order_id, prev.api_url || undefined, prev.api_key);
          phase = deliveryPhase(status.status);
          await stampDropPhase(prev.provider_order_id, status.status, phase === "complete" || phase === "closed" || phase === "partial" ? phase : "open");
        } catch {
          if (phase === "complete" || phase === "closed" || phase === "partial") continue;
          blocked = true;
          break;
        }
      }
      if (phase === "complete" || phase === "closed" || phase === "partial") continue;
      blocked = true;
      break;
    }
    if (blocked) {
      const when = new Date(Date.now() + 60 * 1000).toISOString();
      console.log(`[drops] hold ${drop.engagement_type} ${drop.id.slice(0, 8)} — previous run not 100% delivered`);
      await sql`
        update delivery_drops
        set status = 'waiting', place_at = ${when}, error = ${"hold: previous run is not 100% delivered yet"}
        where id = ${drop.id}
      `;
      continue;
    }
    const caps = await sql<{ quantity: number }>`
      select quantity from engagement_order_items
      where order_id = ${drop.order_id} and user_id = ${drop.user_id} and engagement_type = ${drop.engagement_type}
      limit 1
    `;
    if (caps[0]) {
      const used = await sql<{ qty: number }>`
        select coalesce(sum(quantity), 0)::int as qty from delivery_drops
        where order_id = ${drop.order_id} and user_id = ${drop.user_id} and engagement_type = ${drop.engagement_type}
          and status in ('placed', 'placing') and id <> ${drop.id}
      `;
      const room = caps[0].quantity - (used[0]?.qty ?? 0);
      if (room < 1) {
        await sql`update delivery_drops set status = 'cancelled', error = ${"stopped: ordered quantity is already placed"} where id = ${drop.id}`;
        continue;
      }
      if (drop.quantity > room) {
        drop.quantity = room;
        await sql`update delivery_drops set quantity = ${room} where id = ${drop.id}`;
      }
    }
    try {
      const core = CORE_TYPES.has(drop.engagement_type);
      const pinnedId = String(drop.provider_service_id || "");
      const pinned = /^\d+$/.test(pinnedId) && Boolean(drop.api_key) && Boolean(drop.api_url);
      const sent = await (async () => {
        if (pinned) {
          const { placeExactOnProvider } = await import("@/lib/providers.server");
          const exact = await placeExactOnProvider({
            serviceId: pinnedId,
            link: drop.link,
            quantity: drop.quantity,
            apiUrl: drop.api_url || undefined,
            apiKey: drop.api_key || undefined,
          });
          return { orderId: exact.orderId, serviceId: exact.serviceId, label: `#${exact.serviceId}`, apiUrl: drop.api_url || "", apiKey: drop.api_key || "", quantity: exact.quantity || drop.quantity };
        }
        const { bindingMap } = await import("@/lib/admin.server");
        const binding = (await bindingMap())[`${drop.platform}:${drop.engagement_type}`];
        const units = (value?: number) => {
          const amount = Math.max(0, Number(value) || 0);
          return amount > 0 ? amount / 1_000_000 : undefined;
        };
        const rateMinUsd = units(binding?.rate_min_units);
        const rateMaxUsd = units(binding?.rate_max_units);
        if (binding?.pick_mode === "ids") {
          const ids = binding.pinned_ids || [];
          if (ids.length === 0) throw new Error("No service ID saved. Add one in Full Engagement APIs or switch this section back to Auto.");
          const providers = await providersFor(drop.platform, drop.engagement_type);
          if (providers.length === 0) throw new Error(NO_PROVIDER);
          return placePinnedService({
            platform: drop.platform,
            type: drop.engagement_type,
            link: drop.link,
            quantity: drop.quantity,
            dropId: drop.id,
            ids,
            providers,
            rateMinUsd,
            rateMaxUsd,
          });
        }
        if (core) {
          const providers = await providersFor(drop.platform, drop.engagement_type);
          if (providers.length === 0) throw new Error(NO_PROVIDER);
          const history = await sql<{ api_key: string | null; provider_service_id: string | null; provider_order_id: string | null; api_url: string | null; quantity: number }>`
            select api_key, provider_service_id, provider_order_id, api_url, quantity
            from delivery_drops
            where order_id = ${drop.order_id} and engagement_type = ${drop.engagement_type} and status = 'placed'
          `;
          const usedKeys = history.map((row) => String(row.api_key || "")).filter(Boolean);
          const usedServiceIds: Record<string, string[]> = {};
          for (const row of history) {
            const key = String(row.api_key || "");
            const service = String(row.provider_service_id || "");
            if (!key || !service) continue;
            usedServiceIds[key] = [...(usedServiceIds[key] || []), service];
          }
          const pendingByKey = await pendingLoads(drop.engagement_type, providers);
          const activeByService = await activeServiceLoads(drop.platform, drop.engagement_type);
          const serviceLimit = await serviceActiveLimit();
          return placeChunk({
            platform: drop.platform,
            type: drop.engagement_type,
            link: drop.link,
            quantity: drop.quantity,
            providers,
            usedKeys,
            usedServiceIds,
            pendingByKey,
            activeByService,
            serviceLimit,
            rateMinUsd,
            rateMaxUsd,
          });
        }
        const kind = guessKind(drop.engagement_type);
        const providers = await providersFor(drop.platform, kind === drop.engagement_type ? kind : "single");
        const pool = providers.length ? providers : await providersFor(drop.platform, "single");
        if (pool.length === 0) throw new Error(NO_PROVIDER);
        console.log(`[drops] single ${kind} x${drop.quantity} searching ${pool.length} APIs`);
        return placeChunk({
          platform: drop.platform,
          type: kind,
          link: drop.link,
          quantity: drop.quantity,
          providers: pool,
          activeByService: await activeServiceLoads(drop.platform, kind),
          serviceLimit: await serviceActiveLimit(),
          rateMinUsd,
          rateMaxUsd,
        });
      })();
      await sql`
        update delivery_drops
        set status = 'placed', provider_status = 'pending', provider_order_id = ${sent.orderId}, service_label = ${sent.label}, provider_service_id = ${sent.serviceId}, api_url = ${sent.apiUrl || null}, api_key = ${sent.apiKey || null}, quantity = ${sent.quantity || drop.quantity}, error = null
        where id = ${drop.id}
      `;
      console.log(`[drops] placed ${drop.engagement_type} x${drop.quantity} via #${sent.serviceId} for order ${drop.order_id.slice(0, 8)} → ${sent.orderId}`);
      await sql`
        update engagement_order_items
        set delivered = coalesce((
          select sum(quantity)::int from delivery_drops
          where order_id = ${drop.order_id} and user_id = ${drop.user_id} and engagement_type = ${drop.engagement_type} and status = 'placed'
        ), 0),
            status = 'processing'
        where order_id = ${drop.order_id} and user_id = ${drop.user_id} and engagement_type = ${drop.engagement_type}
      `;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider rejected this drop.";
      const balanceHold = /hold: API balance|not enough funds|insufficient balance|not enough balance/i.test(message);
      const pinnedHold = /hold: pinned service/i.test(message);
      if (pinnedHold) {
        const when = new Date(Date.now() + 2 * 60 * 1000).toISOString();
        console.log(`[drops] ${drop.engagement_type} waiting — ${message}`);
        await sql`
          update delivery_drops
          set status = 'waiting', place_at = ${when}, error = ${message.slice(0, 280)}
          where id = ${drop.id}
        `;
        continue;
      }
      const quantityProblem = /quantity|multiple|minimal|minimum/i.test(message) && !/balance|funds/i.test(message);
      const bumps = Number((drop.error || "").match(/bump (\d+)/)?.[1] || 0);
      if (quantityProblem && bumps < 8) {
        const next = nextQuantity(drop.quantity, message);
        console.log(`[drops] ${drop.engagement_type} ${drop.quantity} → ${next} because the service refused the quantity`);
        await sql`
          update delivery_drops
          set status = 'waiting', quantity = ${next}, place_at = now(), error = ${`bump ${bumps + 1}: quantity raised to ${next} and placing again`}
          where id = ${drop.id}
        `;
        continue;
      }
      const permanent = /no api key|disabled|no provider available|no service id saved|outside the price range/i.test(message);
      const attempts = Number((drop.error || "").match(/^retry (\d+)/)?.[1] || 0);
      if (balanceHold || (!permanent && attempts < 12)) {
        const when = new Date(Date.now() + (balanceHold ? 3 : 2) * 60 * 1000).toISOString();
        console.error(`[drops] retry ${attempts + 1} ${drop.engagement_type} x${drop.quantity}: ${message}`);
        await sql`
          update delivery_drops
          set status = 'waiting', place_at = ${when}, error = ${`${balanceHold ? "hold" : "retry"} ${attempts + 1}: ${message}`.slice(0, 280)}
          where id = ${drop.id}
        `;
      } else {
        console.error(`[drops] FAIL ${drop.engagement_type} x${drop.quantity}: ${message}`);
        await sql`update delivery_drops set status = 'failed', error = ${`gaveup: ${message}`.slice(0, 280)} where id = ${drop.id}`;
      }
    }
    await refreshOrderStatus(drop.order_id, drop.user_id);
  }
}

async function refreshOrderStatus(orderId: string, userId: string) {
  const sql = await getSql();
  const counts = await sql<{ waiting: number; failed: number; placed: number }>`
    select
      count(*) filter (where status = 'waiting' or status = 'placing')::int as waiting,
      count(*) filter (where status = 'failed')::int as failed,
      count(*) filter (where status = 'placed')::int as placed
    from delivery_drops
    where order_id = ${orderId} and user_id = ${userId}
  `;
  const row = counts[0];
  let status = "processing";
  if (row && row.waiting === 0) {
    if (row.failed > 0 && row.placed === 0) {
      status = "failed";
    } else {
      const { providerOrderStatus, providerPhase } = await import("@/lib/providers.server");
      const placed = await sql<{ provider_order_id: string | null; api_url: string | null; api_key: string | null }>`
        select provider_order_id, api_url, api_key
        from delivery_drops
        where order_id = ${orderId} and user_id = ${userId} and status = 'placed'
      `;
      let open = false;
      for (const drop of placed) {
        if (!drop.provider_order_id || !drop.api_key || !drop.api_url) {
          open = true;
          continue;
        }
        try {
          const live = await providerOrderStatus(drop.provider_order_id, drop.api_url, drop.api_key);
          const phase = providerPhase(live.status);
          await stampDropPhase(drop.provider_order_id, live.status, phase);
          if (phase === "open") open = true;
        } catch {
          open = true;
        }
      }
      if (!open) status = row.failed > 0 ? "partial" : "complete";
    }
  }
  await sql`update engagement_orders set status = ${status} where id = ${orderId} and user_id = ${userId}`;
}

export async function scheduleFixed(input: {
  userId: string;
  orderId: string;
  platform: string;
  link: string;
  engagementType: string;
  providerServiceId: string;
  apiUrl: string;
  apiKey: string;
  amount: number;
  runs: number;
  intervalMinutes: number;
}) {
  const sql = await getSql();
  const start = Date.now();
  const runs = Math.max(1, Math.min(200, input.runs));
  const gap = Math.max(1, input.intervalMinutes) * 60 * 1000;
  for (let index = 0; index < runs; index += 1) {
    await sql`
      insert into delivery_drops (
        id, order_id, user_id, platform, link, engagement_type, quantity, place_at, status,
        provider_service_id, api_url, api_key
      ) values (
        ${crypto.randomUUID()}, ${input.orderId}, ${input.userId}, ${input.platform}, ${input.link},
        ${input.engagementType}, ${input.amount}, ${new Date(start + gap * index).toISOString()}, 'waiting',
        ${input.providerServiceId}, ${input.apiUrl}, ${input.apiKey}
      )
    `;
  }
  await flushDueDrops(input.orderId);
}

export async function editDrop(userId: string, id: string, quantity: number, placeAt: string) {
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    update delivery_drops
    set quantity = ${quantity}, place_at = ${placeAt}
    where id = ${id} and user_id = ${userId} and status in ('waiting', 'paused')
    returning id
  `;
  if (rows.length === 0) throw new Error("Only a pending run can be edited.");
}

export async function setDropState(userId: string, id: string, status: "waiting" | "paused" | "cancelled") {
  const sql = await getSql();
  const rows = await sql<{ id: string; status: string; provider_order_id: string | null; api_url: string | null; api_key: string | null }>`
    select id, status, provider_order_id, api_url, api_key
    from delivery_drops
    where id = ${id} and user_id = ${userId}
    limit 1
  `;
  const drop = rows[0];
  if (!drop) throw new Error("Run not found.");
  if (drop.status === "cancelled") return;
  if (status !== "cancelled" && !["waiting", "paused"].includes(drop.status)) throw new Error("That run is already placed.");
  if (status === "cancelled" && drop.status === "placed" && drop.provider_order_id) {
    try {
      const { cancelProviderOrder } = await import("@/lib/providers.server");
      await cancelProviderOrder(drop.provider_order_id, drop.api_url || undefined, drop.api_key || undefined);
    } catch {
      /* the panel still stops this run so the next one can go */
    }
  }
  if (status === "cancelled" && !["waiting", "paused", "placing", "placed", "failed"].includes(drop.status)) {
    throw new Error("That run cannot be cancelled.");
  }
  await sql`
    update delivery_drops
    set status = ${status}, error = ${status === "cancelled" ? "Cancelled from the order rack." : ""}
    where id = ${id} and user_id = ${userId}
  `;
}

async function refundUnused(userId: string, orderId: string, type?: string) {
  const sql = await getSql();
  await sql`alter table engagement_order_items add column if not exists refunded_paise integer not null default 0`;
  await sql`alter table engagement_orders add column if not exists refunded_paise integer not null default 0`;
  const items = await sql<{ id: string; engagement_type: string; quantity: number; price_paise: number; refunded_paise: number }>`
    select id, engagement_type, quantity, price_paise, coalesce(refunded_paise, 0)::int as refunded_paise
    from engagement_order_items
    where user_id = ${userId} and order_id = ${orderId}
  `;
  let total = 0;
  for (const item of items) {
    if (type && item.engagement_type !== type) continue;
    const placed = await sql<{ qty: number }>`
      select coalesce(sum(quantity), 0)::int as qty
      from delivery_drops
      where user_id = ${userId} and order_id = ${orderId} and engagement_type = ${item.engagement_type} and status = 'placed'
    `;
    const usedQty = Math.min(item.quantity, placed[0]?.qty ?? 0);
    const usedPaise = item.quantity > 0 ? Math.round((item.price_paise * usedQty) / item.quantity) : item.price_paise;
    const back = Math.max(0, item.price_paise - usedPaise - item.refunded_paise);
    if (back < 1) continue;
    await sql`update engagement_order_items set refunded_paise = coalesce(refunded_paise, 0) + ${back} where id = ${item.id}`;
    total += back;
  }
  if (total < 1) return 0;
  const { creditCustomer } = await import("@/lib/admin.server");
  const label = type ? `${type} cancelled` : "order cancelled";
  await creditCustomer(userId, total, `Refund ${orderId.slice(0, 8)} ${label}. Placed runs were kept.`);
  await sql`update engagement_orders set refunded_paise = coalesce(refunded_paise, 0) + ${total} where id = ${orderId} and user_id = ${userId}`;
  return total;
}

export async function setOrderRunState(userId: string, orderId: string, status: "waiting" | "paused" | "cancelled") {
  const sql = await getSql();
  const orders = await sql<{ id: string }>`select id from engagement_orders where id = ${orderId} and user_id = ${userId}`;
  if (orders.length === 0) throw new Error("Order not found.");
  if (status === "cancelled") {
    await sql`update engagement_orders set status = 'cancelled' where id = ${orderId} and user_id = ${userId}`;
    await sql`
      update delivery_drops
      set status = 'cancelled', error = ${"cancelled with the full order"}
      where order_id = ${orderId} and user_id = ${userId} and status in ('waiting', 'paused', 'placing')
    `;
    await sql`update engagement_order_items set status = 'cancelled' where order_id = ${orderId} and user_id = ${userId} and status <> 'complete'`;
    const open = await sql<{ provider_order_id: string; api_url: string | null; api_key: string | null }>`
      select provider_order_id, api_url, api_key
      from delivery_drops
      where order_id = ${orderId} and user_id = ${userId} and status = 'placed' and provider_order_id is not null
    `;
    const { cancelProviderOrder } = await import("@/lib/providers.server");
    for (const row of open) {
      try {
        await cancelProviderOrder(row.provider_order_id, row.api_url || undefined, row.api_key || undefined);
      } catch {
        /* provider may already have finished this run */
      }
    }
    await refundUnused(userId, orderId);
    return;
  }
  if (status === "paused") {
    await sql`update engagement_orders set status = 'paused' where id = ${orderId} and user_id = ${userId}`;
    await sql`
      update delivery_drops
      set status = 'paused', error = ${"paused with the full order"}
      where order_id = ${orderId} and user_id = ${userId} and status in ('waiting', 'placing')
    `;
    return;
  }
  await sql`update engagement_orders set status = 'processing' where id = ${orderId} and user_id = ${userId} and status = 'paused'`;
  await sql`
    update delivery_drops
    set status = 'waiting', error = null
    where order_id = ${orderId} and user_id = ${userId} and status = 'paused'
  `;
}

export async function setTypeState(userId: string, orderId: string, type: string, status: "waiting" | "paused" | "cancelled") {
  const sql = await getSql();
  if (status === "cancelled") {
    await sql`
      update delivery_drops
      set status = 'cancelled', error = ${"cancelled"}
      where user_id = ${userId} and order_id = ${orderId} and engagement_type = ${type} and status in ('waiting', 'paused', 'placing')
    `;
    await sql`
      update engagement_order_items
      set status = 'cancelled'
      where user_id = ${userId} and order_id = ${orderId} and engagement_type = ${type}
    `;
    const open = await sql<{ provider_order_id: string; api_url: string | null; api_key: string | null }>`
      select provider_order_id, api_url, api_key
      from delivery_drops
      where user_id = ${userId} and order_id = ${orderId} and engagement_type = ${type}
        and status = 'placed' and provider_order_id is not null
    `;
    const { cancelProviderOrder } = await import("@/lib/providers.server");
    for (const row of open) {
      try {
        await cancelProviderOrder(row.provider_order_id, row.api_url || undefined, row.api_key || undefined);
      } catch {
        /* provider may already have finished this run */
      }
    }
    await refundUnused(userId, orderId, type);
    return;
  }
  await sql`
    update delivery_drops
    set status = ${status}, error = null
    where user_id = ${userId} and order_id = ${orderId} and engagement_type = ${type} and status in ('waiting', 'paused')
  `;
}

export async function refillType(userId: string, orderId: string, type: string) {
  const sql = await getSql();
  const items = await sql<{ quantity: number }>`
    select quantity from engagement_order_items
    where user_id = ${userId} and order_id = ${orderId} and engagement_type = ${type}
    limit 1
  `;
  const target = items[0]?.quantity ?? 0;
  const placed = await sql<{ qty: number }>`
    select coalesce(sum(quantity), 0)::int as qty from delivery_drops
    where user_id = ${userId} and order_id = ${orderId} and engagement_type = ${type} and status = 'placed'
  `;
  const waiting = await sql<{ n: number }>`
    select count(*)::int as n from delivery_drops
    where user_id = ${userId} and order_id = ${orderId} and engagement_type = ${type} and status in ('waiting', 'paused', 'placing')
  `;
  if ((waiting[0]?.n ?? 0) > 0) throw new Error("Pending runs are still scheduled for this type.");
  const remaining = target - (placed[0]?.qty ?? 0);
  if (remaining < 1) throw new Error("Nothing left to refill.");
  const last = await sql<{ platform: string; link: string; provider_service_id: string | null; api_url: string | null; api_key: string | null }>`
    select platform, link, provider_service_id, api_url, api_key
    from delivery_drops
    where user_id = ${userId} and order_id = ${orderId} and engagement_type = ${type}
    order by place_at desc
    limit 1
  `;
  const sample = last[0];
  if (!sample) throw new Error("No earlier run to copy.");
  const at = new Date(Date.now() + 60_000).toISOString();
  await sql`
    insert into delivery_drops (
      id, order_id, user_id, platform, link, engagement_type, quantity, place_at, status,
      provider_service_id, api_url, api_key
    ) values (
      ${crypto.randomUUID()}, ${orderId}, ${userId}, ${sample.platform}, ${sample.link}, ${type}, ${remaining}, ${at}, 'waiting',
      ${sample.provider_service_id}, ${sample.api_url}, ${sample.api_key}
    )
  `;
}

async function trackRecent() {
  const sql = await getSql();
  const rows = await sql<{ order_id: string }>`
    select order_id
    from delivery_drops
    where status = 'placed'
      and coalesce(tracked_sent, 0) < quantity
      and order_id not in (select id from engagement_orders where status in ('paused', 'cancelled'))
    group by order_id
    order by max(place_at) desc
    limit 6
  `;
  for (const row of rows) {
    try {
      await trackOrder(row.order_id);
    } catch (error) {
      console.error("[drops] track", error);
    }
  }
}

export function startDropWorker() {
  if (globalWorker.__dropWorker) return;
  console.log("[drops] worker started");
  let ticks = 0;
  globalWorker.__dropWorker = setInterval(() => {
    ticks += 1;
    if (ticks % 12 === 0) console.log("[drops] worker alive");
    flushDueDrops().catch((error) => console.error("[drops]", error));
    trackRecent().catch((error) => console.error("[drops] track", error));
    if (ticks === 30 || ticks % 1800 === 0) {
      import("@/lib/admin.server")
        .then((mod) => mod.syncManagedServices())
        .catch((error) => console.error("[catalog]", error));
    }
  }, 2000);
  flushDueDrops().catch((error) => console.error("[drops]", error));
}
