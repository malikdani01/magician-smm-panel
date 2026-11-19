import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin.server";
import { lineCount, serviceForm } from "@/lib/service-form";
import { listGrowthCatalog } from "@/lib/organic";

export type ServiceRow = {
  id: string;
  platform: string;
  engagement_type: string;
  name: string;
  price_per_1k_paise: number;
  price_per_10k_paise: number;
  min_quantity: number;
  max_quantity: number;
};

export type BundleItem = {
  id: string;
  engagement_type: string;
  ratio_bps: number;
  is_base: boolean;
  service_id: string;
  name: string;
  price_per_1k_paise: number;
  price_per_10k_paise: number;
  min_quantity: number;
  max_quantity: number;
};

export type BundleRow = {
  id: string;
  name: string;
  platform: string;
  tagline: string;
  items: BundleItem[];
};

export type OrderItem = {
  id: string;
  engagement_type: string;
  service_name: string;
  quantity: number;
  delivered: number;
  price_paise: number;
  status: string;
};

export type OrderRow = {
  id: string;
  order_number: string;
  bundle_id: string;
  platform: string;
  link: string;
  base_quantity: number;
  total_paise: number;
  status: string;
  organic: boolean;
  interval_hours: number;
  variance_percent: number;
  provider_state: string;
  created_at: string;
  preview_json?: string | null;
  items: OrderItem[];
};

export type TxnRow = {
  id: string;
  kind: string;
  amount_paise: number;
  note: string;
  created_at: string;
};

export type DashboardData = {
  balance_paise: number;
  order_count: number;
  queued_count: number;
  spend_paise: number;
  recent: OrderRow[];
  days: { day: string; spend_paise: number }[];
};

type CreateInput = {
  bundleId: string;
  link: string;
  baseQuantity: number;
  organic: boolean;
  intervalHours: number;
  variancePercent: number;
  enabledTypes: string[];
  quantities?: Record<string, number>;
  delivery?: Record<string, { hours: number; runs: number; variance?: number; peak?: boolean; curve?: number[] }>;
  drops?: { type: string; amount: number; at: string }[];
};

async function ensureWallet(userId: string) {
  const sql = await getSql();
  await sql`
    insert into wallets (user_id, balance_paise)
    values (${userId}, 0)
    on conflict (user_id) do nothing
  `;
  return sql;
}

function moneyLines(
  items: {
    engagement_type: string;
    ratio_bps: number;
    is_base: boolean;
    name: string;
    price_per_1k_paise: number;
    price_per_10k_paise: number;
    min_quantity: number;
    max_quantity: number;
  }[],
  baseQuantity: number,
  enabled: Set<string>,
  quantities?: Record<string, number>,
) {
  const lines = [];
  for (const item of items) {
    if (!enabled.has(item.engagement_type)) continue;
    const override = quantities?.[item.engagement_type];
    const raw =
      typeof override === "number" && Number.isFinite(override) && override > 0
        ? override
        : item.is_base
          ? baseQuantity
          : Math.round((baseQuantity * item.ratio_bps) / 10000);
    if (raw <= 0) continue;
    const quantity = Math.min(item.max_quantity, Math.round(raw));
    if (quantity <= 0) continue;
    const rate = item.price_per_10k_paise || item.price_per_1k_paise * 10;
    const price_paise = Math.max(1, Math.round((quantity * rate) / 10000));
    lines.push({
      engagement_type: item.engagement_type,
      service_name: item.name,
      quantity,
      price_paise,
    });
  }
  return lines;
}

async function withPanelPrices<T extends { engagement_type: string; quantity: number; price_paise: number }>(platform: string, lines: T[]) {
  const { panelTypeRates } = await import("@/lib/admin.server");
  const rates = await panelTypeRates(platform);
  return lines.map((line) => {
    const paise = rates[line.engagement_type];
    if (!paise) return line;
    return { ...line, price_paise: Math.max(1, Math.round((line.quantity / 1000) * paise)) };
  });
}

let catalogMemo: { services: ServiceRow[]; bundles: BundleRow[]; providers_connected: 0 } | null = null;
let commentsSeeded = false;

export const apiBalances = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { deskRole } = await import("@/lib/admin.server");
    if ((await deskRole(context.userId)) !== "admin") return [];
    const { listApiBalances } = await import("@/lib/providers.server");
    return listApiBalances();
  });

export const getCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  if (!commentsSeeded) {
    await sql`
      insert into services (id, platform, engagement_type, name, price_per_1k_paise, min_quantity, max_quantity) values
        ('tt-comments', 'tiktok', 'comments', 'Cue comments', 900, 10, 100000)
      on conflict (id) do nothing
    `;
    await sql`
      insert into bundle_items (id, bundle_id, service_id, engagement_type, ratio_bps, is_base) values
        ('bi-tt-c', 'bundle-tt', 'tt-comments', 'comments', 80, false)
      on conflict (id) do nothing
    `;
    commentsSeeded = true;
    catalogMemo = null;
  }
  if (catalogMemo) return catalogMemo;
  const services = await sql<ServiceRow>`
    select id, platform, engagement_type, name, price_per_1k_paise, coalesce(price_per_10k_paise, price_per_1k_paise * 10) as price_per_10k_paise, min_quantity, max_quantity
    from services
    order by platform, engagement_type
  `;
  const bundles = await sql<{
    id: string;
    name: string;
    platform: string;
    tagline: string;
  }>`select id, name, platform, tagline from bundles order by name`;
  const items = await sql<
    BundleItem & { bundle_id: string }
  >`
    select
      bi.id,
      bi.bundle_id,
      bi.engagement_type,
      bi.ratio_bps,
      bi.is_base,
      s.id as service_id,
      s.name,
      s.price_per_1k_paise,
      coalesce(s.price_per_10k_paise, s.price_per_1k_paise * 10) as price_per_10k_paise,
      s.min_quantity,
      s.max_quantity
    from bundle_items bi
    join services s on s.id = bi.service_id
    order by bi.is_base desc, bi.engagement_type
  `;
  const grouped: BundleRow[] = bundles.map((bundle) => ({
    ...bundle,
    items: items
      .filter((item) => item.bundle_id === bundle.id)
      .map(({ bundle_id: _bundleId, ...item }) => item),
  }));
  catalogMemo = { services, bundles: grouped, providers_connected: 0 as const };
  return catalogMemo;
});

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<DashboardData> => {
    const sql = await ensureWallet(context.userId);
    const wallet = await sql<{ balance_paise: number }>`
      select balance_paise from wallets where user_id = ${context.userId}
    `;
    const counts = await sql<{ order_count: number; queued_count: number; spend_paise: number }>`
      select
        count(*)::int as order_count,
        count(*) filter (where status = 'queued')::int as queued_count,
        coalesce(sum(total_paise), 0)::int as spend_paise
      from engagement_orders
      where user_id = ${context.userId}
    `;
    const recent = await loadOrders(context.userId, 5);
    const days = await sql<{ day: string; spend_paise: number }>`
      select to_char(created_at, 'YYYY-MM-DD') as day, coalesce(sum(total_paise), 0)::int as spend_paise
      from engagement_orders
      where user_id = ${context.userId}
      group by 1
      order by 1 asc
      limit 14
    `;
    const row = counts[0];
    return {
      balance_paise: wallet[0]?.balance_paise ?? 0,
      order_count: row?.order_count ?? 0,
      queued_count: row?.queued_count ?? 0,
      spend_paise: row?.spend_paise ?? 0,
      recent,
      days,
    };
  });

async function loadOrders(userId: string, limit: number, orderId?: string): Promise<OrderRow[]> {
  const sql = await getSql();
  await sql`alter table engagement_orders add column if not exists preview_json text`;
  const orders = orderId
    ? await sql<Omit<OrderRow, "items">>`
        select id, order_number, bundle_id, platform, link, base_quantity, total_paise, status,
               organic, interval_hours, variance_percent, provider_state, preview_json, created_at::text as created_at
        from engagement_orders
        where user_id = ${userId} and id = ${orderId}
      `
    : await sql<Omit<OrderRow, "items">>`
        select id, order_number, bundle_id, platform, link, base_quantity, total_paise, status,
               organic, interval_hours, variance_percent, provider_state, preview_json, created_at::text as created_at
        from engagement_orders
        where user_id = ${userId}
        order by created_at desc
        limit ${limit}
      `;
  if (orders.length === 0) return [];
  const items = orderId
    ? await sql<OrderItem & { order_id: string }>`
        select id, order_id, engagement_type, service_name, quantity, delivered, price_paise, status
        from engagement_order_items
        where user_id = ${userId} and order_id = ${orderId}
        order by engagement_type
      `
    : await sql<OrderItem & { order_id: string }>`
        select id, order_id, engagement_type, service_name, quantity, delivered, price_paise, status
        from engagement_order_items
        where user_id = ${userId}
        order by engagement_type
      `;
  return orders.map((order) => ({
    ...order,
    organic: Boolean(order.organic),
    items: items
      .filter((item) => item.order_id === order.id)
      .map(({ order_id: _orderId, ...item }) => item),
  }));
}

