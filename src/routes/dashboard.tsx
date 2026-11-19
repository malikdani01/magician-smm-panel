import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Library, RefreshCw, Wallet, Wand2, ShoppingBag, Activity, Receipt, Code2, Server, Database, Globe, Cable, Clock, ChevronRight } from "lucide-react";
import { Authed } from "@/components/gate";
import { getDeskRole } from "@/lib/admin.functions";
import { apiBalances, getDashboard, getPrefs, listOrders, type DashboardData, type OrderRow } from "@/lib/panel.functions";
import { convertMajor, currencySnapshot, formatMajor, inr, moneyState, subscribeCurrency } from "@/lib/money";
import banner from "@/assets/welcome-banner.jpg";
import igLogo from "@/assets/logo-ig.png";
import ttLogo from "@/assets/logo-tt.png";
import ytLogo from "@/assets/logo-yt.png";
import fbLogo from "@/assets/logo-fb.png";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <Authed>
      <Dashboard />
    </Authed>
  ),
});

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}

type DashDrop = { status: string; place_at: string; quantity: number; engagement_type: string; sent?: number | null; error?: string | null };

function brandOf(order: OrderRow) {
  const link = order.link.toLowerCase();
  const platform = order.platform.toLowerCase();
  if (link.includes("tiktok") || platform.includes("tiktok")) return { name: "TikTok", logo: ttLogo };
  if (link.includes("instagram") || platform.includes("instagram")) return { name: "Instagram", logo: igLogo };
  if (link.includes("youtube") || platform.includes("youtube")) return { name: "YouTube", logo: ytLogo };
  if (link.includes("facebook") || platform.includes("facebook")) return { name: "Facebook", logo: fbLogo };
  return { name: order.platform || "Order", logo: "" };
}

function hostLabel(link: string) {
  try {
    const url = new URL(link);
    const path = url.pathname.replace(/\/$/, "");
    const short = path.length > 22 ? `${path.slice(0, 20)}…` : path;
    return `${url.hostname.replace(/^www\./, "")}${short}`;
  } catch {
    return link.length > 36 ? `${link.slice(0, 34)}…` : link;
  }
}

function progressOf(order: OrderRow, drops: DashDrop[]) {
  const total = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const delivered = drops.reduce((sum, drop) => sum + (drop.status === "placed" && typeof drop.sent === "number" ? drop.sent : 0), 0);
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((delivered / total) * 100))) : 0;
  return { total, delivered, pct };
}

function stuckReason(order: OrderRow, drops: DashDrop[], pct: number) {
  if (order.status === "complete" || order.status === "cancelled") return "";
  if (order.status === "paused") return "This order is paused. Resume it or new runs will not be placed.";
  const failed = [...drops].reverse().find((drop) => drop.status === "failed" && drop.error);
  if (failed?.error) return failed.error.replace(/^(retry \d+: |gaveup: |hold: |stopped: )/, "");
  const held = [...drops].reverse().find((drop) => drop.error && /hold:|retry|gaveup|minimum|not 100%/.test(drop.error));
  if (held?.error && pct === 0) return held.error.replace(/^(retry \d+: |gaveup: |hold: |stopped: )/, "");
  const overdue = drops.some((drop) => (drop.status === "waiting" || drop.status === "placing") && new Date(drop.place_at).getTime() < Date.now() - 15 * 60 * 1000);
  if (pct === 0 && overdue) return "This run is overdue and has not been placed.";
  if (pct === 0 && drops.length === 0 && Date.now() - new Date(order.created_at).getTime() > 2 * 60 * 1000) return "No schedule was created, so runs are not being placed.";
  return "";
}

function headline(order: OrderRow) {
  const views = order.items.find((item) => item.engagement_type === "views");
  const main = views && views.quantity > 0 ? views : order.items[0];
  const extras = order.items.filter((item) => item !== main && item.quantity > 0);
  return {
    title: `${brandOf(order).name} — ${main ? main.engagement_type[0].toUpperCase() + main.engagement_type.slice(1) : "Order"}`,
    qty: main?.quantity ?? order.base_quantity,
    type: main?.engagement_type ?? "views",
    extra: extras.slice(0, 3).map((item) => `${item.quantity.toLocaleString("en-IN")} ${item.engagement_type}`).join(", "),
  };
}

