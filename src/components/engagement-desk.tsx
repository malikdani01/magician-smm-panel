import { useRef, useState } from "react";
import {
  Bookmark,
  Clock,
  Eye,
  Heart,
  MessageCircle,
  Pencil,
  Repeat2,
  Share2,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { BundleItem } from "@/lib/panel.functions";
import { inr } from "@/lib/money";

export type Pace = {
  gapMin: number;
  variance: number;
  peak: boolean;
  night: boolean;
};

const LOOK: Record<string, { label: string; icon: LucideIcon; ink: string; dot: string; gap: number }> = {
  views: { label: "Views", icon: Eye, ink: "#2563eb", dot: "#3b82f6", gap: 105 },
  likes: { label: "Likes", icon: Heart, ink: "#e11d48", dot: "#22c55e", gap: 200 },
  shares: { label: "Shares", icon: Share2, ink: "#0284c7", dot: "#38bdf8", gap: 83 },
  reposts: { label: "Reposts", icon: Repeat2, ink: "#0f766e", dot: "#14b8a6", gap: 85 },
  saves: { label: "Saves", icon: Bookmark, ink: "#ea580c", dot: "#eab308", gap: 480 },
  comments: { label: "Comments", icon: MessageCircle, ink: "#0f766e", dot: "#14b8a6", gap: 90 },
  subscribers: { label: "Subscribers", icon: UserPlus, ink: "#7c3aed", dot: "#a855f7", gap: 120 },
};

export function lookFor(type: string) {
  return (
    LOOK[type] ?? {
      label: type,
      icon: Sparkles,
      ink: "#2563eb",
      dot: "#3b82f6",
      gap: 90,
    }
  );
}

export function defaultPace(type: string): Pace {
  return { gapMin: lookFor(type).gap, variance: 20, peak: true, night: true };
}

export function runCount(quantity: number) {
  return Math.max(1, Math.min(80, Math.round(Math.sqrt(Math.max(quantity, 1)) * 0.5)));
}

export function durationLabel(quantity: number, gapMin: number) {
  const runs = runCount(quantity);
  const mins = Math.max(gapMin, (runs - 1) * gapMin);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return { runs, text: h > 0 ? `~${h}H ${m}M` : `~${m}M` };
}

function Switch({
  on,
  disabled,
  label,
  soft,
  onClick,
}: {
  on: boolean;
  disabled?: boolean;
  label: string;
  soft?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? (soft ? "bg-[#d5e4f2]" : "bg-[#3b82f6]") : "bg-[#e8eef6]"}`}
    >
      <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition ${on ? "left-5" : "left-0.5"}`} />
    </button>
  );
}