export const listOrders = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { t?: number; limit?: number } | undefined) => {
    const limit = Math.min(200, Math.max(1, Math.floor(Number(input?.limit) || 50)));
    return { limit };
  })
  .handler(async ({ context, data }) => loadOrders(context.userId, data.limit));

export const getOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: string | { id?: string; t?: number }) => {
    const id = typeof input === "string" ? input : String(input?.id || "");
    if (id.length < 8) throw new Error("Missing order.");
    return id;
  })
  .handler(async ({ context, data }) => {
    const rows = await loadOrders(context.userId, 1, data);
    return rows[0] ?? null;
  });

export const listOrderDrops = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: string | { id?: string; t?: number }) => {
    const id = typeof input === "string" ? input : String(input?.id || "");
    if (id.length < 8) throw new Error("Missing order.");
    return id;
  })
  .handler(async ({ context, data }) => {
    const { listOrderDrops: load } = await import("@/lib/drip.server");
    return load(context.userId, data);
  });

export const editScheduledDrop = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; quantity: number; placeAt: string }) => {
    const quantity = Math.floor(Number(input?.quantity));
    const placeAt = new Date(String(input?.placeAt || ""));
    if (!input?.id || quantity < 1) throw new Error("Enter a quantity.");
    if (Number.isNaN(placeAt.getTime())) throw new Error("Pick a valid time.");
    return { id: String(input.id), quantity, placeAt: placeAt.toISOString() };
  })
  .handler(async ({ context, data }) => {
    const { editDrop } = await import("@/lib/drip.server");
    await editDrop(context.userId, data.id, data.quantity, data.placeAt);
    return { ok: true as const };
  });

export const refillEngagement = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { orderId: string; type: string }) => {
    if (!input?.orderId || !input?.type) throw new Error("Missing refill.");
    return { orderId: String(input.orderId), type: String(input.type) };
  })
  .handler(async ({ context, data }) => {
    const { refillType } = await import("@/lib/drip.server");
    await refillType(context.userId, data.orderId, data.type);
    return { ok: true as const };
  });

export const checkDropStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => {
    if (!id) throw new Error("Missing run.");
    return String(id);
  })
  .handler(async ({ context, data }) => {
    const sql = (await import("@/lib/db")).getSql;
    const db = await sql();
    const rows = await db<{ provider_order_id: string | null; api_url: string | null; api_key: string | null }>`
      select provider_order_id, api_url, api_key from delivery_drops
      where id = ${data} and user_id = ${context.userId}
      limit 1
    `;
    const drop = rows[0];
    if (!drop?.provider_order_id) throw new Error("This run has no provider order yet.");
    const { providerOrderStatus } = await import("@/lib/providers.server");
    return providerOrderStatus(drop.provider_order_id, drop.api_url || undefined, drop.api_key || undefined);
  });

export const setRunState = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; orderId?: string; type?: string; status: "waiting" | "paused" | "cancelled" }) => {
    if (!["waiting", "paused", "cancelled"].includes(input?.status)) throw new Error("Bad status.");
    return input;
  })
  .handler(async ({ context, data }) => {
    const { setDropState, setTypeState } = await import("@/lib/drip.server");
    if (data.id) await setDropState(context.userId, data.id, data.status);
    else if (data.orderId && data.type) await setTypeState(context.userId, data.orderId, data.type, data.status);
    else throw new Error("Missing run.");
    return { ok: true as const };
  });

export const setOrderFlow = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { orderId: string; status: "waiting" | "paused" | "cancelled" }) => {
    if (!input?.orderId || !["waiting", "paused", "cancelled"].includes(input?.status)) throw new Error("Bad order action.");
    return input;
  })
  .handler(async ({ context, data }) => {
    const { setOrderRunState } = await import("@/lib/drip.server");
    await setOrderRunState(context.userId, data.orderId, data.status);
    return { ok: true as const };
  });

export const getWallet = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await ensureWallet(context.userId);
    const wallet = await sql<{ balance_paise: number }>`
      select balance_paise from wallets where user_id = ${context.userId}
    `;
    const transactions = await sql<TxnRow>`
      select id, kind, amount_paise, note, created_at::text as created_at
      from wallet_transactions
      where user_id = ${context.userId}
      order by created_at desc
      limit 40
    `;
    return { balance_paise: wallet[0]?.balance_paise ?? 0, transactions };
  });

const TOPUPS_MIN = 10000;
const TOPUPS_MAX = 50_000_000;