function activityStatus(order: OrderRow, pct: number) {
  if (order.status === "complete" || pct >= 100) return { label: "Completed", tone: "bg-emerald-400/15 text-emerald-300" };
  if (order.status === "cancelled" && pct > 0) return { label: "Partially Refunded", tone: "bg-amber-300/15 text-amber-200" };
  if (order.status === "cancelled") return { label: "Cancelled", tone: "bg-rose-400/15 text-rose-300" };
  if (order.status === "paused") return { label: "Paused", tone: "bg-amber-300/15 text-amber-200" };
  return { label: "Running", tone: "bg-violet-400/15 text-violet-200" };
}

function Ring({ pct }: { pct: number }) {
  const radius = 16;
  const length = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 44 44" className="size-11 shrink-0">
      <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3.5" />
      <circle cx="22" cy="22" r={radius} fill="none" stroke="#c4b5fd" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={length} strokeDashoffset={length - (pct / 100) * length} transform="rotate(-90 22 22)" />
      <text x="22" y="23.5" textAnchor="middle" fill="white" fontSize="9" fontWeight="700">{pct}%</text>
    </svg>
  );
}

function dayKey(input: Date) {
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${input.getFullYear()}-${month}-${day}`;
}

function GrowthChart({ orders }: { orders: OrderRow[] }) {
  const [span, setSpan] = useState<7 | 14 | 30>(7);
  const [mode, setMode] = useState<"orders" | "volume">("orders");
  const points = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: span }, (_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (span - 1 - index));
      const key = dayKey(day);
      const same = orders.filter((order) => dayKey(new Date(order.created_at)) === key);
      const value = mode === "orders" ? same.length : same.reduce((sum, order) => sum + order.items.reduce((inner, item) => inner + item.quantity, 0), 0);
      return { key, label: day.toLocaleDateString("en-US", { month: "short", day: "2-digit" }), value };
    });
  }, [orders, span, mode]);
  const max = Math.max(1, ...points.map((point) => point.value));
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const width = 320;
  const height = 120;
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - 18 - (point.value / max) * (height - 36);
    return { ...point, x, y };
  });
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <section className="rounded-3xl border border-white/10 bg-[#120c22] p-4 text-white shadow-[0_0_24px_rgba(124,107,255,0.12)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[18px] font-bold">Growth Velocity <span className="ml-1 inline-block size-2 rounded-full bg-emerald-400" /></p>
        <p className="text-[12px] font-semibold text-amber-200">{total.toLocaleString("en-IN")} {mode === "orders" ? "orders" : "volume"}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-full bg-white/5 p-1">
          {([7, 14, 30] as const).map((days) => (
            <button key={days} type="button" onClick={() => setSpan(days)} className={`h-8 rounded-full px-3 text-[12px] font-semibold ${span === days ? "bg-amber-300 text-slate-950" : "text-white/70"}`}>{days}D</button>
          ))}
        </div>
        <div className="flex gap-1 rounded-full bg-white/5 p-1">
          {(["orders", "volume"] as const).map((item) => (
            <button key={item} type="button" onClick={() => setMode(item)} className={`h-8 rounded-full px-3 text-[12px] font-semibold capitalize ${mode === item ? "bg-amber-300 text-slate-950" : "text-white/70"}`}>{item}</button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-36 w-full">
        <defs>
          <linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </linearGradient>
        </defs>
        <text x="0" y="12" fill="currentColor" fontSize="10" className="chart-ink">{max.toLocaleString("en-IN")}</text>
        {[0, 1, 2].map((row) => <line key={row} x1="0" x2={width} y1={20 + row * 32} y2={20 + row * 32} className="chart-grid" />)}
        <path d={area} fill="url(#growth-fill)" />
        <path d={line} fill="none" stroke="#f59e0b" strokeWidth="2.4" />
        {coords.map((point) => (
          <g key={point.key}>
            <circle cx={point.x} cy={point.y} r="3.2" fill="#fff" stroke="#f59e0b" strokeWidth="2" />
            {point.value > 0 && <text x={point.x} y={Math.max(12, point.y - 8)} textAnchor="middle" fill="currentColor" fontSize="9" fontWeight="700" className="chart-ink">{point.value.toLocaleString("en-IN")}</text>}
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-white/45">
        {coords.filter((_, index) => index % Math.ceil(coords.length / 6) === 0 || index === coords.length - 1).map((point) => <span key={point.key}>{point.label}</span>)}
      </div>
    </section>
  );
}
const API_ICONS = [Code2, Server, Database, Globe, Cable];
const TONES = [
  { wash: "from-violet-600 to-fuchsia-500", Icon: Wallet },
  { wash: "from-sky-500 to-indigo-500", Icon: ShoppingBag },
  { wash: "from-emerald-500 to-teal-400", Icon: Activity },
  { wash: "from-amber-500 to-orange-400", Icon: Receipt },
];

function Dashboard() {
  const { user } = useCurrentUserState();
  useSyncExternalStore(subscribeCurrency, currencySnapshot, currencySnapshot);
  const money = moneyState();
  const [data, setData] = useState<DashboardData | null>(null);
  const [name, setName] = useState("");
  const [admin, setAdmin] = useState(false);
  const [balances, setBalances] = useState<Awaited<ReturnType<typeof apiBalances>>>([]);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [drops, setDrops] = useState<Record<string, DashDrop[]>>({});

  function loadOrders() {
    const stamp = Date.now();
    listOrders({ data: { t: stamp, limit: 200 } }).then(async (rows) => {
      setOrders(rows);
      const open = rows.filter((order) => order.status !== "complete" && order.status !== "cancelled");
      const pairs: (readonly [string, DashDrop[]])[] = [];
      for (let index = 0; index < open.length; index += 8) {
        const batch = open.slice(index, index + 8);
        const loaded = await Promise.all(batch.map(async (order) => {
          const res = await fetch(`/api/drops/${order.id}?t=${stamp}`, { cache: "no-store" }).catch(() => null);
          const body = res?.ok ? await res.json().catch(() => ({ drops: [] })) : { drops: [] };
          return [order.id, (body.drops || []) as DashDrop[]] as const;
        }));
        pairs.push(...loaded);
      }
      setDrops(Object.fromEntries(pairs));
    }).catch(() => setOrders([]));
  }

  function loadBalances(silent = false) {
    if (!silent) setChecking(true);
    apiBalances()
      .then((rows) => {
        setBalances(rows);
        setCheckedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      })
      .catch(() => { if (!silent) setBalances([]); })
      .finally(() => { if (!silent) setChecking(false); });
  }

  useEffect(() => {
    getDashboard().then(setData).catch(() => setData(null));
    loadOrders();
    const timer = window.setInterval(loadOrders, 8000);
    getPrefs().then((prefs) => setName(prefs.full_name || "")).catch(() => setName(""));
    let balanceTimer = 0;
    let stopped = false;
    getDeskRole()
      .then((role) => {
        if (stopped || role !== "admin") return;
        setAdmin(true);
        loadBalances();
        balanceTimer = window.setInterval(() => loadBalances(true), 3000);
      })
      .catch(() => setAdmin(false));
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.clearInterval(balanceTimer);
    };
  }, []);

  const display = name || user?.displayName || "Member";
  const running = orders.filter((order) => {
    if (order.status === "complete" || order.status === "cancelled") return false;
    return progressOf(order, drops[order.id] ?? []).pct < 100;
  });
  const recent = orders.filter((order) => Date.now() - new Date(order.created_at).getTime() < 24 * 60 * 60 * 1000);
  const cards = [
    ["BALANCE", data ? inr(data.balance_paise) : "—", "Available funds"],
    ["TOTAL ORDERS", String(data?.order_count ?? 0), `${data?.order_count ?? 0} completed`],
    ["ACTIVE", String(data?.queued_count ?? 0), "In progress"],
    ["TOTAL SPENT", data ? inr(data.spend_paise) : "—", "All time"],
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="welcome-banner relative aspect-[1874/839] overflow-hidden rounded-[28px]">
        <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/25 to-transparent" />
        <div className="welcome-shine" />
        <div className="relative z-10 max-w-lg p-6 md:p-8">
          <p className="rise-in text-[13px] text-white/85">{greeting()}</p>
          <h1 className="rise-in rise-d1 text-[34px] font-extrabold leading-none text-white md:text-[42px]">Welcome back, <span className="name-glow text-amber-300">{display}</span></h1>
          <p className="rise-in rise-d2 mt-2 max-w-sm text-[13px] text-white/85">Your SMM panel is ready. Place a drip, check APIs, add credit.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/engagement-order" className="btn-live inline-flex h-11 items-center rounded-full bg-amber-300 px-5 text-[13px] font-semibold text-slate-950">Create New Order</Link>
            <Link to="/single-order" className="btn-pop inline-flex h-11 items-center rounded-full border border-white/50 bg-black/30 px-5 text-[13px] font-semibold text-white backdrop-blur">Single Order</Link>
            <Link to="/mass" className="btn-pop rise-d4 inline-flex h-11 items-center rounded-full border border-white/50 bg-black/30 px-5 text-[13px] font-semibold text-white backdrop-blur">Mass Order</Link>
          </div>
        </div>
      </section>

      {admin && (
        <section className="api-balance">
          <div className="api-balance-head">
            <span className="api-balance-mark"><Code2 className="size-4" /></span>
            <div className="min-w-0">
              <h2>API balance</h2>
              <p><Clock className="size-3.5" /> {checkedAt ? `Checked ${checkedAt}` : "Not checked yet"} · Full engagement APIs only</p>
            </div>
            <button type="button" onClick={() => loadBalances()} disabled={checking}>
              <RefreshCw className={`size-3.5 ${checking ? "animate-spin" : ""}`} /> {checking ? "Checking" : "Refresh"}
            </button>
          </div>
          {balances.length === 0 ? (
            <p className="api-balance-empty">{checking ? "Loading balances…" : "No API saved. Add the URL and key in Full Engagement APIs."}</p>
          ) : (
            <ul>
              {balances.map((row, index) => {
                const Icon = API_ICONS[index % API_ICONS.length];
                const code = row.currency.toUpperCase();
                const tone = code === "INR" ? "cyan" : code === "USD" || row.low ? "pink" : "";
                return (
                  <li key={`${row.host}-${row.keyTail}-${row.label}`} style={{ animationDelay: `${index * 50}ms` }}>
                    <span className="api-balance-icon"><Icon className="size-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate capitalize">{row.label.replaceAll(":", " · ")}</p>
                      <small className="block truncate">{row.host} · key ***{row.keyTail}</small>
                      {row.error && <small className="api-balance-error">{row.error}</small>}
                    </div>
                    <div className="api-balance-amt">
                      <b className={tone}>{row.error ? "—" : (() => {
                        const converted = convertMajor(row.balance, row.currency || "USD", money.display.code);
                        return converted == null ? <>{row.balance.toLocaleString("en-IN")} <span>{row.currency}</span></> : <>{formatMajor(converted)} <span>{money.display.code}</span></>;
                      })()}</b>
                      {row.low && !row.error && <em>Low · refill</em>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, value, hint], index) => {
          const tone = TONES[index % TONES.length];
          const Icon = tone.Icon;
          return (
            <article key={label} className={`stat-pop relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white ${tone.wash}`} style={{ animationDelay: `${index * 60}ms` }}>
              <span className="mb-2 grid size-8 place-items-center rounded-xl bg-white/20"><Icon className="size-4" /></span>
              <p className="text-[10px] font-semibold tracking-wide text-white/80">{label}</p>
              <p className="text-[22px] font-extrabold">{value}</p>
              <p className="text-[12px] text-white/75">{hint}</p>
              <svg viewBox="0 0 120 36" className="mt-2 h-8 w-full opacity-80" aria-hidden>
                <path d="M0 28 C 18 26, 24 18, 40 20 S 62 8, 78 14 100 6 120 10" fill="none" stroke="white" strokeWidth="2" />
              </svg>
            </article>
          );
        })}
      </div>

      <section className="rounded-3xl border border-white/10 bg-[#120c22] p-4 text-white shadow-[0_0_24px_rgba(124,107,255,0.12)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[18px] font-bold">
            <span className="size-2 rounded-full bg-emerald-400" /> Running Orders
            <span className="grid size-6 place-items-center rounded-full bg-violet-400/20 text-[12px] text-violet-200">{running.length}</span>
          </p>
          <Link to="/engagement-orders" className="text-[13px] font-semibold text-amber-300">View all →</Link>
        </div>
        {running.length === 0 ? (
          <p className="rounded-2xl bg-white/5 px-3 py-6 text-center text-[13px] text-white/55">No running orders. Orders that are still delivering show up here.</p>
        ) : (
          <ul className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
            {running.map((order) => {
              const brand = brandOf(order);
              const { pct } = progressOf(order, drops[order.id] ?? []);
              const reason = stuckReason(order, drops[order.id] ?? [], pct);
              const main = order.items.find((item) => item.quantity > 0);
              return (
                <li key={order.id}>
                  <Link to="/orders/$id" params={{ id: order.id }} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                    <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-black">
                      {brand.logo ? <img src={brand.logo} alt="" className="size-7 object-contain" /> : <span className="text-[12px] font-bold">{brand.name.slice(0, 1)}</span>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{hostLabel(order.link)}</span>
                      <span className="block truncate text-[11px] text-white/55">{main ? `${main.quantity.toLocaleString("en-IN")} ${main.engagement_type}` : "Order"} · #{order.order_number.replace("MAG-", "")}</span>
                      {reason && <span className="mt-1 block text-[11px] font-semibold text-rose-400">{reason}</span>}
                    </span>
                    <Ring pct={pct} />
                    <ChevronRight className="size-4 shrink-0 text-white/40" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-white/10 bg-[#120c22] p-4 text-white shadow-[0_0_24px_rgba(124,107,255,0.12)]">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[18px] font-bold">Recent Activity</p>
          <Link to="/engagement-orders" className="text-[13px] font-semibold text-white/70">View All</Link>
        </div>
        {recent.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-white/55">No orders yet.</p>
        ) : (
          <ul className="max-h-[440px] divide-y divide-white/10 overflow-y-auto pr-1">
            {recent.map((order) => {
              const brand = brandOf(order);
              const line = headline(order);
              const { pct } = progressOf(order, drops[order.id] ?? []);
              const status = activityStatus(order, pct);
              const when = new Date(order.created_at);
              return (
                <li key={order.id}>
                  <Link to="/orders/$id" params={{ id: order.id }} className="flex items-start gap-3 py-3">
                    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-black">
                      {brand.logo ? <img src={brand.logo} alt="" className="size-7 object-contain" /> : <span className="font-bold">{brand.name.slice(0, 1)}</span>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold capitalize">{line.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-white/55">
                        <span>#{order.order_number.replace("MAG-", "")}</span>
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${status.tone}`}>{status.label}</span>
                        <span>{when.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} {when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[16px] font-bold text-emerald-400">+{line.qty.toLocaleString("en-IN")}</span>
                      {line.extra && <span className="block max-w-28 text-[11px] text-white/50">+ {line.extra}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <GrowthChart orders={orders} />

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-2xl border p-5">
          <p className="font-semibold">All Orders</p>
          <p className="mt-2 text-[13px] text-[#94a3b8]">{data?.recent.length ? `${data.recent.length} recent` : "No engagement orders yet"}</p>
          <Link to="/engagement-order" className="mt-4 inline-flex h-10 items-center rounded-full bg-[#3b82f6] px-4 text-[13px] font-semibold text-white">Create First Order</Link>
        </section>
        <section className="rounded-2xl border p-5">
          <p className="font-semibold">Single Orders</p>
          <p className="mt-2 text-[13px] text-[#94a3b8]">Browse a service and place one order</p>
          <Link to="/catalog" className="mt-4 inline-flex h-10 items-center rounded-full bg-[#3b82f6] px-4 text-[13px] font-semibold text-white">Place Order</Link>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Link to="/engagement-order" className="flex items-center justify-between rounded-2xl border p-3 text-[12px]"><span><Wand2 className="mb-1 size-4 text-violet-300" /><b className="block">Full Engagement</b><span className="text-[#94a3b8]">Views + Likes + Saves</span></span><span>→</span></Link>
        <Link to="/wallet" className="flex items-center justify-between rounded-2xl border p-3 text-[12px]"><span><Wallet className="mb-1 size-4 text-emerald-300" /><b className="block">Add Funds</b><span className="text-[#94a3b8]">{data ? inr(data.balance_paise) : "Deposit to wallet"}</span></span><span>→</span></Link>
        <Link to="/catalog" className="flex items-center justify-between rounded-2xl border p-3 text-[12px]"><span><Library className="mb-1 size-4 text-cyan-300" /><b className="block">All Services</b><span className="text-[#94a3b8]">Browse catalog</span></span><span>→</span></Link>
      </div>
    </div>
  );
}