export function EngagementBreakdown({
  items,
  enabled,
  quantityOf,
  priceOf,
  pace,
  onToggle,
  onQuantity,
  onPace,
}: {
  items: BundleItem[];
  enabled: string[];
  quantityOf: (item: BundleItem) => number;
  priceOf: (item: BundleItem, quantity: number) => number;
  pace: Record<string, Pace>;
  onToggle: (type: string) => void;
  onQuantity: (type: string, quantity: number) => void;
  onPace: (type: string, next: Pace) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const active = items.filter((item) => item.is_base || enabled.includes(item.engagement_type)).length;

  return (
    <section>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#0f172a]">Engagement Breakdown</h2>
          <p className="mt-0.5 text-sm text-slate-500">Customize organic settings per type</p>
        </div>
        <span className="rounded-full bg-[#0f172a] px-3 py-1.5 text-xs font-semibold text-white">{active} active</span>
      </div>
      <div className="space-y-3">
        {items.map((item) => {
          const on = item.is_base || enabled.includes(item.engagement_type);
          const look = lookFor(item.engagement_type);
          const Icon = look.icon;
          const qty = quantityOf(item);
          const price = priceOf(item, qty);
          const rowPace = pace[item.engagement_type] ?? defaultPace(item.engagement_type);
          const timing = durationLabel(qty, rowPace.gapMin);
          const expanded = open === item.engagement_type;
          return (
            <article
              key={item.id}
              className={`rounded-2xl border border-[#e6eef8] bg-white shadow-[0_8px_24px_rgba(20,50,90,0.04)] ${on ? "" : "opacity-60"}`}
            >
              <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon className="size-4 text-slate-400" strokeWidth={1.75} />
                    <span
                      className="grid size-5 place-items-center rounded-md text-[11px]"
                      style={{ background: `${look.dot}22`, color: look.ink }}
                    >
                      <Icon className="size-3.5" strokeWidth={2.4} />
                    </span>
                    <span className="text-[15px] font-extrabold" style={{ color: look.ink }}>
                      {look.label}
                    </span>
                    {item.is_base && (
                      <span className="rounded-md bg-[#2563eb] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
                        BASE
                      </span>
                    )}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-[#334155]">
                    <Sparkles className="size-3 text-sky-500" />
                    {timing.runs} RUNS
                    <span className="font-medium text-slate-300">·</span>
                    {timing.text}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Min: {item.min_quantity.toLocaleString("en-IN")} · Max: {item.max_quantity.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <input
                    aria-label={`${look.label} quantity`}
                    inputMode="numeric"
                    disabled={!on}
                    value={qty}
                    onChange={(event) => {
                      const next = Number(event.target.value.replace(/\D/g, ""));
                      if (!Number.isFinite(next)) return;
                      onQuantity(item.engagement_type, next);
                    }}
                    className="h-10 w-24 rounded-full border border-transparent bg-[#f3f7fb] text-center text-sm font-semibold text-slate-800 outline-none focus:border-[#93c5fd]"
                  />
                  <span className="inline-flex h-10 min-w-20 items-center justify-center rounded-full bg-[#f8fafc] px-3 text-sm font-semibold text-slate-700">
                    {inr(price)}
                  </span>
                  <Switch
                    on={on}
                    disabled={item.is_base}
                    label={`${look.label} ${on ? "on" : "off"}`}
                    onClick={() => onToggle(item.engagement_type)}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : item.engagement_type)}
                className="flex w-full items-center justify-center gap-2 border-t border-[#eef3f8] py-2.5 text-[11px] font-semibold tracking-[0.16em] text-slate-400"
              >
                <Clock className="size-3.5" />
                SETTINGS
                <span className={`transition ${expanded ? "rotate-180" : ""}`}>▾</span>
              </button>
              {expanded && (
                <div className="grid gap-4 border-t border-[#eef3f8] px-5 py-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-500">
                    Gap between runs · {rowPace.gapMin} min
                    <input
                      type="range"
                      min={15}
                      max={480}
                      value={rowPace.gapMin}
                      onChange={(event) => onPace(item.engagement_type, { ...rowPace, gapMin: Number(event.target.value) })}
                      className="mt-2 w-full accent-[#2563eb]"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-500">
                    Variance · {rowPace.variance}%
                    <input
                      type="range"
                      min={0}
                      max={50}
                      value={rowPace.variance}
                      onChange={(event) => onPace(item.engagement_type, { ...rowPace, variance: Number(event.target.value) })}
                      className="mt-2 w-full accent-[#2563eb]"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-xl bg-[#f8fafc] px-3 py-2 text-sm font-semibold text-slate-700">
                    Peak hours 6–10 PM
                    <Switch
                      on={rowPace.peak}
                      label="Peak hours"
                      onClick={() => onPace(item.engagement_type, { ...rowPace, peak: !rowPace.peak })}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-xl bg-[#f8fafc] px-3 py-2 text-sm font-semibold text-slate-700">
                    Night slowdown
                    <Switch
                      on={rowPace.night}
                      label="Night slowdown"
                      onClick={() => onPace(item.engagement_type, { ...rowPace, night: !rowPace.night })}
                    />
                  </label>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function GrowthCurve({
  series,
}: {
  series: { type: string; quantity: number }[];
}) {
  const [viewOnly, setViewOnly] = useState(true);
  const [points, setPoints] = useState([0.08, 0.16, 0.38, 0.66, 0.86, 1]);
  const [preview, setPreview] = useState(false);
  const drag = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  function move(clientY: number) {
    const svg = svgRef.current;
    const index = drag.current;
    if (!svg || index == null) return;
    const rect = svg.getBoundingClientRect();
    const y = 1 - (clientY - rect.top) / rect.height;
    const next = Math.min(1, Math.max(0.02, y));
    setPoints((current) => current.map((value, i) => (i === index ? next : value)));
  }

  const poly = points
    .map((y, i) => {
      const x = (i / (points.length - 1)) * 600;
      const py = 16 + (1 - y) * 188;
      return `${x},${py}`;
    })
    .join(" ");

  return (
    <section className="rounded-2xl border border-[#e6eef8] bg-white p-4 shadow-[0_8px_24px_rgba(20,50,90,0.04)] sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#0f172a]">
          <Pencil className="size-4" />
          Draw Your Growth Curve
        </h2>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          View Only
          <Switch on={viewOnly} soft label="View only" onClick={() => setViewOnly((value) => !value)} />
        </label>
      </div>
      <div className="relative overflow-hidden rounded-xl border border-[#e7f0f8] bg-[linear-gradient(180deg,#f8fbff,#f3f8fd)]">
        <svg
          ref={svgRef}
          viewBox="0 0 600 220"
          className="h-52 w-full touch-none"
          onPointerMove={(event) => {
            if (!viewOnly) move(event.clientY);
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerLeave={() => {
            drag.current = null;
          }}
        >
          <line x1="24" y1="200" x2="576" y2="28" stroke="#dbe7f3" strokeWidth="10" strokeLinecap="round" />
          {(!viewOnly) && (
            <>
              <polyline points={poly} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
              {points.map((y, i) => {
                const x = (i / (points.length - 1)) * 600;
                const py = 16 + (1 - y) * 188;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={py}
                    r="8"
                    fill="#fff"
                    stroke="#2563eb"
                    strokeWidth="3"
                    className="cursor-grab"
                    onPointerDown={(event) => {
                      drag.current = i;
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => move(event.clientY)}
                  />
                );
              })}
            </>
          )}
        </svg>
        {viewOnly && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-sm font-bold text-slate-800">Enable Draw Mode to customize curves</p>
              <p className="mt-0.5 text-xs text-slate-400">Drag points to shape your growth pattern</p>
            </div>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#eef3f8] pt-3 text-sm font-semibold text-slate-700">
        {series.map((row) => {
          const look = lookFor(row.type);
          const Icon = look.icon;
          return (
            <span key={row.type} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: look.dot }} />
              <Icon className="size-3.5" style={{ color: look.ink }} />
              {row.quantity.toLocaleString("en-IN")}
            </span>
          );
        })}
      </div>
      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={() => setPreview((value) => !value)}
          className="inline-flex items-center gap-2 rounded-full border border-[#e6eef8] bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm"
        >
          <Eye className="size-4" />
          {preview ? "Hide delivery preview" : "Show delivery preview"}
        </button>
      </div>
      {preview && (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[#e6eef8] bg-white p-4">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-2 font-semibold">Point</th>
                {series.map((row) => (
                  <th key={row.type} className="py-2 font-semibold">
                    {lookFor(row.type).label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((y, index) => (
                <tr key={index} className="border-t border-[#f1f5f9]">
                  <td className="py-2 text-slate-500">
                    {index === 0 ? "Start" : index === points.length - 1 ? "Done" : `${Math.round((index / (points.length - 1)) * 100)}%`}
                  </td>
                  {series.map((row) => (
                    <td key={row.type} className="py-2 font-semibold text-slate-800">
                      {Math.round(row.quantity * y).toLocaleString("en-IN")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-400">Preview only. The curve is not sent to a provider.</p>
        </div>
      )}
    </section>
  );
}