export const creditWallet = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((amountPaise: number) => {
    const amount = Math.floor(Number(amountPaise));
    if (!Number.isFinite(amount) || amount < TOPUPS_MIN || amount > TOPUPS_MAX) {
      throw new Error("Amount must be between ₹100 and ₹5,00,000.");
    }
    return amount;
  })
  .handler(async ({ context, data }) => {
    const sql = await ensureWallet(context.userId);
    const id = crypto.randomUUID();
    await sql`
      update wallets
      set balance_paise = balance_paise + ${data}, updated_at = now()
      where user_id = ${context.userId}
    `;
    await sql`
      insert into wallet_transactions (id, user_id, kind, amount_paise, note)
      values (
        ${id},
        ${context.userId},
        'credit',
        ${data},
        'UPI desk credit. No payment gateway is connected — balance is on your ledger.'
      )
    `;
    const wallet = await sql<{ balance_paise: number }>`
      select balance_paise from wallets where user_id = ${context.userId}
    `;
    return { balance_paise: wallet[0]?.balance_paise ?? 0 };
  });

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: CreateInput) => {
    const link = String(input?.link ?? "").trim();
    let parsed: URL;
    try {
      parsed = new URL(link);
    } catch {
      throw new Error("Paste a full link, including https://.");
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("The link needs to start with http or https.");
    }
    const baseQuantity = Math.floor(Number(input.baseQuantity));
    const enabledTypes = Array.isArray(input.enabledTypes)
      ? input.enabledTypes.filter((type) => typeof type === "string")
      : [];
    const viewsOn = enabledTypes.includes("views");
    if (!Number.isFinite(baseQuantity) || baseQuantity < 0 || baseQuantity > 10_000_000 || (viewsOn && baseQuantity < 100)) {
      throw new Error(viewsOn ? "Views quantity must be between 100 and 10,000,000." : "Turn on at least one service.");
    }
    const quantities: Record<string, number> = {};
    if (input.quantities && typeof input.quantities === "object") {
      for (const [type, value] of Object.entries(input.quantities)) {
        const quantity = Math.floor(Number(value));
        if (Number.isFinite(quantity) && quantity > 0 && quantity <= 50_000_000) quantities[type] = quantity;
      }
    }
    const delivery: Record<string, { hours: number; runs: number; variance?: number; peak?: boolean; curve?: number[] }> = {};
    if (input.delivery && typeof input.delivery === "object") {
      for (const [type, value] of Object.entries(input.delivery)) {
        const hours = Number(value?.hours);
        const runs = Math.floor(Number(value?.runs));
        if (!Number.isFinite(hours) || hours <= 0 || !Number.isFinite(runs) || runs <= 0) continue;
        const curve = Array.isArray(value.curve) ? value.curve.map(Number).filter((point) => Number.isFinite(point)).slice(0, 12) : [];
        delivery[type] = {
          hours: Math.min(24 * 30, hours),
          runs: Math.min(500, runs),
          variance: Math.min(50, Math.max(0, Math.floor(Number(value.variance) || 0))),
          peak: Boolean(value.peak),
          curve,
        };
      }
    }
    const drops: { type: string; amount: number; at: string }[] = [];
    if (Array.isArray(input.drops)) {
      for (const drop of input.drops.slice(0, 800)) {
        const type = String(drop?.type ?? "");
        const amount = Math.floor(Number(drop?.amount));
        const at = new Date(String(drop?.at ?? ""));
        if (!type || !Number.isFinite(amount) || amount <= 0 || amount > 50_000_000 || Number.isNaN(at.getTime())) continue;
        drops.push({ type, amount, at: at.toISOString() });
      }
    }
    return {
      bundleId: String(input.bundleId ?? ""),
      link,
      baseQuantity,
      organic: Boolean(input.organic),
      intervalHours: Math.min(24 * 30, Math.max(1, Math.floor(Number(input.intervalHours) || 1))),
      variancePercent: Math.min(50, Math.max(0, Math.floor(Number(input.variancePercent) || 0))),
      enabledTypes,
      quantities,
      delivery,
      drops,
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await ensureWallet(context.userId);
    const items = await sql<{
      engagement_type: string;
      ratio_bps: number;
      is_base: boolean;
      name: string;
      price_per_1k_paise: number;
      price_per_10k_paise: number;
      min_quantity: number;
      max_quantity: number;
      platform: string;
    }>`
      select
        bi.engagement_type,
        bi.ratio_bps,
        bi.is_base,
        s.name,
        s.price_per_1k_paise,
        coalesce(s.price_per_10k_paise, s.price_per_1k_paise * 10) as price_per_10k_paise,
        s.min_quantity,
        s.max_quantity,
        b.platform
      from bundle_items bi
      join services s on s.id = bi.service_id
      join bundles b on b.id = bi.bundle_id
      where bi.bundle_id = ${data.bundleId}
    `;
    if (items.length === 0) throw new Error("That cue set is not on the book.");
    const platform = items[0]?.platform ?? "instagram";
    const { bindingMap } = await import("@/lib/admin.server");
    const { PROVIDER_MIN } = await import("@/lib/organic");
    const bindings = await bindingMap();
    const dropSums: Record<string, number> = {};
    for (const drop of data.drops) {
      const slot = bindings[`${platform}:${drop.type}`];
      const min = slot?.min_quantity || PROVIDER_MIN[drop.type] || 1;
      if (drop.amount < min) throw new Error(`Below ${min} not allowed for ${drop.type}.`);
      dropSums[drop.type] = (dropSums[drop.type] || 0) + drop.amount;
    }
    const quantities = data.drops.length ? dropSums : data.quantities;
    const enabled = new Set(data.drops.length ? Object.keys(dropSums) : data.enabledTypes);
    const drafted = moneyLines(items, data.baseQuantity, enabled, quantities).map((line) => {
      const slot = bindings[`${platform}:${line.engagement_type}`];
      if (slot && slot.section_enabled === false) throw new Error(`${line.engagement_type} is turned off for this platform.`);
      const min = slot?.min_quantity || PROVIDER_MIN[line.engagement_type] || 1;
      if (line.quantity < min) throw new Error(`Below ${min} not allowed for ${line.engagement_type}.`);
      return line;
    });
    const lines = await withPanelPrices(platform, drafted);
    if (lines.length === 0) throw new Error("Turn on at least one service.");
    for (const line of lines) {
      const slot = bindings[`${platform}:${line.engagement_type}`];
      const ready = (slot?.providers || []).some((item) => item.api_key && item.api_url) || Boolean(slot?.api_key && slot?.api_url);
      if (!ready) throw new Error("No Provider Available");
    }
    const total = lines.reduce((sum, line) => sum + line.price_paise, 0);
    const wallet = await sql<{ balance_paise: number }>`
      select balance_paise from wallets where user_id = ${context.userId}
    `;
    const balance = wallet[0]?.balance_paise ?? 0;
    if (balance < total) {
      throw new Error("The wallet does not cover this order. Add credit first.");
    }
    const { askFreeModel } = await import("@/lib/providers.server");
    const { armOrder } = await import("@/lib/drip.server");
    const orderId = crypto.randomUUID();
    const orderNumber = `MAG-${Math.floor(100000 + Math.random() * 900000)}`;
    const charged = await sql<{ user_id: string }>`
      update wallets
      set balance_paise = balance_paise - ${total}, updated_at = now()
      where user_id = ${context.userId} and balance_paise >= ${total}
      returning user_id
    `;
    if (charged.length === 0) {
      throw new Error("The wallet does not cover this order. Add credit first.");
    }
    await sql`alter table engagement_orders add column if not exists preview_json text`;
    await sql`
      insert into engagement_orders (
        id, user_id, order_number, bundle_id, platform, link, base_quantity, total_paise,
        status, organic, interval_hours, variance_percent, provider_state, preview_json
      ) values (
        ${orderId}, ${context.userId}, ${orderNumber}, ${data.bundleId}, ${platform}, ${data.link},
        ${data.baseQuantity}, ${total}, 'queued', ${data.organic}, ${data.intervalHours},
        ${data.variancePercent}, 'provider', ${JSON.stringify({ quantities: data.quantities, delivery: data.delivery })}
      )
    `;
    for (const line of lines) {
      await sql`
        insert into engagement_order_items (
          id, order_id, user_id, engagement_type, service_name, quantity, delivered, price_paise, status
        ) values (
          ${crypto.randomUUID()}, ${orderId}, ${context.userId}, ${line.engagement_type},
          ${line.service_name}, ${line.quantity}, 0, ${line.price_paise}, 'queued'
        )
      `;
    }
    await armOrder({
      userId: context.userId,
      orderId,
      platform,
      link: data.link,
      lines: lines.map((line) => ({ engagement_type: line.engagement_type, quantity: line.quantity })),
      plans: data.delivery ?? {},
      drops: data.drops,
    });
    await sql`
      insert into wallet_transactions (id, user_id, kind, amount_paise, note)
      values (
        ${crypto.randomUUID()},
        ${context.userId},
        'debit',
        ${-total},
        ${`Cue ${orderNumber} queued in timed drops.`}
      )
    `;
    if (data.organic) {
      try {
        const aiNote = await askFreeModel(
          "You plan organic social delivery. One short sentence only.",
          `Platform ${platform}. Quantities: ${lines.map((line) => `${line.engagement_type} ${line.quantity}`).join(", ")}.`,
        );
        if (aiNote) {
          await sql`
            insert into wallet_transactions (id, user_id, kind, amount_paise, note)
            values (${crypto.randomUUID()}, ${context.userId}, 'note', 0, ${aiNote.slice(0, 280)})
          `;
        }
      } catch {
        /* free model can be busy; the YoYoMedia order is already placed */
      }
    }
    return { id: orderId, order_number: orderNumber, total_paise: total };
  });

