import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, Eye, Heart, Share2 } from "lucide-react";
import { Authed } from "@/components/gate";
import { listOrderDrops, listOrders, type OrderRow } from "@/lib/panel.functions";
import { inr } from "@/lib/money";

export const Route = createFileRoute("/engagement-orders")({
  component: () => (
    <Authed>
      <Orders />
    </Authed>
  ),
});

type Drop = { status: string; place_at: string; quantity: number; engagement_type: string; sent?: number | null; remains?: number | null; pct?: number | null };

function Orders() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [drops, setDrops] = useState<Record<string, Drop[]>>({});
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "progress" | "pending" | "completed" | "cancelled">("all");

  function load() {
    const stamp = Date.now();
    listOrders({ data: { t: stamp } }).then(async (orders) => {
      setRows(orders);
      const pairs = await Promise.all(orders.slice(0, 20).map(async (order) => {
        const res = await fetch(`/api/drops/${order.id}?t=${stamp}`, { cache: "no-store" }).catch(() => null);
        const data = res?.ok ? await res.json().catch(() => ({ drops: [] })) : { drops: [] };
        return [order.id, data.drops || []] as const;
      }));
      setDrops(Object.fromEntries(pairs));
    }).catch(() => setRows([]));
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 8000);
    return () => window.clearInterval(timer);
  }, []);

  function bucket(order: OrderRow) {
    if (order.status === "cancelled") return "cancelled" as const;
    const list = drops[order.id] ?? [];
    const total = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const delivered = list.reduce((sum, drop) => sum + (drop.status === "placed" && typeof drop.sent === "number" ? drop.sent : 0), 0);
    const pct = total ? Math.round((delivered / total) * 100) : 0;
    if (order.status === "complete" || pct >= 100) return "completed" as const;
    const started = pct > 0 || list.some((drop) => drop.status === "placed" || drop.status === "placing");
    return started ? "progress" as const : "pending" as const;
  }

  const counts = {
    all: rows.length,
    progress: rows.filter((row) => bucket(row) === "progress").length,
    pending: rows.filter((row) => bucket(row) === "pending").length,
    completed: rows.filter((row) => bucket(row) === "completed").length,
    cancelled: rows.filter((row) => bucket(row) === "cancelled").length,
  };
  const tabs = [
    ["all", "All", counts.all],
    ["progress", "In Progress", counts.progress],
    ["pending", "Pending", counts.pending],
    ["completed", "Completed", counts.completed],
    ["cancelled", "Cancelled", counts.cancelled],
  ] as const;
  const shown = rows.filter((row) => {
    const text = `${row.order_number} ${row.link}`.toLowerCase().includes(q.toLowerCase());
    return text && (tab === "all" || bucket(row) === tab);
  });
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold">All Orders</h1>
          <p className="text-[13px] text-[#64748b]">Single, drip and full engagement orders, with live tracking</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="rounded-full border bg-white px-3 py-2 text-[12px] font-semibold">Refresh</button>
          <Link to="/engagement-order" className="rounded-xl bg-[#2563eb] px-3 py-2 text-[12px] font-semibold text-white">+ New Order</Link>
        </div>
      </div>
      <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search by order number or video link..." className="h-12 w-full rounded-2xl bg-[#e7f0fa] px-4 outline-none" />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(([id, label, count]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-[13px] font-semibold ${tab === id ? "border-amber-300 bg-amber-300 text-slate-950" : "border-white/15 bg-white/5"}`}>
            {label}
            <span className={`grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] ${tab === id ? "bg-black/15" : "bg-white/10"}`}>{count}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <section className="rounded-3xl border border-[#e7eef6] bg-white py-16 text-center">
          <p>{rows.length === 0 ? "No orders yet" : "No orders in this tab"}</p>
          <Link to="/engagement-order" className="mt-3 inline-flex h-10 items-center rounded-xl bg-[#2563eb] px-4 text-[13px] font-semibold text-white">Place Your First Order</Link>
        </section>
      ) : (
        <ul className="space-y-3">
          {shown.map((row) => <OrderCard key={row.id} order={row} drops={drops[row.id] ?? []} />)}
        </ul>
      )}
    </div>
  );
}

