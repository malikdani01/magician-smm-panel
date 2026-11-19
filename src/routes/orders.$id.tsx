import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Authed } from "@/components/gate";
import { checkDropStatus, editScheduledDrop, getOrder, listOrderDrops, setOrderFlow, setRunState, type OrderRow } from "@/lib/panel.functions";
import { growthPreview, graphBotScore } from "@/lib/organic";
import { inr } from "@/lib/money";

export const Route = createFileRoute("/orders/$id")({ component: DetailPage });

type Drop = {
  id: string;
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

function sentOf(drop: Drop) {
  if (drop.status !== "placed" || typeof drop.sent !== "number") return 0;
  return drop.sent;
}

function OrganicBoard({ order, drops }: { order: OrderRow; drops: Drop[] }) {
  const [now, setNow] = useState(() => Date.now());
  const [mode, setMode] = useState<"batch" | "total">("total");
  const [schedule, setSchedule] = useState<"batch" | "day">("batch");
  const [shown, setShown] = useState(6);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const sorted = [...drops].sort((a, b) => a.place_at.localeCompare(b.place_at));
  let saved: { quantities?: Record<string, number>; delivery?: Record<string, { hours: number; runs: number; variance?: number; peak?: boolean; curve?: number[] }> } | null = null;
  try {
    saved = order.preview_json ? JSON.parse(order.preview_json) : null;
  } catch {
    saved = null;
  }
  const qty = (type: string) => order.items.find((item) => item.engagement_type === type)?.quantity ?? 0;
  const typed = (type: "views" | "likes" | "shares" | "saves") => {
    const value = saved?.quantities?.[type];
    return typeof value === "number" && value > 0 ? value : qty(type);
  };
  const done = (type: string) => drops.filter((drop) => drop.engagement_type === type).reduce((sum, drop) => sum + sentOf(drop), 0);
  const views = typed("views");
  const likes = typed("likes");
  const shares = typed("shares");
  const saves = typed("saves");
  const gotViews = done("views");
  const gotLikes = done("likes");
  const gotShares = done("shares");
  const gotSaves = done("saves");
  const deliveredEngagement = gotLikes + gotShares + gotSaves;
  const actualRate = gotViews > 0 ? (deliveredEngagement / gotViews) * 100 : 0;
  const fallbackDelivery = Object.fromEntries((["views", "likes", "shares", "saves"] as const).map((type) => {
    const rows = sorted.filter((drop) => drop.engagement_type === type);
    if (rows.length === 0) return [type, { hours: 1, runs: 1, variance: order.variance_percent }];
    const span = (new Date(rows[rows.length - 1].place_at).getTime() - new Date(rows[0].place_at).getTime()) / 3600000;
    return [type, { hours: Math.max(0.25, span || 0.25), runs: rows.length, variance: order.variance_percent }];
  }));
  const preview = growthPreview({
    quantities: { views, likes, shares, saves },
    delivery: saved?.delivery ?? fallbackDelivery,
    origin: new Date(order.created_at).getTime() || Date.now(),
  });
  const planned = preview.engagement;
  const plannedRate = preview.rate;
  const live = order.status === "processing" || order.status === "pending";
  const upcoming = sorted.filter((drop) => drop.status === "waiting" || drop.status === "placing" || drop.status === "paused");
  const next = upcoming[0];
  const after = next ? upcoming.find((drop) => drop.engagement_type !== next.engagement_type) : undefined;
  const due = next ? new Date(next.place_at).getTime() - now : 0;
  const clockLeft = !next ? "" : next.status === "placing" ? "Placing" : due <= 0 ? "Due now" : `${Math.floor(due / 3600000)}h ${Math.floor((due % 3600000) / 60000)}m`;
  const rateOf = (part: number, base: number) => (base > 0 ? (part / base) * 100 : 0);
  const cards = [
    { label: "Views", icon: "◎", got: gotViews, target: views, note: `${views ? Math.round((gotViews / views) * 100) : 0}%`, tone: "text-violet-300" },
    { label: "Likes", icon: "♡", got: gotLikes, target: likes, note: `${rateOf(gotLikes, gotViews).toFixed(1)}% of views`, tone: "text-pink-300" },
    { label: "Shares", icon: "➤", got: gotShares, target: shares, note: `${rateOf(gotShares, gotViews).toFixed(1)}% of views`, tone: "text-emerald-300" },
    { label: "Saves", icon: "▣", got: gotSaves, target: saves, note: `${rateOf(gotSaves, gotViews).toFixed(1)}% of views`, tone: "text-amber-300" },
  ];
  const chartKeys = ["views", "likes", "shares", "saves"] as const;
  const chartColor: Record<(typeof chartKeys)[number], string> = { views: "#c084fc", likes: "#60a5fa", shares: "#22d3ee", saves: "#f472b6" };
  const ceiling = Math.max(views, likes, shares, saves, gotViews, gotLikes, gotShares, gotSaves, 1);
  const origin = new Date(order.created_at).getTime() || (sorted[0] ? new Date(sorted[0].place_at).getTime() : now);
  const horizon = Math.max(now, ...sorted.map((drop) => new Date(drop.place_at).getTime()), origin + 15 * 60 * 1000);
  const spanMs = Math.max(1, horizon - origin);
  const steps = 48;
  const liveLines = Object.fromEntries(chartKeys.map((key) => {
    const mine = sorted.filter((drop) => drop.engagement_type === key && drop.status === "placed");
    const points: number[] = [];
    const batches: number[] = [];
    for (let index = 0; index < steps; index += 1) {
      const at = origin + (index / (steps - 1)) * spanMs;
      if (at > now + 1500) {
        points.push(Number.NaN);
        batches.push(Number.NaN);
        continue;
      }
      const prevAt = index === 0 ? origin - 1 : origin + ((index - 1) / (steps - 1)) * spanMs;
      let total = 0;
      let step = 0;
      for (const drop of mine) {
        const when = new Date(drop.place_at).getTime();
        if (when > at) continue;
        const sent = sentOf(drop);
        total += sent;
        if (when > prevAt) step += sent;
      }
      points.push(Math.sqrt(Math.min(1, total / ceiling)));
      batches.push(Math.sqrt(Math.min(1, step / ceiling)));
    }
    return [key, { points, batches }];
  })) as Record<(typeof chartKeys)[number], { points: number[]; batches: number[] }>;
  const shownLine = Object.fromEntries(chartKeys.map((key) => [key, mode === "total" ? liveLines[key].points : liveLines[key].batches])) as Record<(typeof chartKeys)[number], number[]>;
  const width = 640;
  const height = 230;
  const pad = { l: 36, r: 8, t: 12, b: 28 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const linePath = (points: number[]) => {
    let drawing = false;
    return points.map((point, index) => {
      if (!Number.isFinite(point)) {
        drawing = false;
        return "";
      }
      const x = pad.l + (index / Math.max(1, points.length - 1)) * innerW;
      const y = pad.t + (1 - point) * innerH;
      const cmd = drawing ? "L" : "M";
      drawing = true;
      return `${cmd}${x.toFixed(1)},${y.toFixed(1)}`;
    }).filter(Boolean).join(" ");
  };
  const viewPath = linePath(shownLine.views ?? []);
  const area = `${viewPath} L${pad.l + innerW},${pad.t + innerH} L${pad.l},${pad.t + innerH} Z`;
  const spanH = Math.max(0.25, spanMs / 3600000);
  const xTicks = [0, 0.5, 1].map((part) => ({
    x: pad.l + part * innerW,
    label: part === 0 ? "Start" : spanH * part < 48 ? `${Math.round(spanH * part)}h` : `${(spanH * part / 24).toFixed(1)}d`,
  }));
  const yTicks = [0, 0.5, 1].map((frac) => ({ y: pad.t + (1 - Math.sqrt(frac)) * innerH, label: Math.round(frac * ceiling).toLocaleString("en-IN") }));
  const hours = spanH;
  const elapsedH = Math.max(0.25, (now - origin) / 3600000);
  const floors: Record<(typeof chartKeys)[number], number> = { views: 100, likes: 10, shares: 10, saves: 50 };
  const liveServices = chartKeys.filter((key) => (key === "views" ? gotViews : key === "likes" ? gotLikes : key === "shares" ? gotShares : gotSaves) > 0).map((key) => ({
    key,
    label: key[0].toUpperCase() + key.slice(1),
    qty: key === "views" ? gotViews : key === "likes" ? gotLikes : key === "shares" ? gotShares : gotSaves,
    runs: Math.max(1, drops.filter((drop) => drop.engagement_type === key && sentOf(drop) > 0).length),
    hours: elapsedH,
    floor: floors[key],
  }));
  const bot = liveServices.length === 0
    ? { score: 0, band: "0-20", name: "Waiting", action: "No quantity has been delivered yet. The graph appears when the first run reaches the video." }
    : graphBotScore({
      views: gotViews,
      likes: gotLikes,
      shares: gotShares,
      saves: gotSaves,
      hours: elapsedH,
      runs: liveServices.find((item) => item.key === "views")?.runs || liveServices[0].runs,
      services: liveServices,
    });
  const botBar = bot.score <= 20 ? "#22c55e" : bot.score <= 40 ? "#14b8a6" : bot.score <= 60 ? "#f59e0b" : bot.score <= 80 ? "#f97316" : "#ef4444";
  const mix = [
    { label: "Likes", value: gotLikes, color: "#f472b6" },
    { label: "Shares", value: gotShares, color: "#34d399" },
    { label: "Saves", value: gotSaves, color: "#fbbf24" },
  ];
  const mixTotal = mix.reduce((sum, item) => sum + item.value, 0);
  const ring = 2 * Math.PI * 28;
  let ringAt = 0;
  const days = new Map<string, { views: number; likes: number; shares: number; saves: number; got: number }>();
  for (const drop of sorted) {
    const day = new Date(drop.place_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    const row = days.get(day) || { views: 0, likes: 0, shares: 0, saves: 0, got: 0 };
    if (drop.engagement_type === "views") row.views += drop.quantity;
    if (drop.engagement_type === "likes") row.likes += drop.quantity;
    if (drop.engagement_type === "shares") row.shares += drop.quantity;
    if (drop.engagement_type === "saves") row.saves += drop.quantity;
    row.got += sentOf(drop);
    days.set(day, row);
  }
  const dayRows = [...days.entries()];
  return (
    <section className="space-y-3 rounded-[24px] border border-violet-500/30 bg-[#0c1020] p-3 text-white shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[18px] font-bold">Organic Delivery <span className={`ml-1 rounded-full px-2 py-0.5 align-middle text-[10px] font-bold ${live ? "bg-rose-500 text-white" : "bg-white/10 text-white/70"}`}>{live ? "LIVE" : order.status}</span></p>
          <p className="text-[12px] text-white/55">Live graph · delivered quantity se banta hai · {sorted.length} batches</p>
        </div>
        <div className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-pink-500 px-4 py-3 sm:w-64">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-bold tracking-wide text-white/80">NEXT BATCH{next ? ` · ${new Date(next.place_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }).toUpperCase()}` : ""}</p>
            <p className="text-[13px] font-bold">{clockLeft || "—"}</p>
          </div>
          {next ? (
            <>
              <p className="text-[22px] font-bold leading-tight">{next.quantity.toLocaleString("en-IN")} {next.engagement_type}</p>
              <p className="text-[12px] text-white/80">{after ? `then ${after.quantity.toLocaleString("en-IN")} ${after.engagement_type}` : next.status}</p>
            </>
          ) : <p className="mt-1 text-[13px]">No delivery batches waiting.</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-white/10 bg-[#14182b] p-3">
            <p className={`text-[12px] font-semibold ${card.tone}`}>{card.icon} {card.label}</p>
            <p className="text-[26px] font-bold leading-none">{card.got.toLocaleString("en-IN")}</p>
            <div className="mt-1 flex items-center justify-between text-[11px] text-white/50">
              <span>of {card.target.toLocaleString("en-IN")}</span>
              <span className={card.tone}>{card.note}</span>
            </div>
          </div>
        ))}
        <div className="rounded-2xl border border-white/10 bg-[#14182b] p-3">
          <p className="text-[12px] font-semibold text-violet-300">↗ Engagement rate</p>
          <p className="text-[26px] font-bold leading-none">{(gotViews > 0 ? actualRate : 0).toFixed(2)}%</p>
          <p className="mt-1 text-[11px] text-white/50">{deliveredEngagement.toLocaleString("en-IN")} delivered now</p>
          <p className="text-[11px] text-white/40">Planned {plannedRate.toFixed(2)}% · {planned.toLocaleString("en-IN")} actions</p>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.45fr_0.7fr]">
        <div className="rounded-2xl border border-white/10 bg-[#101426] p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px] font-bold">Views & engagement over time</p>
            <div className="flex rounded-full bg-[#0c1020] p-0.5 text-[11px] font-semibold">
              <button type="button" onClick={() => setMode("batch")} className={`rounded-full px-3 py-1 ${mode === "batch" ? "bg-violet-600 text-white" : "text-white/60"}`}>Per batch</button>
              <button type="button" onClick={() => setMode("total")} className={`rounded-full px-3 py-1 ${mode === "total" ? "bg-violet-600 text-white" : "text-white/60"}`}>Running total</button>
            </div>
          </div>
          <div className="mb-1 flex gap-3 text-[11px] text-white/60">
            <span className="text-violet-300">● Views</span>
            <span className="text-sky-300">● Likes</span>
            <span className="text-cyan-300">● Shares</span>
            <span className="text-pink-300">● Saves</span>
          </div>
          {sorted.length === 0 ? <p className="py-16 text-center text-[12px] text-white/50">No delivery batches available yet.</p> : (
            <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
              {yTicks.map((tick) => <g key={tick.label}><line x1={pad.l} x2={width - pad.r} y1={tick.y} y2={tick.y} stroke="#1e293b" /><text x={2} y={tick.y + 3} fill="#94a3b8" fontSize="10">{tick.label}</text></g>)}
              <path d={area} fill="#c084fc" opacity="0.16" />
              {chartKeys.filter((key) => (key === "views" ? views : key === "likes" ? likes : key === "shares" ? shares : saves) > 0).map((key) => (
                <path key={key} d={linePath(shownLine[key] ?? [])} fill="none" stroke={chartColor[key]} strokeWidth={key === "views" ? 2.8 : 2.2} strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {xTicks.map((tick) => <text key={tick.label} x={tick.x} y={height - 8} textAnchor="middle" fill="#94a3b8" fontSize="10">{tick.label}</text>)}
            </svg>
          )}
          <div className="mt-2 rounded-2xl border border-white/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[14px] font-bold">Bot score {bot.score}/100</p>
              <span className="rounded-full border border-white/20 px-2 py-0.5 text-[11px]">{bot.band} · {bot.name}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-2 rounded-full" style={{ width: `${bot.score}%`, background: botBar }} />
            </div>
            <p className="mt-2 text-[12px] font-semibold">{bot.action}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-[#14182b] p-3">
            <p className="text-[13px] font-bold">Engagement mix</p>
            <div className="mt-2 flex items-center gap-3">
              <svg viewBox="0 0 100 100" className="size-24">
                <circle cx="50" cy="50" r="28" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
                {mixTotal > 0 && mix.map((item) => {
                  const len = (item.value / mixTotal) * ring;
                  const node = <circle key={item.label} cx="50" cy="50" r="28" fill="none" stroke={item.color} strokeWidth="12" strokeDasharray={`${len} ${ring - len}`} strokeDashoffset={-ringAt} transform="rotate(-90 50 50)" />;
                  ringAt += len;
                  return node;
                })}
                <text x="50" y="48" textAnchor="middle" fill="white" fontSize="12" fontWeight="700">{(gotViews > 0 ? actualRate : 0).toFixed(2)}%</text>
                <text x="50" y="60" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="7">OF VIEWS</text>
              </svg>
              <div className="text-[12px]">
                {mix.map((item) => <p key={item.label} className="flex justify-between gap-3"><span style={{ color: item.color }}>{item.label}</span><b>{item.value.toLocaleString("en-IN")}</b></p>)}
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#14182b] p-3">
            <p className="text-[13px] font-bold">Daily breakdown</p>
            <div className="mt-2 space-y-2">
              {dayRows.slice(0, 4).map(([day, row], index) => (
                <div key={day}>
                  <div className="flex justify-between text-[12px]"><span>Day {index + 1} · {day}</span><span>{row.views.toLocaleString("en-IN")}</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-violet-500 to-pink-400" style={{ width: `${views ? Math.min(100, (row.views / views) * 100) : 0}%` }} /></div>
                </div>
              ))}
              {dayRows.length === 0 && <p className="text-[12px] text-white/50">No delivery batches available yet.</p>}
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-[#101426] p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[14px] font-bold">Batch schedule</p>
          <div className="flex rounded-full bg-[#0c1020] p-0.5 text-[11px] font-semibold">
            <button type="button" onClick={() => setSchedule("batch")} className={`rounded-full px-3 py-1 ${schedule === "batch" ? "bg-violet-600" : "text-white/60"}`}>By batch</button>
            <button type="button" onClick={() => setSchedule("day")} className={`rounded-full px-3 py-1 ${schedule === "day" ? "bg-violet-600" : "text-white/60"}`}>Daily summary</button>
          </div>
        </div>
        {schedule === "day" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {dayRows.map(([day, row], index) => (
              <div key={day} className="rounded-xl bg-violet-600/80 px-3 py-2 text-[12px]">
                <b>Day {index + 1}</b>
                <p>{day} · {row.views.toLocaleString("en-IN")} views · likes {row.likes.toLocaleString("en-IN")} · shares {row.shares.toLocaleString("en-IN")} · saves {row.saves.toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {sorted.slice(0, shown).map((drop, index) => (
              <div key={drop.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-[12px]">
                <span><b className="text-violet-300">#{index + 1}</b> {drop.status} · {new Date(drop.place_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · +{drop.quantity.toLocaleString("en-IN")} {drop.engagement_type}</span>
                <span className="truncate text-white/50">{drop.service_label || "scheduled"}</span>
              </div>
            ))}
            {shown < sorted.length && <button type="button" onClick={() => setShown((count) => count + 12)} className="text-[12px] font-semibold text-violet-300">Load more</button>}
          </div>
        )}
      </div>
    </section>
  );
}

const TONE: Record<string, string> = {
  views: "text-sky-600 bg-sky-50",
  likes: "text-emerald-600 bg-emerald-50",
  saves: "text-amber-600 bg-amber-50",
  shares: "text-blue-600 bg-blue-50",
  reposts: "text-violet-600 bg-violet-50",
};

function DetailPage() {
  const { id } = Route.useParams();
  return <Authed><Detail id={id} /></Authed>;
}

function Detail({ id }: { id: string }) {
  const [order, setOrder] = useState<OrderRow | null | undefined>(undefined);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [error, setError] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [edit, setEdit] = useState<Drop | null>(null);
  const [qty, setQty] = useState("");
  const [when, setWhen] = useState("");
  const [checked, setChecked] = useState("");

  function load() {
    const stamp = Date.now();
    fetch(`/api/drops/${id}?t=${stamp}`, { cache: "no-store", headers: { "cache-control": "no-cache" } })
      .then((res) => {
        if (!res.ok) throw new Error(`drops ${res.status}`);
        return res.json();
      })
      .then((data: { drops: Drop[]; status?: string }) => {
        setDrops(data.drops || []);
        if (data.status) setOrder((current) => (current ? { ...current, status: data.status as OrderRow["status"] } : current));
        setError("");
      })
      .catch(() => {
        listOrderDrops({ data: { id, t: stamp } }).then(setDrops).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load runs."));
      });
    getOrder({ data: { id, t: stamp } }).then(setOrder).catch(() => undefined);
    setChecked(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 3000);
    return () => window.clearInterval(timer);
  }, [id]);

  const sorted = useMemo(() => [...drops].sort((a, b) => a.place_at.localeCompare(b.place_at)), [drops]);
  if (order === undefined) return <p className="text-[#64748b]">Loading order…</p>;
  if (!order) return <p className="text-rose-600">{error || "Order not found."}</p>;

  const delivered = drops.reduce((sum, drop) => sum + sentOf(drop), 0);
  const total = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const placed = drops.filter((drop) => drop.status === "placed").length;
  const pending = drops.filter((drop) => drop.status === "waiting" || drop.status === "paused").length;
  const active = drops.filter((drop) => drop.status === "placing").length;
  const next = sorted.find((drop) => drop.status === "waiting" || drop.status === "placing");
  const pct = total ? Math.round((delivered / total) * 100) : 0;
  const running = new Map<string, number>();
  const editIndex = edit ? sorted.findIndex((drop) => drop.id === edit.id) + 1 : 0;

  function openEdit(drop: Drop) {
    setEdit(drop);
    setQty(String(drop.quantity));
    setWhen(toLocal(drop.place_at));
    setError("");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-16">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/engagement-orders" className="text-[18px] text-[#64748b]">←</Link>
            <h1 className="text-[22px] font-bold">Order #{order.order_number.replace("MAG-", "")}</h1>
            <span className="rounded-full bg-[#111827] px-2 py-0.5 text-[10px] font-bold text-white">{order.status}</span>
            {order.organic && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Organic</span>}
            <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 text-[10px] font-bold text-[#2563eb]">LIVE TRACKING</span>
          </div>
          <a href={order.link} target="_blank" rel="noreferrer" className="mt-1 block max-w-lg truncate text-[12px] text-[#64748b]">{order.link}</a>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-[#94a3b8]">Auto-updating</p>
          <p className="text-[11px] text-[#94a3b8]">Last: {checked}</p>
          <button type="button" onClick={load} className="mt-1 rounded-full border bg-white px-3 py-1.5 text-[12px] font-semibold">Refresh</button>
          {order.status !== "cancelled" && order.status !== "complete" && (
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setOrderFlow({ data: { orderId: order.id, status: order.status === "paused" ? "waiting" : "paused" } }).then(load)} className="rounded-full bg-[#5b4dff] px-3 py-1.5 text-[12px] font-semibold text-white">{order.status === "paused" ? "Resume" : "Pause"}</button>
              <button type="button" onClick={() => setOrderFlow({ data: { orderId: order.id, status: "cancelled" } }).then(load)} className="rounded-full bg-rose-500 px-3 py-1.5 text-[12px] font-semibold text-white">Cancel</button>
            </div>
          )}
        </div>
      </div>

      <OrganicBoard order={order} drops={drops} />

      <section className="rounded-[24px] border border-[#e7eef6] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Live order menu</h2>
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Auto-updating</span>
        </div>
        <div className="space-y-3">
          {order.items.map((item) => {
            const mine = drops.filter((drop) => drop.engagement_type === item.engagement_type).sort((a, b) => a.place_at.localeCompare(b.place_at));
            const sent = mine.reduce((sum, drop) => sum + sentOf(drop), 0);
            const placedQty = mine.filter((drop) => drop.status === "placed").reduce((sum, drop) => sum + drop.quantity, 0);
            const doneRuns = mine.filter((drop) => drop.status === "placed").length;
            const leftRuns = mine.filter((drop) => drop.status === "waiting" || drop.status === "paused" || drop.status === "placing").length;
            const nextRun = mine.find((drop) => drop.status === "waiting" || drop.status === "placing");
            const last = mine[mine.length - 1];
            return (
              <article key={item.id} className={`rounded-2xl p-3 ${TONE[item.engagement_type] || "bg-[#f8fafc]"}`}>
                <div className="flex items-center justify-between">
                  <b className="capitalize">{item.engagement_type}</b>
                  <span className="text-[12px] font-semibold">{sent.toLocaleString("en-IN")} deliver / {item.quantity.toLocaleString("en-IN")} · {placedQty.toLocaleString("en-IN")} placed</span>
                </div>
                <p className="mt-1 text-[12px] text-[#334155]">
                  {doneRuns} run placed · {leftRuns} runs left · {Math.max(0, item.quantity - sent).toLocaleString("en-IN")} left to deliver
                </p>
                <p className="text-[12px] text-[#334155]">
                  {nextRun ? `Next ${clock(nextRun.place_at)} (${fromNow(nextRun.place_at)})` : "No pending run"}
                  {last ? ` · last ${clock(last.place_at)}` : ""}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-[24px] border border-[#e7eef6] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[12px] font-bold tracking-widest text-[#334155]">LIVE TRACKING</p>
          <p className="rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-700">{next ? `Next: ${fromNow(next.place_at)}` : "No pending run"}</p>
        </div>
        <div className="grid grid-cols-5 text-center">
          <Count n={drops.length} label="Total runs" />
          <Count n={placed} label="Placed" />
          <Count n={active} label="In progress" />
          <Count n={pending} label="Pending" />
          <Count n={delivered} label="Delivered" />
        </div>
        <div className="mt-4 flex justify-between text-[13px]"><span>Overall progress</span><b>{delivered.toLocaleString("en-IN")} / {total.toLocaleString("en-IN")}</b></div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#eef3f8]"><div className="h-full bg-[#93c5fd]" style={{ width: `${pct}%` }} /></div>
        <div className="mt-1 flex justify-between text-[12px] text-[#94a3b8]"><span>{placed} of {drops.length} runs sent</span><span>{pct}% done</span></div>
      </section>

      <section className="rounded-[24px] border border-[#e7eef6] bg-white p-4">
        <h2 className="mb-3 text-[15px] font-semibold">Delivery counters</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {order.items.map((item) => {
            const done = drops.filter((drop) => drop.engagement_type === item.engagement_type).reduce((sum, drop) => sum + sentOf(drop), 0);
            return (
              <div key={item.id} className="rounded-2xl border border-[#eef2f6] p-3">
                <div className="flex justify-between"><b className="capitalize">{item.engagement_type}</b><span className="text-[12px] text-[#64748b]">{item.quantity ? Math.round((done / item.quantity) * 100) : 0}%</span></div>
                <Line k="Target" v={item.quantity} />
                <Line k="Delivered" v={done} />
                <Line k="Remaining" v={Math.max(0, item.quantity - done)} />
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[24px] border border-[#e7eef6] bg-white p-4">
        <h2 className="mb-3 font-semibold">Live engagement stats</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {order.items.map((item) => {
            const mine = drops.filter((drop) => drop.engagement_type === item.engagement_type);
            const done = mine.reduce((sum, drop) => sum + sentOf(drop), 0);
            const paused = mine.some((drop) => drop.status === "paused");
            return (
              <article key={item.id} className={`rounded-2xl p-3 ${TONE[item.engagement_type] || "bg-[#f8fafc]"}`}>
                <p className="text-[11px] font-bold uppercase">{item.engagement_type}</p>
                <p className="text-[22px] font-bold text-[#0f172a]">{done.toLocaleString("en-IN")} <span className="text-[13px] font-medium text-[#64748b]">/ {item.quantity.toLocaleString("en-IN")}</span></p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80"><div className="h-full bg-[#60a5fa]" style={{ width: `${item.quantity ? Math.min(100, (done / item.quantity) * 100) : 0}%` }} /></div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setRunState({ data: { orderId: order.id, type: item.engagement_type, status: paused ? "waiting" : "paused" } }).then(load)} className="h-8 flex-1 rounded-lg bg-white text-[12px] font-semibold">{paused ? "Resume" : "Pause"}</button>
                  <button type="button" disabled={item.status === "cancelled"} onClick={() => setRunState({ data: { orderId: order.id, type: item.engagement_type, status: "cancelled" } }).then(load).catch((err: unknown) => setError(err instanceof Error ? err.message : "Cancel failed."))} className="h-8 flex-1 rounded-lg bg-[#2563eb] text-[12px] font-semibold text-white disabled:bg-[#cbd5e1]">{item.status === "cancelled" ? "Cancelled" : "Cancel"}</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-[24px] border border-[#e7eef6] bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Run schedule <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[11px] font-medium text-[#64748b]">{drops.length} total runs</span></h2>
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[12px] text-emerald-700">{placed} sent</span>
        </div>
        <p className="mb-3 text-[13px] font-semibold">Organic delivery timeline</p>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {order.items.map((item) => {
            const done = drops.filter((drop) => drop.engagement_type === item.engagement_type).reduce((sum, drop) => sum + sentOf(drop), 0);
            return <div key={item.id} className="rounded-2xl bg-[#fff8eb] px-2 py-3 text-center text-[12px]"><b>{done.toLocaleString("en-IN")}/{item.quantity.toLocaleString("en-IN")}</b><p className="uppercase text-[#94a3b8]">{item.engagement_type}</p></div>;
          })}
        </div>
        <div className="space-y-3">
          {sorted.map((drop, index) => {
            running.set(drop.engagement_type, (running.get(drop.engagement_type) ?? 0) + (drop.status === "cancelled" ? 0 : drop.quantity));
            const hot = drop.status === "placing" || drop.status === "placed";
            return (
              <article key={drop.id} className={`rounded-2xl border p-3 ${hot ? "border-amber-200 bg-amber-50/50" : "border-[#eef2f6] bg-[#f8fbff]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`grid size-8 place-items-center rounded-full text-[12px] font-bold text-white ${hot ? "bg-amber-500" : "bg-[#1d4ed8]"}`}>#{index + 1}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold">{label(drop.status)}</span>
                      <span className="text-[13px] font-bold text-amber-600">+{drop.quantity.toLocaleString("en-IN")} {drop.engagement_type}</span>
                    </div>
                    <p className="mt-1 truncate text-[12px] text-[#2563eb]">via {drop.service_label || "provider service"}</p>
                    <p className="text-[12px] text-[#64748b]">{drop.status === "placed" ? "Run is placed" : clock(drop.place_at)} {drop.status === "waiting" ? `· Next in ${fromNow(drop.place_at)}` : ""}</p>
                    {drop.status === "placed" && <p className="text-[12px] font-semibold text-emerald-700">{drop.sent == null ? "Count pending" : `${drop.sent.toLocaleString("en-IN")}/${drop.quantity.toLocaleString("en-IN")} ${drop.count_source === "video" ? "on the video" : "provider delivered"}`} · {drop.remains == null ? "remains pending" : `${drop.remains.toLocaleString("en-IN")} left`}{drop.live_status ? ` · ${drop.live_status}` : ""}{typeof drop.video_now === "number" ? ` · video now ${drop.video_now.toLocaleString("en-IN")}` : ""}</p>}
                    {drop.provider_order_id && <p className="text-[12px]">Order #{drop.provider_order_id}</p>}
                    {drop.error && <p className="text-[12px] text-rose-600">{drop.error}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold tracking-wide text-[#94a3b8]">PROVIDER</p>
                    <p className="max-w-40 truncate text-[12px] font-semibold text-[#2563eb]">{drop.service_label || "Pending"}</p>
                    {(drop.status === "waiting" || drop.status === "paused") && <button type="button" onClick={() => openEdit(drop)} className="mt-2 text-[12px] font-semibold text-[#2563eb]">Edit</button>}
                    {drop.status !== "cancelled" && <button type="button" onClick={() => setRunState({ data: { id: drop.id, status: "cancelled" } }).then(load).catch((err: unknown) => setError(err instanceof Error ? err.message : "Cancel failed."))} className="mt-1 block text-[12px] font-semibold text-rose-600">Cancel run</button>}
                    {drop.provider_order_id && <button type="button" onClick={() => checkDropStatus({ data: drop.id }).then((row) => setStatusNote(`#${drop.provider_order_id}: ${row.status}${row.remains ? `, remains ${row.remains}` : ""}`)).catch((err: unknown) => setError(err instanceof Error ? err.message : "Status failed."))} className="mt-1 block text-[12px] font-semibold text-[#0f766e]">Check now</button>}
                  </div>
                </div>
                <p className="mt-3 text-[11px] font-semibold text-[#64748b]">SCHEDULED BY THIS RUN</p>
                <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="rounded-xl bg-[#fff8eb] px-2 py-2 text-center text-[11px]">
                      <b>{Math.min(item.quantity, running.get(item.engagement_type) ?? 0).toLocaleString("en-IN")}/{item.quantity.toLocaleString("en-IN")}</b>
                      <p className="uppercase text-[#94a3b8]">{item.engagement_type} scheduled</p>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <h2 className="text-[16px] font-semibold">Per-service history</h2>
      {order.items.map((item) => {
        const mine = drops.filter((drop) => drop.engagement_type === item.engagement_type).sort((a, b) => a.place_at.localeCompare(b.place_at));
        const done = mine.reduce((sum, drop) => sum + sentOf(drop), 0);
        const waiting = mine.filter((drop) => drop.status === "waiting" || drop.status === "paused");
        const shown = open[item.engagement_type] !== false;
        const nextRun = waiting[0];
        return (
          <section key={item.id} className="rounded-[24px] border border-[#e7eef6] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold capitalize">{item.service_name || item.engagement_type}</p>
                <p className="truncate text-[12px] text-[#64748b]">{order.link}</p>
              </div>
              <div className="flex items-center gap-2">
                <b>{item.quantity.toLocaleString("en-IN")}</b>
                <button type="button" onClick={() => setRunState({ data: { orderId: order.id, type: item.engagement_type, status: waiting.some((drop) => drop.status === "paused") ? "waiting" : "paused" } }).then(load)} className="rounded-full border px-3 py-1 text-[12px] font-semibold">Pause</button>
                <button type="button" onClick={() => setRunState({ data: { orderId: order.id, type: item.engagement_type, status: "cancelled" } }).then(load)} className="grid size-8 place-items-center rounded-full border text-rose-500">×</button>
                <span className="rounded-full bg-[#eef4ff] px-2 py-1 text-[10px] font-bold text-[#2563eb]">{mine.length === 0 ? "NO RUNS" : waiting.length ? "PENDING" : "DONE"}</span>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[12px] font-bold tracking-wide text-emerald-600">LIVE DELIVERY TRACKING</p>
              <p className="text-[12px] text-emerald-700">{nextRun ? `Next: ${fromNow(nextRun.place_at)}` : "No pending run"}</p>
            </div>
            <div className="mt-2 grid grid-cols-5 border-y border-[#eef2f6] py-3 text-center">
              <Count n={mine.length} label="Total runs" />
              <Count n={mine.filter((drop) => drop.status === "placed").length} label="Placed" />
              <Count n={mine.filter((drop) => drop.status === "placing").length} label="Processing" />
              <Count n={waiting.length} label="Pending" />
              <Count n={done} label="Delivered" />
            </div>
            {shown && (
              <ul className="divide-y divide-[#eef2f6]">
                {mine.map((drop, index) => {
                  const sum = mine.slice(0, index + 1).filter((row) => row.status !== "cancelled").reduce((totalQty, row) => totalQty + row.quantity, 0);
                  return (
                    <li key={drop.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex items-start gap-3">
                        <span className="grid size-8 place-items-center rounded-full bg-[#1d4ed8] text-[12px] font-bold text-white">#{index + 1}</span>
                        <div>
                          <p className="text-[13px]"><span className="rounded-full bg-[#eef4ff] px-2 py-0.5 text-[11px] font-semibold text-[#2563eb]">{label(drop.status)}</span> <b className="text-emerald-600">+{drop.quantity} {item.engagement_type}</b> <span className="text-[#64748b]">Scheduled: {Math.min(item.quantity, sum)} / {item.quantity}</span></p>
                          <p className="text-[12px] text-[#64748b]">{drop.status === "placed" ? `Run is placed · ${drop.pct == null ? "live % pending" : `${drop.pct}% deliver`} · ${drop.remains == null ? "remains pending" : `${drop.remains} left`}` : clock(drop.place_at)} {drop.status === "waiting" ? `(in ${fromNow(drop.place_at)})` : ""}</p>
                        </div>
                      </div>
                      {(drop.status === "waiting" || drop.status === "paused") && <button type="button" onClick={() => openEdit(drop)} className="rounded-full border px-3 py-1 text-[12px] font-semibold">Edit</button>}
                      {drop.status !== "cancelled" && <button type="button" onClick={() => setRunState({ data: { id: drop.id, status: "cancelled" } }).then(load).catch((err: unknown) => setError(err instanceof Error ? err.message : "Cancel failed."))} className="rounded-full border border-rose-200 px-3 py-1 text-[12px] font-semibold text-rose-600">Cancel</button>}
                    </li>
                  );
                })}
              </ul>
            )}
            <button type="button" onClick={() => setOpen((current) => ({ ...current, [item.engagement_type]: !shown }))} className="mt-2 w-full text-center text-[12px] font-semibold text-[#64748b]">{shown ? "Hide schedule" : "Show schedule"}</button>
          </section>
        );
      })}

      <section className="rounded-[24px] border border-[#e7eef6] bg-white p-4">
        <h2 className="mb-3 font-semibold">Order details</h2>
        <div className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
          <div><p className="text-[#94a3b8]">Created</p><b>{new Date(order.created_at).toLocaleString("en-IN", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</b></div>
          <div><p className="text-[#94a3b8]">Total price</p><b>{inr(order.total_paise)}</b></div>
          <div><p className="text-[#94a3b8]">Variance</p><b>±{order.variance_percent}%</b></div>
          <div><p className="text-[#94a3b8]">Peak hours</p><b>{order.organic ? "Enabled" : "Off"}</b></div>
        </div>
      </section>
      {statusNote && <p className="rounded-xl bg-[#ecfeff] px-3 py-2 text-[13px]">{statusNote}</p>}
      {error && <p className="text-[13px] text-rose-600">{error}</p>}

      {edit && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4">
          <form
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await editScheduledDrop({ data: { id: edit.id, quantity: Number(qty), placeAt: new Date(when).toISOString() } });
                setEdit(null);
                load();
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Could not save this run.");
              }
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-[18px] font-bold">Edit scheduled run</h2>
                <p className="text-[12px] text-[#64748b]">Modify the quantity or scheduled time for this pending run</p>
              </div>
              <button type="button" onClick={() => setEdit(null)} className="text-[#94a3b8]">×</button>
            </div>
            <p className="mt-3 inline-flex gap-2 rounded-full bg-[#f8fafc] px-3 py-1 text-[12px] capitalize"><span>{edit.engagement_type}</span><span>Run #{editIndex}</span></p>
            <label className="mt-3 block text-[13px] font-semibold">Quantity to deliver
              <input value={qty} onChange={(event) => setQty(event.target.value.replace(/[^\d]/g, ""))} className="mt-1 h-11 w-full rounded-xl border border-[#bfdbfe] bg-[#f8fbff] px-3" />
            </label>
            <p className="mt-1 text-[12px] text-[#94a3b8]">Original: {edit.quantity}</p>
            <p className="mt-3 text-[13px] font-semibold">Scheduled time</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 3, 6, 12, 24].map((hours) => (
                <button key={hours} type="button" onClick={() => setWhen(toLocal(new Date(Date.now() + hours * 3600_000).toISOString()))} className="rounded-full border px-3 py-1 text-[12px] font-semibold">+{hours}h</button>
              ))}
            </div>
            <input type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} className="mt-3 h-11 w-full rounded-xl border px-3" />
            <p className="mt-1 text-[12px] text-[#94a3b8]">Original: {clock(edit.place_at)}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEdit(null)} className="h-10 rounded-xl border px-4 text-[13px]">Cancel</button>
              <button className="h-10 rounded-xl bg-[#2563eb] px-4 text-[13px] font-bold text-white">Save changes</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Count({ n, label }: { n: number; label: string }) {
  return <div><p className="text-[20px] font-bold">{n.toLocaleString("en-IN")}</p><p className="text-[10px] uppercase tracking-wide text-[#94a3b8]">{label}</p></div>;
}

function Line({ k, v }: { k: string; v: number }) {
  return <p className="mt-1 flex justify-between text-[13px]"><span className="text-[#64748b]">{k}</span><b>{v.toLocaleString("en-IN")}</b></p>;
}

function label(status: string) {
  if (status === "placed") return "Placed";
  if (status === "placing") return "Placing";
  if (status === "paused") return "Paused";
  if (status === "cancelled") return "Cancelled";
  if (status === "failed") return "Failed";
  return "Scheduled";
}

function fromNow(iso: string) {
  const min = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (min <= 1) return "less than a minute";
  if (min < 60) return `${min} minutes`;
  const hours = Math.round(min / 60);
  return hours === 1 ? "about 1 hour" : `about ${hours} hours`;
}

function clock(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function toLocal(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