export const simulateDelivery = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => {
    if (typeof id !== "string" || id.length < 8) throw new Error("Missing order.");
    return id;
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const updated = await sql<{ id: string }>`
      update engagement_orders
      set status = 'complete'
      where id = ${data} and user_id = ${context.userId} and status = 'queued'
      returning id
    `;
    if (updated.length === 0) throw new Error("That cue is not waiting.");
    await sql`
      update engagement_order_items
      set delivered = quantity, status = 'complete'
      where order_id = ${data} and user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

export const listTickets = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<{ id: string; subject: string; body: string; created_at: string }>`
      select id, subject, body, created_at::text as created_at
      from support_tickets
      where user_id = ${context.userId}
      order by created_at desc
      limit 20
    `;
  });

export const openTicket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { subject: string; body: string }) => {
    const subject = String(input?.subject ?? "").trim().slice(0, 120);
    const body = String(input?.body ?? "").trim().slice(0, 2000);
    if (subject.length < 3 || body.length < 8) throw new Error("Write a subject and a short note.");
    return { subject, body };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const id = crypto.randomUUID();
    await sql`
      insert into support_tickets (id, user_id, subject, body)
      values (${id}, ${context.userId}, ${data.subject}, ${data.body})
    `;
    return { id };
  });

async function ensurePrefs(userId: string) {
  const sql = await getSql();
  await sql`alter table user_prefs add column if not exists avatar_url text`;
  await sql`alter table user_prefs add column if not exists display_currency text`;
  await sql`insert into user_prefs (user_id) values (${userId}) on conflict (user_id) do nothing`;
  return sql;
}

export const getPrefs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await ensurePrefs(context.userId);
    const rows = await sql<{ full_name: string | null; api_key: string | null; organic_enabled: boolean; ratios_json: string; avatar_url: string | null; display_currency: string | null }>`
      select full_name, api_key, organic_enabled, ratios_json, avatar_url, display_currency from user_prefs where user_id = ${context.userId}
    `;
    return rows[0] ?? { full_name: null, api_key: null, organic_enabled: false, ratios_json: "{}", avatar_url: null, display_currency: null };
  });

export const savePrefs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { full_name?: string; organic_enabled?: boolean; ratios_json?: string; rotateKey?: boolean; avatar_url?: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await ensurePrefs(context.userId);
    if (typeof data.full_name === "string") {
      const name = data.full_name.trim().slice(0, 80);
      await sql`update user_prefs set full_name = ${name} where user_id = ${context.userId}`;
      await sql`update "user" set name = ${name}, "updatedAt" = now() where id = ${context.userId}`;
    }
    if (typeof data.organic_enabled === "boolean") {
      await sql`update user_prefs set organic_enabled = ${data.organic_enabled} where user_id = ${context.userId}`;
    }
    if (typeof data.ratios_json === "string") {
      await sql`update user_prefs set ratios_json = ${data.ratios_json.slice(0, 4000)} where user_id = ${context.userId}`;
    }
    if (typeof data.avatar_url === "string") {
      const photo = data.avatar_url.startsWith("data:image/") ? data.avatar_url.slice(0, 250000) : "";
      await sql`update user_prefs set avatar_url = ${photo || null} where user_id = ${context.userId}`;
      if (photo) await sql`update "user" set image = ${photo}, "updatedAt" = now() where id = ${context.userId}`;
    }
    if (data.rotateKey) {
      const key = `mg_${crypto.randomUUID().replace(/-/g, "")}`;
      await sql`update user_prefs set api_key = ${key} where user_id = ${context.userId}`;
    }
    const rows = await sql<{ full_name: string | null; api_key: string | null; organic_enabled: boolean; ratios_json: string; avatar_url: string | null }>`
      select full_name, api_key, organic_enabled, ratios_json, avatar_url from user_prefs where user_id = ${context.userId}
    `;
    return rows[0];
  });

async function deskMeta(sql: Awaited<ReturnType<typeof getSql>>) {
  await sql`create table if not exists desk_meta (key text primary key, value text not null default '')`;
  return sql;
}

export const getDeskCurrency = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await deskMeta(await getSql());
    const rows = await sql<{ value: string }>`select value from desk_meta where key = 'currency'`;
    return rows[0]?.value || "INR|₹|en-IN";
  });

export const saveDeskCurrency = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: string) => {
    const value = String(input || "").slice(0, 48);
    if (value.split("|").length < 2) throw new Error("Pick a currency.");
    return value;
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await deskMeta(await getSql());
    await sql`
      insert into desk_meta (key, value) values ('currency', ${data})
      on conflict (key) do update set value = excluded.value
    `;
    return data;
  });

const FX_TTL = 6 * 60 * 60 * 1000;

async function loadFx(sql: Awaited<ReturnType<typeof getSql>>, base: string, force: boolean) {
  const code = base.toUpperCase();
  const cached = await sql<{ value: string }>`select value from desk_meta where key = 'fx_cache'`;
  let parsed: { base?: string; at?: number; rates?: Record<string, number> } | null = null;
  try { parsed = JSON.parse(cached[0]?.value || "null"); } catch { parsed = null; }
  const fresh = Boolean(parsed && parsed.base === code && parsed.rates && Date.now() - Number(parsed.at) < FX_TTL);
  if (fresh && !force && parsed?.rates) return { rates: parsed.rates, updatedAt: Number(parsed.at) || 0, stale: false, base: code };
  try {
    const response = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${code.toLowerCase()}.json`);
    if (!response.ok) throw new Error(`Rate feed ${response.status}`);
    const json = await response.json() as Record<string, unknown>;
    const table = json[code.toLowerCase()];
    if (!table || typeof table !== "object") throw new Error("Rate feed was empty.");
    const rates: Record<string, number> = { [code]: 1 };
    for (const [key, value] of Object.entries(table as Record<string, unknown>)) {
      const rate = Number(value);
      if (rate > 0 && Number.isFinite(rate) && rate < 1e12) rates[key.toUpperCase()] = rate;
    }
    const payload = { base: code, at: Date.now(), rates };
    const packed = JSON.stringify(payload);
    await sql`
      insert into desk_meta (key, value) values ('fx_cache', ${packed})
      on conflict (key) do update set value = excluded.value
    `;
    return { rates, updatedAt: payload.at, stale: false, base: code };
  } catch {
    if (parsed?.rates) return { rates: parsed.rates, updatedAt: Number(parsed.at) || 0, stale: true, base: parsed.base || code };
    return { rates: { [code]: 1 }, updatedAt: 0, stale: true, base: code };
  }
}

export const getMoneyConfig = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await deskMeta(await ensurePrefs(context.userId));
    const baseRow = await sql<{ value: string }>`select value from desk_meta where key = 'base_currency'`;
    const base = (baseRow[0]?.value || "INR").toUpperCase();
    const prefs = await sql<{ display_currency: string | null }>`select display_currency from user_prefs where user_id = ${context.userId}`;
    const fx = await loadFx(sql, base, false);
    return { ...fx, base, display: prefs[0]?.display_currency || "" };
  });

export const getDeskLook = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  await sql`create table if not exists desk_meta (key text primary key, value text not null default '')`;
  const rows = await sql<{ key: string; value: string }>`select key, value from desk_meta where key in ('desk_theme', 'desk_motion')`;
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return { theme: map.desk_theme || "", motion: map.desk_motion || "" };
});

export const saveDeskLook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { theme: string; motion: string }) => ({
    theme: String(input?.theme || "").slice(0, 4000),
    motion: String(input?.motion || "").slice(0, 40),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    await sql`create table if not exists desk_meta (key text primary key, value text not null default '')`;
    await sql`insert into desk_meta (key, value) values ('desk_theme', ${data.theme}) on conflict (key) do update set value = ${data.theme}`;
    await sql`insert into desk_meta (key, value) values ('desk_motion', ${data.motion}) on conflict (key) do update set value = ${data.motion}`;
    return { ok: true as const };
  });

export const saveDisplayCurrency = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: string) => {
    const code = String(input || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8);
    if (code.length < 3) throw new Error("Pick a currency.");
    return code;
  })
  .handler(async ({ context, data }) => {
    const sql = await ensurePrefs(context.userId);
    await sql`update user_prefs set display_currency = ${data} where user_id = ${context.userId}`;
    return data;
  });

export const saveBaseCurrency = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: string) => {
    const code = String(input || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8);
    if (code.length < 3) throw new Error("Pick a base currency.");
    return code;
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await deskMeta(await getSql());
    await sql`
      insert into desk_meta (key, value) values ('base_currency', ${data})
      on conflict (key) do update set value = excluded.value
    `;
    const fx = await loadFx(sql, data, true);
    return { ...fx, base: data };
  });

export const refreshFx = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await deskMeta(await getSql());
    const baseRow = await sql<{ value: string }>`select value from desk_meta where key = 'base_currency'`;
    const base = (baseRow[0]?.value || "INR").toUpperCase();
    return loadFx(sql, base, true);
  });

export const changeDeskPassword = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((password: string) => {
    const next = String(password ?? "");
    if (next.length < 8) throw new Error("Use at least 8 characters.");
    if (next.length > 128) throw new Error("Password is too long.");
    return next;
  })
  .handler(async ({ context, data }) => {
    const hash = await hashPassword(data);
    const sql = await getSql();
    const updated = await sql<{ id: string }>`
      update "account"
      set password = ${hash}, "updatedAt" = now()
      where "userId" = ${context.userId} and "providerId" = 'credential'
      returning id
    `;
    if (updated.length === 0) throw new Error("This account has no password to change.");
    return { ok: true as const };
  });

export const changeAdminLogin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { email?: string; password?: string }) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    const password = String(input?.password ?? "");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email sahi likho.");
    if (email.length > 120) throw new Error("Email bohot lamba hai.");
    if (password && password.length < 8) throw new Error("Password kam se kam 8 characters ka ho.");
    if (password.length > 128) throw new Error("Password bohot lamba hai.");
    if (!email) throw new Error("Admin email likho.");
    if (password.length < 8) throw new Error("Naya password likho, kam se kam 8 characters.");
    return { email, password };
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const email = data.email;
    const taken = await sql<{ id: string }>`select id from "user" where lower(email) = ${email} and id <> ${context.userId} limit 1`;
    if (taken.length) throw new Error("Ye email pehle se kisi account pe hai.");
    const hash = await hashPassword(data.password);
    const ok = await verifyPassword({ hash, password: data.password });
    if (!ok) throw new Error("Password save nahi ho saka. Try again.");
    await sql`update "user" set email = ${email}, "emailVerified" = true, name = 'Admin', "updatedAt" = now() where id = ${context.userId}`;
    const updated = await sql<{ id: string }>`
      update "account"
      set password = ${hash}, "accountId" = ${context.userId}, "updatedAt" = now()
      where "userId" = ${context.userId} and "providerId" = 'credential'
      returning id
    `;
    if (updated.length === 0) {
      await sql`
        insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
        values (${crypto.randomUUID()}, ${context.userId}, 'credential', ${context.userId}, ${hash}, now(), now())
      `;
    }
    await sql`
      update "user"
      set email = ${"retired-" + context.userId.slice(0, 8) + "-" + Date.now() + "@disabled.local"}
      where id <> ${context.userId} and lower(email) in ('admin@magiciansmm.com', 'admin@magiciansmm.local')
    `;
    await sql`
      update "account" as a
      set password = null, "updatedAt" = now()
      from "user" as u
      where a."userId" = u.id
        and a."userId" <> ${context.userId}
        and u.email like 'retired-%@disabled.local'
        and a."providerId" = 'credential'
    `;
    const meta = await deskMeta(sql);
    await meta`
      insert into desk_meta (key, value) values ('admin_email', ${email})
      on conflict (key) do update set value = excluded.value
    `;
    const check = await sql<{ email: string; password: string | null }>`
      select u.email, a.password
      from "user" u
      join "account" a on a."userId" = u.id and a."providerId" = 'credential'
      where u.id = ${context.userId}
      limit 1
    `;
    if (check[0]?.email !== email || !check[0]?.password) throw new Error("Login database mein save nahi hua.");
    if (!await verifyPassword({ hash: check[0].password, password: data.password })) throw new Error("Saved password match nahi hua.");
    return { ok: true as const, email };
  });