function OrderCard({ order, drops }: { order: OrderRow; drops: Drop[] }) {
  const placed = drops.filter((drop) => drop.status === "placed").length;
  const pending = drops.filter((drop) => drop.status === "waiting" || drop.status === "paused").length;
  const active = drops.filter((drop) => drop.status === "placing").length;
  const delivered = drops.reduce((sum, drop) => sum + (drop.status === "placed" && typeof drop.sent === "number" ? drop.sent : 0), 0);
  const total = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const next = drops.filter((drop) => drop.status === "waiting").sort((a, b) => a.place_at.localeCompare(b.place_at))[0];
  const pct = order.status === "complete" ? 100 : total ? Math.max(0, Math.min(100, Math.round((delivered / total) * 100))) : 0;
  return (
    <li>
      <Link to="/orders/$id" params={{ id: order.id }} className="block rounded-[24px] border border-[#e7eef6] bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">Order #{order.order_number.replace("MAG-", "")} <span className="ml-1 rounded-full bg-[#111827] px-2 py-0.5 text-[10px] font-bold text-white">{order.status}</span> {order.organic && <span className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Organic</span>}</p>
            <p className="mt-1 max-w-md truncate text-[12px] text-[#64748b]">{order.link}</p>
          </div>
          <div className="flex shrink-0 items-start gap-2 text-right">
            <OrderRing pct={pct} />
            <div>
              <p className="font-bold">{inr(order.total_paise)}</p>
              <p className="text-[11px] font-semibold text-[#2563eb]">Open live tracking ›</p>
              <p className="text-[11px] text-[#94a3b8]">{ago(order.created_at)}</p>
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <Stat label="Delivered" value={delivered} />
          <Stat label="Placed" value={placed} />
          <Stat label="Pending" value={pending} />
          <Stat label="Active" value={active} />
        </div>
        <div className="mt-3 flex justify-between text-[12px] text-[#64748b]">
          <span>{placed} / {drops.length || order.items.length} runs</span>
          <span>{delivered.toLocaleString("en-IN")} / {total.toLocaleString("en-IN")} ({pct}%)</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#e7eef6]"><div className="h-full bg-[#93c5fd]" style={{ width: `${pct}%` }} /></div>
        {next && <p className="mt-3 rounded-xl bg-[#f4f8fc] px-3 py-2 text-[13px] text-[#334155]">Next run: {clock(next.place_at)} (in {fromNow(next.place_at)})</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
          {order.items.map((item) => {
            const sent = drops.filter((drop) => drop.engagement_type === item.engagement_type).reduce((sum, drop) => sum + (drop.status === "placed" && typeof drop.sent === "number" ? drop.sent : 0), 0);
            const placedQty = drops.filter((drop) => drop.engagement_type === item.engagement_type && drop.status === "placed").reduce((sum, drop) => sum + drop.quantity, 0);
            return (
              <span key={item.id} className="inline-flex items-center gap-1 rounded-full bg-[#f8fafc] px-2 py-1">
                <TypeIcon type={item.engagement_type} /> {item.engagement_type}: {sent}/{item.quantity} deliver · {placedQty} placed
              </span>
            );
          })}
        </div>
      </Link>
    </li>
  );
}

function OrderRing({ pct }: { pct: number }) {
  const radius = 18;
  const length = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 48 48" className="size-12 shrink-0" aria-label={`${pct}% complete`}>
      <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(148,163,184,0.35)" strokeWidth="4" />
      <circle cx="24" cy="24" r={radius} fill="none" stroke="#a78bfa" strokeWidth="4" strokeLinecap="round" strokeDasharray={length} strokeDashoffset={length - (pct / 100) * length} transform="rotate(-90 24 24)" />
      <text x="24" y="25.5" textAnchor="middle" fill="currentColor" fontSize="10" fontWeight="700">{pct}%</text>
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-[#f4f8fc] px-2 py-3 text-center">
      <p className="text-[18px] font-bold">{value.toLocaleString("en-IN")}</p>
      <p className="text-[11px] text-[#64748b]">{label}</p>
    </div>
  );
}

function TypeIcon({ type }: { type: string }) {
  if (type === "likes") return <Heart className="size-3 text-rose-500" />;
  if (type === "shares" || type === "reposts") return <Share2 className="size-3 text-sky-500" />;
  if (type === "saves") return <Bookmark className="size-3 text-amber-500" />;
  return <Eye className="size-3 text-emerald-500" />;
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function ago(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "less than a minute ago";
  if (min < 60) return `${min} min ago`;
  return `${Math.round(min / 60)}h ago`;
}

function fromNow(iso: string) {
  const min = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (min <= 0) return "less than a minute";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"}`;
  const hours = Math.round(min / 60);
  return hours === 1 ? "about 1 hour" : `about ${hours} hours`;
}
