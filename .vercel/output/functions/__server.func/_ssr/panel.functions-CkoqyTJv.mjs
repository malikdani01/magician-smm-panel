import { i as TSS_SERVER_FUNCTION, r as createServerFn } from "./ssr.mjs";
import { r as getSql } from "./db-BWhOWbp4.mjs";
import { t as authMiddleware } from "./middleware-CEd1ujj4.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/panel.functions-CkoqyTJv.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
async function ensureWallet(userId) {
	const sql = await getSql();
	await sql`
    insert into wallets (user_id, balance_paise)
    values (${userId}, 0)
    on conflict (user_id) do nothing
  `;
	return sql;
}
function moneyLines(items, baseQuantity, enabled, quantities) {
	const lines = [];
	for (const item of items) {
		if (!item.is_base && !enabled.has(item.engagement_type)) continue;
		const override = quantities?.[item.engagement_type];
		const raw = typeof override === "number" && Number.isFinite(override) ? override : item.is_base ? baseQuantity : Math.round(baseQuantity * item.ratio_bps / 1e4);
		const quantity = Math.min(item.max_quantity, Math.max(item.min_quantity, Math.round(raw)));
		const price_paise = Math.max(1, Math.round(quantity * item.price_per_1k_paise / 1e3));
		lines.push({
			engagement_type: item.engagement_type,
			service_name: item.name,
			quantity,
			price_paise
		});
	}
	return lines;
}
var getCatalog_createServerFn_handler = createServerRpc({
	id: "4ec21d13fa60565755ae5acb0c886c85e94db0b0cb0b569120fa094138fd85b5",
	name: "getCatalog",
	filename: "src/lib/panel.functions.ts"
}, (opts) => getCatalog.__executeServer(opts));
var getCatalog = createServerFn({ method: "GET" }).handler(getCatalog_createServerFn_handler, async () => {
	const sql = await getSql();
	const services = await sql`
    select id, platform, engagement_type, name, price_per_1k_paise, min_quantity, max_quantity
    from services
    order by platform, engagement_type
  `;
	const bundles = await sql`select id, name, platform, tagline from bundles order by name`;
	const items = await sql`
    select
      bi.id,
      bi.bundle_id,
      bi.engagement_type,
      bi.ratio_bps,
      bi.is_base,
      s.id as service_id,
      s.name,
      s.price_per_1k_paise,
      s.min_quantity,
      s.max_quantity
    from bundle_items bi
    join services s on s.id = bi.service_id
    order by bi.is_base desc, bi.engagement_type
  `;
	return {
		services,
		bundles: bundles.map((bundle) => ({
			...bundle,
			items: items.filter((item) => item.bundle_id === bundle.id).map(({ bundle_id: _bundleId, ...item }) => item)
		})),
		providers_connected: 0
	};
});
var getDashboard_createServerFn_handler = createServerRpc({
	id: "802d2905e75b9f5bd7272b1b69005ed36294d3a93da20afca364091055ddb7a3",
	name: "getDashboard",
	filename: "src/lib/panel.functions.ts"
}, (opts) => getDashboard.__executeServer(opts));
var getDashboard = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getDashboard_createServerFn_handler, async ({ context }) => {
	const sql = await ensureWallet(context.userId);
	const wallet = await sql`
      select balance_paise from wallets where user_id = ${context.userId}
    `;
	const counts = await sql`
      select
        count(*)::int as order_count,
        count(*) filter (where status = 'queued')::int as queued_count,
        coalesce(sum(total_paise), 0)::int as spend_paise
      from engagement_orders
      where user_id = ${context.userId}
    `;
	const recent = await loadOrders(context.userId, 5);
	const days = await sql`
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
		days
	};
});
async function loadOrders(userId, limit, orderId) {
	const sql = await getSql();
	const orders = orderId ? await sql`
        select id, order_number, bundle_id, platform, link, base_quantity, total_paise, status,
               organic, interval_hours, variance_percent, provider_state, created_at::text as created_at
        from engagement_orders
        where user_id = ${userId} and id = ${orderId}
      ` : await sql`
        select id, order_number, bundle_id, platform, link, base_quantity, total_paise, status,
               organic, interval_hours, variance_percent, provider_state, created_at::text as created_at
        from engagement_orders
        where user_id = ${userId}
        order by created_at desc
        limit ${limit}
      `;
	if (orders.length === 0) return [];
	const items = orderId ? await sql`
        select id, order_id, engagement_type, service_name, quantity, delivered, price_paise, status
        from engagement_order_items
        where user_id = ${userId} and order_id = ${orderId}
        order by engagement_type
      ` : await sql`
        select id, order_id, engagement_type, service_name, quantity, delivered, price_paise, status
        from engagement_order_items
        where user_id = ${userId}
        order by engagement_type
      `;
	return orders.map((order) => ({
		...order,
		organic: Boolean(order.organic),
		items: items.filter((item) => item.order_id === order.id).map(({ order_id: _orderId, ...item }) => item)
	}));
}
var listOrders_createServerFn_handler = createServerRpc({
	id: "425c7b4ca8f20880d0302e9883fb473837e5aa38be46b193cf9259229643e6da",
	name: "listOrders",
	filename: "src/lib/panel.functions.ts"
}, (opts) => listOrders.__executeServer(opts));
var listOrders = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listOrders_createServerFn_handler, async ({ context }) => loadOrders(context.userId, 50));
var getOrder_createServerFn_handler = createServerRpc({
	id: "689905743bba58c841cddd71186cff995b2f84d19277e97a76db0b2613a3e1e7",
	name: "getOrder",
	filename: "src/lib/panel.functions.ts"
}, (opts) => getOrder.__executeServer(opts));
var getOrder = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((id) => {
	if (typeof id !== "string" || id.length < 8) throw new Error("Missing order.");
	return id;
}).handler(getOrder_createServerFn_handler, async ({ context, data }) => {
	return (await loadOrders(context.userId, 1, data))[0] ?? null;
});
var getWallet_createServerFn_handler = createServerRpc({
	id: "8507b8b1877b689bad2f7200dd2b5c6c424f63a35db7d7d280b5d6866b5139b5",
	name: "getWallet",
	filename: "src/lib/panel.functions.ts"
}, (opts) => getWallet.__executeServer(opts));
var getWallet = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getWallet_createServerFn_handler, async ({ context }) => {
	const sql = await ensureWallet(context.userId);
	const wallet = await sql`
      select balance_paise from wallets where user_id = ${context.userId}
    `;
	const transactions = await sql`
      select id, kind, amount_paise, note, created_at::text as created_at
      from wallet_transactions
      where user_id = ${context.userId}
      order by created_at desc
      limit 40
    `;
	return {
		balance_paise: wallet[0]?.balance_paise ?? 0,
		transactions
	};
});
var TOPUPS = /* @__PURE__ */ new Set([
	5e4,
	1e5,
	25e4,
	5e5
]);
var creditWallet_createServerFn_handler = createServerRpc({
	id: "fe298e400f147ebc637abd9013a1e42b7d6b8fd56f13b658cc8ef186d3146b40",
	name: "creditWallet",
	filename: "src/lib/panel.functions.ts"
}, (opts) => creditWallet.__executeServer(opts));
var creditWallet = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((amountPaise) => {
	const amount = Math.floor(Number(amountPaise));
	if (!TOPUPS.has(amount)) throw new Error("Pick one of the studio credit amounts.");
	return amount;
}).handler(creditWallet_createServerFn_handler, async ({ context, data }) => {
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
        'Studio credit. No payment gateway is connected.'
      )
    `;
	return { balance_paise: (await sql`
      select balance_paise from wallets where user_id = ${context.userId}
    `)[0]?.balance_paise ?? 0 };
});
var placeOrder_createServerFn_handler = createServerRpc({
	id: "568cbd336ac8c7208a2f719fcddda15fe5ece9f7dbc8489da0b4a37f54f35bf5",
	name: "placeOrder",
	filename: "src/lib/panel.functions.ts"
}, (opts) => placeOrder.__executeServer(opts));
var placeOrder = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => {
	const link = String(input?.link ?? "").trim();
	let parsed;
	try {
		parsed = new URL(link);
	} catch {
		throw new Error("Paste a full link, including https://.");
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("The link needs to start with http or https.");
	const baseQuantity = Math.floor(Number(input.baseQuantity));
	if (!Number.isFinite(baseQuantity) || baseQuantity < 100 || baseQuantity > 5e6) throw new Error("Base quantity must be between 100 and 5,000,000.");
	const enabledTypes = Array.isArray(input.enabledTypes) ? input.enabledTypes.filter((type) => typeof type === "string") : [];
	const quantities = {};
	if (input.quantities && typeof input.quantities === "object") for (const [type, value] of Object.entries(input.quantities)) {
		const quantity = Math.floor(Number(value));
		if (Number.isFinite(quantity) && quantity > 0 && quantity <= 5e7) quantities[type] = quantity;
	}
	return {
		bundleId: String(input.bundleId ?? ""),
		link,
		baseQuantity,
		organic: Boolean(input.organic),
		intervalHours: Math.min(72, Math.max(1, Math.floor(Number(input.intervalHours) || 1))),
		variancePercent: Math.min(50, Math.max(0, Math.floor(Number(input.variancePercent) || 0))),
		enabledTypes,
		quantities
	};
}).handler(placeOrder_createServerFn_handler, async ({ context, data }) => {
	const sql = await ensureWallet(context.userId);
	const items = await sql`
      select
        bi.engagement_type,
        bi.ratio_bps,
        bi.is_base,
        s.name,
        s.price_per_1k_paise,
        s.min_quantity,
        s.max_quantity,
        b.platform
      from bundle_items bi
      join services s on s.id = bi.service_id
      join bundles b on b.id = bi.bundle_id
      where bi.bundle_id = ${data.bundleId}
    `;
	if (items.length === 0) throw new Error("That cue set is not on the book.");
	const lines = moneyLines(items, data.baseQuantity, new Set(data.enabledTypes), data.quantities);
	if (lines.length === 0) throw new Error("Turn on at least the base line.");
	const total = lines.reduce((sum, line) => sum + line.price_paise, 0);
	if (((await sql`
      select balance_paise from wallets where user_id = ${context.userId}
    `)[0]?.balance_paise ?? 0) < total) throw new Error("The wallet does not cover this cue. Add studio credit first.");
	const orderId = crypto.randomUUID();
	const orderNumber = `MAG-${Math.floor(1e5 + Math.random() * 9e5)}`;
	const platform = items[0]?.platform ?? "instagram";
	await sql`
      update wallets
      set balance_paise = balance_paise - ${total}, updated_at = now()
      where user_id = ${context.userId} and balance_paise >= ${total}
    `;
	await sql`
      insert into engagement_orders (
        id, user_id, order_number, bundle_id, platform, link, base_quantity, total_paise,
        status, organic, interval_hours, variance_percent, provider_state
      ) values (
        ${orderId}, ${context.userId}, ${orderNumber}, ${data.bundleId}, ${platform}, ${data.link},
        ${data.baseQuantity}, ${total}, 'queued', ${data.organic}, ${data.intervalHours},
        ${data.variancePercent}, 'unconnected'
      )
    `;
	for (const line of lines) await sql`
        insert into engagement_order_items (
          id, order_id, user_id, engagement_type, service_name, quantity, delivered, price_paise, status
        ) values (
          ${crypto.randomUUID()}, ${orderId}, ${context.userId}, ${line.engagement_type},
          ${line.service_name}, ${line.quantity}, 0, ${line.price_paise}, 'queued'
        )
      `;
	await sql`
      insert into wallet_transactions (id, user_id, kind, amount_paise, note)
      values (
        ${crypto.randomUUID()},
        ${context.userId},
        'debit',
        ${-total},
        ${`Cue ${orderNumber} held on the ledger. No provider was called.`}
      )
    `;
	return {
		id: orderId,
		order_number: orderNumber,
		total_paise: total
	};
});
var simulateDelivery_createServerFn_handler = createServerRpc({
	id: "c2dccedbed6acbda54546c95947b7f40edd841c845ac4fbe771544e934873d72",
	name: "simulateDelivery",
	filename: "src/lib/panel.functions.ts"
}, (opts) => simulateDelivery.__executeServer(opts));
var simulateDelivery = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => {
	if (typeof id !== "string" || id.length < 8) throw new Error("Missing order.");
	return id;
}).handler(simulateDelivery_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	if ((await sql`
      update engagement_orders
      set status = 'complete'
      where id = ${data} and user_id = ${context.userId} and status = 'queued'
      returning id
    `).length === 0) throw new Error("That cue is not waiting.");
	await sql`
      update engagement_order_items
      set delivered = quantity, status = 'complete'
      where order_id = ${data} and user_id = ${context.userId}
    `;
	return { ok: true };
});
var listTickets_createServerFn_handler = createServerRpc({
	id: "53f8f7504e89ee6fcf5370296775e69d457b024b7850f178d85275d77c13d752",
	name: "listTickets",
	filename: "src/lib/panel.functions.ts"
}, (opts) => listTickets.__executeServer(opts));
var listTickets = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listTickets_createServerFn_handler, async ({ context }) => {
	return (await getSql())`
      select id, subject, body, created_at::text as created_at
      from support_tickets
      where user_id = ${context.userId}
      order by created_at desc
      limit 20
    `;
});
var openTicket_createServerFn_handler = createServerRpc({
	id: "eca33ce65d3c798ea431e095459370949a483f7098b8c9cbfa0c02e1b94b2432",
	name: "openTicket",
	filename: "src/lib/panel.functions.ts"
}, (opts) => openTicket.__executeServer(opts));
var openTicket = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => {
	const subject = String(input?.subject ?? "").trim().slice(0, 120);
	const body = String(input?.body ?? "").trim().slice(0, 2e3);
	if (subject.length < 3 || body.length < 8) throw new Error("Write a subject and a short note.");
	return {
		subject,
		body
	};
}).handler(openTicket_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const id = crypto.randomUUID();
	await sql`
      insert into support_tickets (id, user_id, subject, body)
      values (${id}, ${context.userId}, ${data.subject}, ${data.body})
    `;
	return { id };
});
//#endregion
export { creditWallet_createServerFn_handler, getCatalog_createServerFn_handler, getDashboard_createServerFn_handler, getOrder_createServerFn_handler, getWallet_createServerFn_handler, listOrders_createServerFn_handler, listTickets_createServerFn_handler, openTicket_createServerFn_handler, placeOrder_createServerFn_handler, simulateDelivery_createServerFn_handler };