export const listPanelAdmins = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    return sql<{ id: string; email: string }>`
      select u.id, u.email
      from "user" u
      join user_roles r on r.user_id = u.id
      where r.role = 'admin'
      order by u."createdAt" asc
    `;
  });

export const addPanelAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { email?: string; password?: string }) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    const password = String(input?.password ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email sahi likho.");
    if (email.length > 120) throw new Error("Email bohot lamba hai.");
    if (password.length < 8) throw new Error("Password kam se kam 8 characters ka ho.");
    if (password.length > 128) throw new Error("Password bohot lamba hai.");
    return { email, password };
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const hash = await hashPassword(data.password);
    const existing = await sql<{ id: string }>`select id from "user" where lower(email) = ${data.email} limit 1`;
    let id = existing[0]?.id;
    if (!id) {
      id = crypto.randomUUID();
      await sql`
        insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
        values (${id}, 'Admin', ${data.email}, true, now(), now())
      `;
      await sql`
        insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
        values (${crypto.randomUUID()}, ${id}, 'credential', ${id}, ${hash}, now(), now())
      `;
      await sql`
        insert into wallets (user_id, balance_paise)
        values (${id}, 0)
        on conflict (user_id) do nothing
      `;
    } else {
      await sql`update "user" set "emailVerified" = true, "updatedAt" = now() where id = ${id}`;
      const updated = await sql<{ id: string }>`
        update "account"
        set password = ${hash}, "updatedAt" = now()
        where "userId" = ${id} and "providerId" = 'credential'
        returning id
      `;
      if (updated.length === 0) {
        await sql`
          insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
          values (${crypto.randomUUID()}, ${id}, 'credential', ${id}, ${hash}, now(), now())
        `;
      }
    }
    await sql`
      insert into user_roles (user_id, role)
      values (${id}, 'admin')
      on conflict (user_id) do update set role = 'admin'
    `;
    return { ok: true as const, id, email: data.email };
  });

export const removePanelAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((userId: string) => {
    const id = String(userId ?? "").trim();
    if (!id) throw new Error("Admin choose karo.");
    return id;
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    if (data === context.userId) throw new Error("Apna khud ka admin access yahan se nahi hata sakte.");
    const sql = await getSql();
    const admins = await sql<{ n: number }>`select count(*)::int as n from user_roles where role = 'admin'`;
    if ((admins[0]?.n ?? 0) <= 1) throw new Error("Aakhri admin ko hata nahi sakte.");
    await sql`delete from user_roles where user_id = ${data} and role = 'admin'`;
    return { ok: true as const };
  });

export const listInstagram = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    return sql<{ id: string; username: string; created_at: string }>`
      select id, username, created_at::text as created_at
      from instagram_accounts
      where user_id = ${context.userId}
      order by created_at desc
    `;
  });

export const linkInstagram = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((username: string) => {
    const name = String(username ?? "").trim().replace(/^@/, "");
    if (!/^[A-Za-z0-9._]{2,30}$/.test(name)) throw new Error("Enter a public username, like your_name.");
    return name;
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const recent = await sql<{ n: number }>`
      select count(*)::int as n from instagram_accounts
      where user_id = ${context.userId} and created_at > now() - interval '30 days'
    `;
    if ((recent[0]?.n ?? 0) >= 5) throw new Error("5 accounts already linked in this 30-day window.");
    const id = crypto.randomUUID();
    await sql`
      insert into instagram_accounts (id, user_id, username)
      values (${id}, ${context.userId}, ${data})
    `;
    return { id, username: data };
  });

export const listGrowthTemplates = createServerFn({ method: "GET" }).handler(async () => listGrowthCatalog());

export type MassLinkInput = {
  link: string;
  views: number;
  viewRuns?: number;
  extras: Record<string, number>;
  runs?: Record<string, number>;
  drops?: { type: string; amount: number; at: string }[];
};

export type MassBatchLink = {
  link: string;
  status: string;
  error: string | null;
  total_paise: number;
  order_number: string | null;
};

export type MassBatchRow = {
  id: string;
  campaign_name: string;
  platform: string;
  base_quantity: number;
  timeframe: string;
  link_count: number;
  placed_count: number;
  failed_count: number;
  total_paise: number;
  status: string;
  created_at: string;
  links: MassBatchLink[];
};

async function ensureMassTables() {
  const sql = await getSql();
  await sql`
    create table if not exists mass_batches (
      id text primary key,
      user_id text not null,
      campaign_name text not null,
      platform text not null,
      bundle_id text not null,
      base_quantity integer not null,
      timeframe text not null,
      link_count integer not null,
      placed_count integer not null,
      failed_count integer not null,
      total_paise integer not null,
      status text not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists mass_batch_links (
      id text primary key,
      batch_id text not null,
      user_id text not null,
      link text not null,
      order_id text,
      order_number text,
      status text not null,
      error text,
      total_paise integer not null default 0
    )
  `;
  return sql;
}

export const listMassBatches = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await ensureMassTables();
    const batches = await sql<{
      id: string;
      campaign_name: string;
      platform: string;
      base_quantity: number;
      timeframe: string;
      link_count: number;
      placed_count: number;
      failed_count: number;
      total_paise: number;
      status: string;
      created_at: string;
    }>`
      select id, campaign_name, platform, base_quantity, timeframe, link_count, placed_count,
             failed_count, total_paise, status, created_at::text as created_at
      from mass_batches
      where user_id = ${context.userId}
      order by created_at desc
      limit 50
    `;
    if (batches.length === 0) return [] as MassBatchRow[];
    const ids = batches.map((batch) => batch.id);
    const links = await sql<{
      batch_id: string;
      link: string;
      status: string;
      error: string | null;
      total_paise: number;
      order_number: string | null;
    }>`
      select batch_id, link, status, error, total_paise, order_number
      from mass_batch_links
      where user_id = ${context.userId}
    `;
    const idSet = new Set(ids);
    return batches.map((batch) => ({
      ...batch,
      links: links.filter((link) => idSet.has(link.batch_id)).map(({ link, status, error, total_paise, order_number }) => ({
        link,
        status,
        error,
        total_paise,
        order_number,
      })),
    }));
  });

export const submitMassBatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    bundleId: string;
    platform?: string;
    campaignName: string;
    timeframe: string;
    intervalHours: number;
    links: MassLinkInput[];
  }) => {
    const links = (input.links ?? []).filter((row) => /^https?:\/\//.test(String(row.link ?? "").trim())).slice(0, 100);
    if (!input.bundleId) throw new Error("Apna bundle select karo.");
    if (links.length === 0) throw new Error("Add at least 1 valid link.");
    const floors: Record<string, number> = { views: 100, likes: 10, comments: 10, shares: 10, saves: 50, reposts: 10 };
    const clampRuns = (value: unknown, quantity: number, floor: number) => {
      const max = Math.max(1, Math.min(200, Math.floor(quantity / Math.max(1, floor))));
      const asked = Math.floor(Number(value) || 0);
      return Math.max(1, Math.min(max, asked > 0 ? asked : max));
    };
    const platform = input.platform === "tiktok" || input.bundleId === "bundle-tt" ? "tiktok" : "instagram";
    return {
      bundleId: platform === "tiktok" ? "bundle-tt" : "bundle-ig",
      platform,
      campaignName: String(input.campaignName ?? "").trim().slice(0, 80) || "Untitled campaign",
      timeframe: String(input.timeframe ?? "1-3 days"),
      intervalHours: Math.max(1, Math.min(24 * 90, Math.round(Number(input.intervalHours) || 72))),
      links: links.map((row) => {
        const views = Math.round(Number(row.views) || 0);
        if (views < floors.views) throw new Error("Below 100 not allowed for views.");
        const extras = Object.fromEntries(
          Object.entries(row.extras ?? {})
            .map(([key, value]) => [key, Math.round(Number(value) || 0)])
            .filter((entry) => Number(entry[1]) > 0),
        );
        for (const [key, value] of Object.entries(extras)) {
          const floor = floors[key];
          if (floor && Number(value) < floor) throw new Error(`Below ${floor} not allowed for ${key}.`);
        }
        const runs = Object.fromEntries(
          Object.keys(extras).map((key) => [key, clampRuns(row.runs?.[key], Number(extras[key]), floors[key] || 10)]),
        );
        const allowed = new Set(["views", "likes", "comments", "shares", "saves", "reposts"]);
        const drops = (Array.isArray(row.drops) ? row.drops : [])
          .map((drop) => ({
            type: String(drop?.type || ""),
            amount: Math.floor(Number(drop?.amount) || 0),
            at: new Date(String(drop?.at || "")).toISOString(),
          }))
          .filter((drop) => allowed.has(drop.type) && drop.amount > 0 && !Number.isNaN(new Date(drop.at).getTime()));
        for (const drop of drops) {
          const floor = floors[drop.type] || 1;
          if (drop.amount < floor) throw new Error(`Below ${floor} not allowed for ${drop.type}.`);
        }
        return { link: row.link.trim(), views, viewRuns: clampRuns(row.viewRuns, views, floors.views), extras, runs, drops };
      }),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await ensureMassTables();
    await ensureWallet(context.userId);
    const items = await sql<{
      engagement_type: string;
      ratio_bps: number;
      is_base: boolean;
      name: string;
      price_per_1k_paise: number;
      price_per_10k_paise: number;
      min_quantity: number;
      max_quantity: number;
      platform: string;
    }>`
      select bi.engagement_type, bi.ratio_bps, bi.is_base, s.name, s.price_per_1k_paise,
             coalesce(s.price_per_10k_paise, s.price_per_1k_paise * 10) as price_per_10k_paise,
             s.min_quantity, s.max_quantity, b.platform
      from bundle_items bi
      join services s on s.id = bi.service_id
      join bundles b on b.id = bi.bundle_id
      where bi.bundle_id = ${data.bundleId}
    `;
    if (items.length === 0 && data.platform !== "tiktok" && data.platform !== "instagram") throw new Error("That bundle is not on the book.");
    const platform = data.platform === "tiktok" ? "tiktok" : "instagram";
    const { bindingMap, panelTypeRates } = await import("@/lib/admin.server");
    const { PROVIDER_MIN, autoRuns } = await import("@/lib/organic");
    const bindings = await bindingMap();
    const rates = await panelTypeRates(platform);
    const named = Object.fromEntries(items.map((item) => [item.engagement_type, item]));
    const batchId = crypto.randomUUID();
    let placed = 0;
    let failed = 0;
    let totalPaise = 0;
    const results: MassBatchLink[] = [];
    for (const [index, row] of data.links.entries()) {
      const extras = { ...row.extras };
      const wanted: Record<string, number> = { views: row.views, ...extras };
      try {
        const lines: { engagement_type: string; service_name: string; quantity: number; price_paise: number }[] = [];
        for (const type of ["views", "likes", "comments", "shares", "saves", "reposts"]) {
          const asked = Math.floor(wanted[type] || 0);
          if (asked <= 0) continue;
          const slot = bindings[`${platform}:${type}`];
          if (slot && slot.section_enabled === false) continue;
          const ready = (slot?.providers || []).some((item) => item.api_key && item.api_url) || Boolean(slot?.api_key && slot?.api_url);
          if (!ready) throw new Error(`No Provider Available for ${type}. Full Engagement APIs me ${type} lagao.`);
          const quantity = asked;
          const panel = rates[type];
          const item = named[type];
          const price = panel > 0
            ? Math.max(1, Math.round((quantity / 1000) * panel))
            : item
              ? Math.max(1, Math.round((quantity * (item.price_per_10k_paise || item.price_per_1k_paise * 10)) / 10000))
              : 0;
          if (price <= 0) throw new Error(`Set a panel rate for ${type}.`);
          lines.push({ engagement_type: type, service_name: item?.name || type, quantity, price_paise: price });
        }
        if (!lines.some((line) => line.engagement_type === "views")) throw new Error("Views API is off or missing.");
        const total = lines.reduce((sum, line) => sum + line.price_paise, 0);
        const wallet = await sql<{ balance_paise: number }>`
          select balance_paise from wallets where user_id = ${context.userId}
        `;
        if ((wallet[0]?.balance_paise ?? 0) < total) throw new Error("Wallet does not cover this link.");
        const { armOrder } = await import("@/lib/drip.server");
        const orderId = crypto.randomUUID();
        const orderNumber = `MAG-${Math.floor(100000 + Math.random() * 900000)}`;
        const charged = await sql<{ user_id: string }>`
          update wallets
          set balance_paise = balance_paise - ${total}, updated_at = now()
          where user_id = ${context.userId} and balance_paise >= ${total}
          returning user_id
        `;
        if (charged.length === 0) throw new Error("Wallet does not cover this link.");
        await sql`
          insert into engagement_orders (
            id, user_id, order_number, bundle_id, platform, link, base_quantity, total_paise,
            status, organic, interval_hours, variance_percent, provider_state
          ) values (
            ${orderId}, ${context.userId}, ${orderNumber}, ${data.bundleId}, ${platform}, ${row.link},
            ${row.views}, ${total}, 'queued', true, ${data.intervalHours}, 34, 'provider'
          )
        `;
        for (const line of lines) {
          await sql`
            insert into engagement_order_items (
              id, order_id, user_id, engagement_type, service_name, quantity, delivered, price_paise, status
            ) values (
              ${crypto.randomUUID()}, ${orderId}, ${context.userId}, ${line.engagement_type},
              ${line.service_name}, ${line.quantity}, 0, ${line.price_paise}, 'queued'
            )
          `;
        }
        const lead = data.links.length <= 1 ? 0 : (index / (data.links.length - 1)) * Math.min(data.intervalHours * 0.12, 6);
        const start = new Date(Date.now() + lead * 3600 * 1000);
        const hours = Math.max(1, data.intervalHours - lead);
        const plans: Record<string, { hours: number; runs: number; variance: number; curve: number[]; start: string }> = {};
        for (const line of lines) {
          const min = Math.max(1, PROVIDER_MIN[line.engagement_type] || 10);
          const cap = line.quantity > min ? Math.max(1, Math.floor(line.quantity / (min + 1))) : 1;
          const asked = line.engagement_type === "views" ? row.viewRuns : row.runs?.[line.engagement_type];
          plans[line.engagement_type] = {
            hours,
            runs: Math.max(1, Math.min(cap, Math.floor(Number(asked) || autoRuns(line.quantity, line.engagement_type)))),
            variance: 34,
            curve: [0.05, 0.16, 0.38, 0.62, 0.84, 1],
            start: start.toISOString(),
          };
        }
        await armOrder({
          userId: context.userId,
          orderId,
          platform,
          link: row.link,
          lines: lines.map((line) => ({ engagement_type: line.engagement_type, quantity: line.quantity })),
          plans,
          drops: row.drops,
        });
        await sql`
          insert into wallet_transactions (id, user_id, kind, amount_paise, note)
          values (${crypto.randomUUID()}, ${context.userId}, 'debit', ${-total}, ${`Mass ${orderNumber} · ${data.campaignName}`})
        `;
        await sql`
          insert into mass_batch_links (id, batch_id, user_id, link, order_id, order_number, status, total_paise)
          values (${crypto.randomUUID()}, ${batchId}, ${context.userId}, ${row.link}, ${orderId}, ${orderNumber}, 'processing', ${total})
        `;
        placed += 1;
        totalPaise += total;
        results.push({ link: row.link, status: "processing", error: null, total_paise: total, order_number: orderNumber });
      } catch (err: unknown) {
        failed += 1;
        const message = err instanceof Error ? err.message : "Link failed.";
        await sql`
          insert into mass_batch_links (id, batch_id, user_id, link, status, error, total_paise)
          values (${crypto.randomUUID()}, ${batchId}, ${context.userId}, ${row.link}, 'failed', ${message}, 0)
        `;
        results.push({ link: row.link, status: "failed", error: message, total_paise: 0, order_number: null });
      }
    }
    const status = placed === 0 ? "failed" : failed > 0 ? "partial" : "processing";
    await sql`
      insert into mass_batches (
        id, user_id, campaign_name, platform, bundle_id, base_quantity, timeframe,
        link_count, placed_count, failed_count, total_paise, status
      ) values (
        ${batchId}, ${context.userId}, ${data.campaignName}, ${platform}, ${data.bundleId},
        ${data.links[0]?.views ?? 0}, ${data.timeframe}, ${data.links.length}, ${placed}, ${failed},
        ${totalPaise}, ${status}
      )
    `;
    return { id: batchId, status, placed, failed, total_paise: totalPaise, links: results };
  });

export const completeMassBatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => {
    if (typeof id !== "string" || id.length < 8) throw new Error("Missing batch.");
    return id;
  })
  .handler(async ({ context, data }) => {
    const sql = await ensureMassTables();
    const updated = await sql<{ id: string }>`
      update mass_batches
      set status = 'completed'
      where id = ${data} and user_id = ${context.userId} and status = 'processing'
      returning id
    `;
    if (updated.length === 0) throw new Error("That batch is not processing.");
    await sql`
      update mass_batch_links
      set status = 'completed'
      where batch_id = ${data} and user_id = ${context.userId} and status = 'processing'
    `;
    const orders = await sql<{ order_id: string }>`
      select order_id from mass_batch_links
      where batch_id = ${data} and user_id = ${context.userId} and order_id is not null
    `;
    for (const row of orders) {
      await sql`update engagement_orders set status = 'complete' where id = ${row.order_id} and user_id = ${context.userId}`;
      await sql`update engagement_order_items set delivered = quantity, status = 'complete' where order_id = ${row.order_id} and user_id = ${context.userId}`;
    }
    return { ok: true as const };
  });

export const placeSingleOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { managedId?: string; serviceId?: number; link: string; amount: number; drip?: boolean; runs?: number; intervalMinutes?: number; comments?: string; usernames?: string; hashtags?: string; username?: string; hashtag?: string; media?: string; answer?: string; subMin?: string; subMax?: string; posts?: string; delay?: string }) => {
    const managedId = String(input?.managedId || "").trim();
    const serviceId = Math.floor(Number(input?.serviceId) || 0);
    const link = String(input?.link ?? "").trim();
    const amount = Math.floor(Number(input?.amount));
    const runs = Math.max(1, Math.min(200, Math.floor(Number(input?.runs) || 1)));
    const intervalMinutes = Math.max(1, Math.min(10080, Math.floor(Number(input?.intervalMinutes) || 1)));
    if (!managedId && !serviceId) throw new Error("Pick a service.");
    if (!/^https?:\/\//i.test(link) && !String(input?.username || "").trim()) throw new Error("Paste a valid link.");
    const comments = String(input?.comments || "").slice(0, 20000);
    const lines = lineCount(comments) || lineCount(String(input?.usernames || ""));
    const qty = Number.isFinite(amount) && amount > 0 ? amount : lines;
    if (!Number.isFinite(qty) || qty < 1) throw new Error("Enter an amount.");
    return {
      managedId, serviceId, link, amount: qty, drip: Boolean(input?.drip), runs, intervalMinutes,
      comments,
      usernames: String(input?.usernames || "").slice(0, 20000),
      hashtags: String(input?.hashtags || "").slice(0, 8000),
      username: String(input?.username || "").slice(0, 200),
      hashtag: String(input?.hashtag || "").slice(0, 200),
      media: String(input?.media || "").slice(0, 500),
      answer: String(input?.answer || "").replace(/[^\d]/g, "").slice(0, 4),
      subMin: String(input?.subMin || "").replace(/[^\d]/g, "").slice(0, 8),
      subMax: String(input?.subMax || "").replace(/[^\d]/g, "").slice(0, 8),
      posts: String(input?.posts || "").replace(/[^\d]/g, "").slice(0, 8),
      delay: String(input?.delay || "").replace(/[^\d]/g, "").slice(0, 8),
    };
  })
  .handler(async ({ context, data }) => {
    const { findManagedById, findManagedByProviderId, providerKeys, catalogMarkupMinor } = await import("@/lib/admin.server");
    const managed = data.managedId
      ? await findManagedById(data.managedId)
      : await findManagedByProviderId(String(data.serviceId));
    if (!managed || managed.enabled === false) throw new Error("That service is disabled.");
    if (data.drip && !managed.drip_allowed) throw new Error("Drip-feed is not available on this service.");
    if (data.amount < managed.min_quantity || data.amount > managed.max_quantity) {
      throw new Error(`Amount must be between ${managed.min_quantity} and ${managed.max_quantity}.`);
    }
    const form = serviceForm((managed as { service_type?: string }).service_type || "", managed.name);
    if (form.comments && lineCount(data.comments) < 1) throw new Error("Write at least one comment. One comment per line.");
    if (form.usernames && lineCount(data.usernames) < 1) throw new Error("Write at least one username. One username per line.");
    if (form.hashtags && !data.hashtags.trim()) throw new Error("Write the hashtags.");
    if (form.hashtag && !data.hashtag.trim()) throw new Error("Write the hashtag.");
    if (form.username && !data.username.trim()) throw new Error("Write the username.");
    if (form.media && !data.media.trim()) throw new Error("Paste the media link.");
    if (form.answer && !data.answer) throw new Error("Write the answer number.");
    if (form.subscription && (!data.subMin || !data.subMax)) throw new Error("Write the minimum and maximum.");
    const orderLink = data.link || (data.username.startsWith("http") ? data.username : data.username);
    const extra: Record<string, string> = {};
    if (form.comments) extra.comments = data.comments.trim();
    if (form.usernames) extra.usernames = data.usernames.trim();
    if (form.hashtags) extra.hashtags = data.hashtags.trim();
    if (form.hashtag) extra.hashtag = data.hashtag.trim();
    if (form.username) extra.username = data.username.trim();
    if (form.media) extra.media = data.media.trim();
    if (form.answer) extra.answer_number = data.answer;
    if (form.subscription) {
      extra.username = data.username.trim();
      extra.min = data.subMin;
      extra.max = data.subMax;
      if (data.posts) extra.posts = data.posts;
      if (data.delay) extra.delay = data.delay;
    }
    const keys = await providerKeys(managed.provider_row_id || "");
    if (!keys?.api_key || !keys.api_url) throw new Error("No Provider Available");
    const pieces = data.drip ? data.runs : 1;
    const totalQty = data.amount * pieces;
    const sql = await ensureWallet(context.userId);
    await sql`
      insert into bundles (id, name, platform, tagline)
      values ('bundle-single', 'Single order', 'multi', 'One service at a time.')
      on conflict (id) do nothing
    `;
    const currencyRows = await sql<{ currency: string }>`
      select coalesce(currency, '') as currency from smm_providers where id = ${managed.provider_row_id || ""} limit 1
    `;
    const markup = await catalogMarkupMinor(currencyRows[0]?.currency || "", managed.provider_service_id);
    const unit = Math.max(1, managed.price_per_1k_paise + markup);
    const total = Math.max(1, Math.round((totalQty / 1000) * unit));
    const wallet = await sql<{ balance_paise: number }>`
      select balance_paise from wallets where user_id = ${context.userId}
    `;
    if ((wallet[0]?.balance_paise ?? 0) < total) throw new Error("The wallet does not cover this order. Add credit first.");
    const orderId = crypto.randomUUID();
    const orderNumber = `MAG-${Math.floor(100000 + Math.random() * 900000)}`;
    let providerOrderId = data.drip ? "drip" : "";
    if (!data.drip) {
      const { placeExactOnProvider } = await import("@/lib/providers.server");
      const sent = await placeExactOnProvider({
        serviceId: managed.provider_service_id,
        link: orderLink,
        quantity: data.amount,
        apiUrl: keys.api_url,
        apiKey: keys.api_key,
        extra,
      });
      providerOrderId = sent.orderId;
    }
    const charged = await sql<{ user_id: string }>`
      update wallets
      set balance_paise = balance_paise - ${total}, updated_at = now()
      where user_id = ${context.userId} and balance_paise >= ${total}
      returning user_id
    `;
    if (charged.length === 0) {
      if (providerOrderId && providerOrderId !== "drip") {
        const { cancelProviderOrder } = await import("@/lib/providers.server");
        await cancelProviderOrder(providerOrderId);
      }
      throw new Error("The wallet does not cover this order. Add credit first.");
    }
    await sql`
      insert into engagement_orders (
        id, user_id, order_number, bundle_id, platform, link, base_quantity, total_paise,
        status, organic, interval_hours, variance_percent, provider_state
      ) values (
        ${orderId}, ${context.userId}, ${orderNumber}, 'bundle-single', ${managed.platform}, ${data.link},
        ${data.amount}, ${total}, 'processing', false, 1, 0, 'provider'
      )
    `;
    await sql`
      insert into engagement_order_items (
        id, order_id, user_id, engagement_type, service_name, quantity, delivered, price_paise, status
      ) values (
        ${crypto.randomUUID()}, ${orderId}, ${context.userId}, ${managed.category},
        ${`#${managed.provider_service_id} ${managed.name}${data.drip ? "" : ` · #${providerOrderId}`}`}, ${totalQty}, 0, ${total}, 'processing'
      )
    `;
    await sql`
      insert into wallet_transactions (id, user_id, kind, amount_paise, note)
      values (${crypto.randomUUID()}, ${context.userId}, 'debit', ${-total}, ${data.drip ? `Single ${orderNumber} drip ${pieces} runs.` : `Single ${orderNumber} sent once #${providerOrderId}.`})
    `;
    if (!data.drip) {
      await sql`
        insert into delivery_drops (
          id, order_id, user_id, platform, link, engagement_type, quantity, place_at, status,
          provider_order_id, service_label, provider_service_id, api_url, api_key
        ) values (
          ${crypto.randomUUID()}, ${orderId}, ${context.userId}, ${managed.platform}, ${data.link},
          ${managed.category}, ${data.amount}, now(), 'placed',
          ${providerOrderId}, ${`#${managed.provider_service_id} ${managed.name}`}, ${String(managed.provider_service_id)}, ${keys.api_url}, ${keys.api_key}
        )
      `;
    }
    if (data.drip) {
      const { scheduleFixed } = await import("@/lib/drip.server");
      await scheduleFixed({
        userId: context.userId,
        orderId,
        platform: managed.platform,
        link: orderLink,
        engagementType: managed.category || "single",
        providerServiceId: String(managed.provider_service_id),
        apiUrl: keys.api_url,
        apiKey: keys.api_key,
        amount: data.amount,
        runs: pieces,
        intervalMinutes: data.intervalMinutes,
      });
    }
    return { id: orderId, order_number: orderNumber, total_paise: total, provider_order_id: providerOrderId, balance_paise: (wallet[0]?.balance_paise ?? 0) - total };
  });

export const browseLiveServices = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { platform?: string; category?: string; query?: string }) => ({
    platform: String(input?.platform || "instagram").slice(0, 32),
    category: String(input?.category || "").slice(0, 160),
    query: String(input?.query || "").slice(0, 80),
  }))
  .handler(async ({ data }) => {
    const full = data.platform === "all" && !data.category && !data.query;
    const slot = globalThis as { __liveCatalog?: { at: number; body: { categories: string[]; category: string; services: { id: number; platform: string; category: string; name: string; min: number; max: number; rateUsd: number; note: string; serviceType: string; averageMinutes: number; dripAllowed: boolean; managedId: string; providerName: string }[]; balanceUsd: number; currency: string; balances: { amount: number; currency: string }[] } } };
    if (full && slot.__liveCatalog && Date.now() - slot.__liveCatalog.at < 60 * 60 * 1000) return slot.__liveCatalog.body;
    const { enabledCatalog, loadMarkup, managedToLive } = await import("@/lib/admin.server");
    const { detectPlatform, browseProvider, providerBalance } = await import("@/lib/providers.server");
    const managed = await enabledCatalog();
    if (managed && managed.length > 0) {
      const markup = await loadMarkup();
      const cards = managed.map((row) => {
        const currency = (row as { provider_currency?: string }).provider_currency || "";
        const extra = markup(currency, row.provider_service_id);
        const live = managedToLive(row, extra);
        const detected = detectPlatform(live.category, live.name);
        return { ...live, platform: detected !== "other" ? detected : live.platform || "other" };
      });
      const platform = data.platform;
      const rows = cards.filter((row) => platform === "all" || row.platform === platform);
      const names: string[] = [];
      for (const row of rows) {
        if (row.category && !names.includes(row.category)) names.push(row.category);
      }
      const categories = ["All categories", ...names];
      const category = categories.includes(data.category) ? data.category : "All categories";
      const query = data.query.trim().toLowerCase();
      const pool = !category || category === "All categories" ? rows : rows.filter((row) => row.category === category);
      const services = query
        ? pool.filter((row) => {
            const id = String(row.id);
            const blob = `${id} ${row.name} ${row.category} ${row.platform || ""}`.toLowerCase();
            if (/^\d+$/.test(query)) return id === query || id.startsWith(query);
            return query.split(/\s+/).filter(Boolean).every((word) => blob.includes(word));
          })
        : pool;
      const body = { categories, category, services, balanceUsd: 0, currency: "USD", balances: [] as { amount: number; currency: string }[] };
      if (full) (globalThis as { __liveCatalog?: { at: number; body: typeof body } }).__liveCatalog = { at: Date.now(), body };
      return body;
    }
    const [catalog, balance] = await Promise.all([browseProvider(data), providerBalance()]);
    return { ...catalog, balanceUsd: balance.balanceUsd, currency: balance.currency, balances: [{ amount: balance.balanceUsd, currency: balance.currency || "USD" }] };
  });

export const engagementFloors = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((platform: string) => String(platform || "instagram").slice(0, 32))
  .handler(async ({ data }) => {
    const { listBindings } = await import("@/lib/admin.server");
    const rows = await listBindings();
    const out: Record<string, number> = {};
    for (const type of ["views", "likes", "saves", "shares", "reposts", "comments"]) {
      const row = rows.find((item) => item.slot === `${data}:${type}`);
      if (row) out[type] = row.min_quantity;
    }
    return out;
  });

export const engagementSections = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((platform: string) => String(platform || "instagram").slice(0, 32))
  .handler(async ({ data }) => {
    const { listBindings } = await import("@/lib/admin.server");
    const rows = await listBindings();
    const out: Record<string, boolean> = {};
    for (const type of ["views", "likes", "saves", "shares", "reposts", "comments"]) {
      const row = rows.find((item) => item.slot === `${data}:${type}`);
      out[type] = row ? row.section_enabled !== false : type !== "comments";
    }
    return out;
  });

export const panelRates = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((platform: string) => String(platform || "instagram").slice(0, 32))
  .handler(async ({ data }) => {
    const { panelTypeRates } = await import("@/lib/admin.server");
    return panelTypeRates(data);
  });

export const aiSmartMix = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { views: number; platform: string }) => {
    const views = Math.floor(Number(input?.views));
    if (views < 100) throw new Error("Enter at least 100 views.");
    return { views, platform: String(input?.platform || "instagram").slice(0, 32) };
  })
  .handler(async ({ context, data }) => {
    const { mixFromRatios, SETTINGS_RATIO_DEFAULTS } = await import("@/lib/organic");
    const sql = await getSql();
    const rows = await sql<{ ratios_json: string }>`select ratios_json from user_prefs where user_id = ${context.userId}`;
    let ratios = SETTINGS_RATIO_DEFAULTS;
    try {
      ratios = { ...SETTINGS_RATIO_DEFAULTS, ...JSON.parse(rows[0]?.ratios_json || "{}") };
    } catch {
      ratios = SETTINGS_RATIO_DEFAULTS;
    }
    return { mix: mixFromRatios(data.views, ratios), source: "settings" as const };
  });

export const askPanelAi = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { question: string; context: string }) => {
    const question = String(input?.question ?? "").trim().slice(0, 800);
    if (!question) throw new Error("Ask something first.");
    return { question, context: String(input?.context ?? "").slice(0, 1200) };
  })
  .handler(async ({ data }) => {
    const { askFreeModel } = await import("@/lib/providers.server");
    const text = await askFreeModel(
      "You are the organic growth assistant inside Magiciansmm. Reply in 2 to 4 short sentences using only the numbers given. Do not claim you opened the live post. If the user wants a ratio or mix, end with one line exactly like APPLY {\"likes\":700,\"shares\":80,\"reposts\":40,\"saves\":160}.",
      `${data.context}\n\nQuestion: ${data.question}`,
    );
    const match = text.match(/APPLY\s*(\{[\s\S]*?\})/);
    let mix: Record<string, number> | null = null;
    if (match) {
      try {
        const parsed = JSON.parse(match[1]) as Record<string, unknown>;
        mix = {};
        for (const key of ["likes", "shares", "reposts", "saves"]) {
          const value = Number(parsed[key]);
          if (Number.isFinite(value) && value > 0) mix[key] = Math.round(value);
        }
      } catch {
        mix = null;
      }
    }
    return {
      text: text.replace(/APPLY\s*\{[\s\S]*?\}/, "").trim(),
      apply: Boolean(mix && Object.keys(mix).length > 0),
      mix,
    };
  });



