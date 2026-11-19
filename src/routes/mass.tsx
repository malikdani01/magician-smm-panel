import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Bookmark, Calendar, Clock, Heart, Link2, Lock, MessageCircle, RefreshCw, Search, Settings2, Share2, Upload, Zap } from "lucide-react";
import { Authed } from "@/components/gate";
import {
  completeMassBatch,
  getCatalog,
  getWallet,
  listMassBatches,
  panelRates,
  engagementSections,
  submitMassBatch,
  type BundleRow,
  type MassBatchRow,
} from "@/lib/panel.functions";
import { inr } from "@/lib/money";
import { mixDrops, mixCurve, trimPct, REAL_BAND, autoRuns, windowHours, riskLabel, formatDuration, PROVIDER_MIN, DEFAULT_PACE, linkPace, type MixLine, type Pace } from "@/lib/organic";

export const Route = createFileRoute("/mass")({
  component: () => (
    <Authed>
      <Mass />
    </Authed>
  ),
});

type ExtraKey = "likes" | "comments" | "shares" | "saves" | "reposts";

type LinkRow = {
  link: string;
  views: string;
  viewsManual?: boolean;
  viewPace: Pace;
  extras: Record<ExtraKey, { on: boolean; qty: string; pace: Pace; qtyManual?: boolean }>;
};

function freshPace(): Pace {
  return { ...DEFAULT_PACE, variance: 25 };
}

const FRAMES = [
  { id: "6 hours", label: "6 hours", hours: 6 },
  { id: "12 hours", label: "12 hours", hours: 12 },
  { id: "Under 24 hours", label: "Under 24 hours", hours: 24 },
  { id: "1-3 days", label: "1-3 days", hours: 72 },
  { id: "7-14 days", label: "7-14 days", hours: 14 * 24 },
  { id: "Custom time", label: "Custom time", hours: 0 },
  { id: "Custom date", label: "Custom date", hours: 0 },
] as const;

const EXTRA_META: { key: ExtraKey; label: string; icon: typeof Heart }[] = [
  { key: "likes", label: "Likes", icon: Heart },
  { key: "comments", label: "Comments", icon: MessageCircle },
  { key: "shares", label: "Shares", icon: Share2 },
  { key: "saves", label: "Saves", icon: Bookmark },
  { key: "reposts", label: "Reposts", icon: RefreshCw },
];

const FLOORS: Record<string, number> = { views: 100, likes: 10, comments: 10, shares: 10, saves: 50, reposts: 10 };

function blankExtras(): LinkRow["extras"] {
  return {
    likes: { on: true, qty: "300", pace: freshPace() },
    comments: { on: true, qty: "10", pace: freshPace() },
    shares: { on: true, qty: "50", pace: freshPace() },
    saves: { on: true, qty: "80", pace: freshPace() },
    reposts: { on: true, qty: "80", pace: freshPace() },
  };
}

function applyPcts(extras: LinkRow["extras"], views: number, pcts: Record<string, number>) {
  const next = { ...extras };
  for (const item of EXTRA_META) {
    const qty = Math.max(0, Math.round((Math.max(0, views) * (pcts[item.key] ?? 0)) / 100));
    next[item.key] = { ...extras[item.key], qty: String(qty) };
  }
  return next;
}

function rollRow(
  link: string,
  viewBase: string,
  extraDefaults: LinkRow["extras"],
  preset: "light" | "recommended" | "viral" | "custom",
  mode: "percent" | "exact",
  pcts: Record<string, number>,
): LinkRow {
  const views = String(Math.max(0, Math.floor(Number(viewBase) || 0)));
  const source = mode === "exact" && preset === "custom" ? null : preset === "custom" ? pcts : mixCurve(preset, Math.max(Number(viewBase) || Number(views) || 100, 100));
  const extras = source ? applyPcts(extraDefaults, Math.floor(Number(views) || 0), source) : { ...extraDefaults };
  return {
    link,
    views,
    viewPace: freshPace(),
    extras,
  };
}

function parseLinks(text: string) {
  const found: string[] = [];
  for (const raw of text.split(/\n+/)) {
    const cell = raw.split(/[,;\t]/)[0]?.trim().replace(/^"|"$/g, "") ?? "";
    if (/^https?:\/\//i.test(cell) && !found.includes(cell)) found.push(cell);
  }
  return found;
}

function priceOf(bundle: BundleRow | undefined, views: number, extras: Record<string, number>, panel: Record<string, number>) {
  return ["views", ...Object.keys(extras)].reduce((sum, type) => {
    const qty = type === "views" ? views : extras[type];
    if (!qty) return sum;
    const set = panel[type];
    if (set > 0) return sum + Math.max(1, Math.round((qty / 1000) * set));
    const item = bundle?.items.find((row) => row.engagement_type === type || (type === "views" && row.is_base));
    if (!item) return sum;
    const rate = item.price_per_10k_paise || item.price_per_1k_paise * 10;
    return sum + Math.max(1, Math.round((qty * rate) / 10000));
  }, 0);
}

type RunDraft = { key: string; type: string; at: string; amount: string; on?: boolean };

function localStamp(date: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function servicePace(row: LinkRow, type: string): Pace {
  if (type === "views") return row.viewPace ?? freshPace();
  return row.extras[type as ExtraKey]?.pace ?? freshPace();
}

function runsForPace(pace: Pace, type: string, quantity: number) {
  if (pace.runsMode === "manual" && pace.runs >= 1) return Math.floor(pace.runs);
  return autoRuns(Math.max(quantity, 0), type);
}

function hoursForPace(pace: Pace, type: string, quantity: number, viewsQty: number, batchHours = 0) {
  const runs = runsForPace(pace, type, Math.max(quantity, 1));
  if (pace.window !== "auto") return windowHours(pace, runs, viewsQty);
  if (pace.intervalMode === "manual" && pace.intervalMinutes >= 1 && runs >= 1) {
    return Math.max(1 / 60, (runs * pace.intervalMinutes) / 60);
  }
  return Math.max(1, batchHours || windowHours(pace, 1, viewsQty));
}

function leadHours(index: number, count: number, hours: number) {
  if (count <= 1) return 0;
  return (index / (count - 1)) * Math.min(Math.max(hours, 1) * 0.12, 6);
}

function rowStamp(row: LinkRow, hours: number, lead: number, sectionKey = "", batchKey = "") {
  const extras = EXTRA_META.map((item) => {
    const extra = row.extras[item.key];
    const pace = extra.pace ?? freshPace();
    return `${item.key}:${extra.on ? 1 : 0}:${extra.qty}:${pace.window}:${pace.customHours}:${pace.runsMode}:${pace.runs}:${pace.intervalMode}:${pace.intervalMinutes}:${pace.variance}:${pace.peak ? 1 : 0}`;
  }).join(",");
  const viewPace = row.viewPace ?? freshPace();
  return `${viewPace.window}:${viewPace.customHours}:${viewPace.runsMode}:${viewPace.runs}:${viewPace.intervalMode}:${viewPace.intervalMinutes}:${viewPace.variance}:${viewPace.peak ? 1 : 0}|${row.views}|${hours}|${lead.toFixed(3)}|${extras}|${sectionKey}|${batchKey}`;
}

type BatchPace = { runsMode: "auto" | "manual"; runs: number; intervalMode: "auto" | "manual"; intervalMinutes: number };

function paceWithBatch(pace: Pace, batch: BatchPace): Pace {
  const runsManual = pace.runsMode === "manual" && pace.runs >= 1;
  const intervalManual = pace.intervalMode === "manual" && pace.intervalMinutes >= 1;
  return {
    ...pace,
    runsMode: runsManual ? "manual" : batch.runsMode,
    runs: runsManual ? pace.runs : batch.runsMode === "manual" ? batch.runs : 0,
    intervalMode: intervalManual ? "manual" : batch.intervalMode,
    intervalMinutes: intervalManual ? pace.intervalMinutes : batch.intervalMode === "manual" ? batch.intervalMinutes : 0,
  };
}

function rowWithBatch(row: LinkRow, batch: BatchPace): LinkRow {
  const extras = { ...row.extras };
  for (const item of EXTRA_META) {
    const extra = extras[item.key];
    extras[item.key] = { ...extra, pace: paceWithBatch(extra.pace ?? freshPace(), batch) };
  }
  return { ...row, viewPace: paceWithBatch(row.viewPace ?? freshPace(), batch), extras };
}

function buildDrafts(row: LinkRow, _hours: number, start: Date): RunDraft[] {
  const lines: MixLine[] = [];
  const viewQty = Math.floor(Number(row.views) || 0);
  if (viewQty > 0) {
    const pace = servicePace(row, "views");
    const runs = runsForPace(pace, "views", viewQty);
    lines.push({
      type: "views",
      quantity: viewQty,
      runs,
      hours: hoursForPace(pace, "views", viewQty, viewQty, _hours),
      variance: pace.variance,
      peak: pace.peak,
      min: FLOORS.views,
      gapMinutes: pace.intervalMode === "manual" && pace.intervalMinutes >= 1 ? pace.intervalMinutes : undefined,
      lockRuns: pace.runsMode === "manual" && pace.runs >= 1,
    });
  }
  for (const item of EXTRA_META) {
    const extra = row.extras[item.key];
    if (!extra.on) continue;
    const qty = Math.floor(Number(extra.qty) || 0);
    if (qty <= 0) continue;
    const pace = extra.pace ?? freshPace();
    const runs = runsForPace(pace, item.key, qty);
    lines.push({
      type: item.key,
      quantity: qty,
      runs,
      hours: hoursForPace(pace, item.key, qty, viewQty, _hours),
      variance: pace.variance,
      peak: pace.peak,
      min: FLOORS[item.key],
      gapMinutes: pace.intervalMode === "manual" && pace.intervalMinutes >= 1 ? pace.intervalMinutes : undefined,
      lockRuns: pace.runsMode === "manual" && pace.runs >= 1,
    });
  }
  return mixDrops(lines, start).map((drop, index) => ({
    key: `${drop.type}-${index}`,
    type: drop.type,
    at: localStamp(drop.at),
    amount: String(drop.amount),
    on: true,
  }));
}

function draftSums(runs: RunDraft[]) {
  const totals: Record<string, number> = {};
  for (const run of runs) {
    if (run.on === false) continue;
    totals[run.type] = (totals[run.type] || 0) + Math.max(0, Math.floor(Number(run.amount) || 0));
  }
  return totals;
}

function sensePlatform(value: string) {
  const text = value.toLowerCase();
  const tiktok = text.includes("tiktok.com");
  const instagram = text.includes("instagram.com") || text.includes("instagr.am");
  if (tiktok && instagram) return "mixed" as const;
  if (tiktok) return "tiktok" as const;
  if (instagram) return "instagram" as const;
  return null;
}

function Mass() {
  const [tab, setTab] = useState<"create" | "batches">("create");
  const [bundles, setBundles] = useState<BundleRow[]>([]);
  const [bundleId, setBundleId] = useState("bundle-ig");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [views, setViews] = useState("10000");
  const [panel, setPanel] = useState<Record<string, number>>({});
  const [sections, setSections] = useState<Record<string, boolean>>({});
  const [frame, setFrame] = useState<(typeof FRAMES)[number]["id"]>("Under 24 hours");
  const batchPace: BatchPace = { runsMode: "auto", runs: 0, intervalMode: "auto", intervalMinutes: 0 };
  const [customDate, setCustomDate] = useState("");
  const [customHours, setCustomHours] = useState("6");
  const [defaults, setDefaults] = useState(blankExtras());
  const [mixPreset, setMixPreset] = useState<"light" | "recommended" | "viral" | "custom">("recommended");
  const [qtyMode, setQtyMode] = useState<"percent" | "exact">("exact");
  const [pcts, setPcts] = useState<Record<string, number>>(() => mixCurve("recommended", 10000));
  const [pctText, setPctText] = useState<Record<string, string>>({});
  const pctsRef = useRef(pcts);
  pctsRef.current = pcts;
  const [batches, setBatches] = useState<MassBatchRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [plans, setPlans] = useState<Record<string, { stamp: string; runs: RunDraft[] }>>({});
  const [openPlan, setOpenPlan] = useState<string | null>(null);
  const [showRuns, setShowRuns] = useState<string | null>(null);
  const plansRef = useRef(plans);
  plansRef.current = plans;

  function loadBatches() {
    listMassBatches().then(setBatches).catch(() => setBatches([]));
    getWallet().then((wallet) => setBalance(wallet.balance_paise)).catch(() => setBalance(0));
  }

  useEffect(() => {
    getCatalog().then((catalog) => setBundles(catalog.bundles)).catch(() => setBundles([]));
    loadBatches();
  }, []);

  const platform = bundleId === "bundle-tt" ? "tiktok" : "instagram";
  const bundle = bundles.find((item) => item.platform === platform) ?? bundles.find((item) => item.id === (platform === "tiktok" ? "bundle-tt" : "bundle-ig"));
  const extras = EXTRA_META;

  useEffect(() => {
    engagementSections({ data: platform }).then(setSections).catch(() => setSections({}));
    panelRates({ data: platform }).then(setPanel).catch(() => setPanel({}));
  }, [platform]);

  useEffect(() => {
    const base = Math.floor(Number(views) || 0);
    const locked = qtyMode === "exact" && mixPreset === "custom";
    if (locked) return;
    const source = mixPreset === "custom" ? pctsRef.current : mixCurve(mixPreset, Math.max(base, 100));
    if (mixPreset !== "custom") {
      setPcts(source);
      setPctText(Object.fromEntries(EXTRA_META.map((item) => [item.key, trimPct(source[item.key] ?? 0)])));
    }
    setDefaults((current) => applyPcts(current, base, source));
    if (base < FLOORS.views) return;
    setRows((current) => current.map((row) => {
      const nextViews = row.viewsManual ? Math.floor(Number(row.views) || 0) : base;
      const extras = applyPcts(row.extras, nextViews, source);
      for (const item of EXTRA_META) if (row.extras[item.key].qtyManual) extras[item.key] = row.extras[item.key];
      return { ...row, views: row.viewsManual ? row.views : String(base), extras };
    }));
  }, [views, mixPreset, qtyMode]);
  function onText(next: string) {
    setText(next);
    const sensed = sensePlatform(next);
    if (sensed === "tiktok") setBundleId("bundle-tt");
    else if (sensed === "instagram") setBundleId("bundle-ig");
    if (sensed === "mixed") setNote("Use only Instagram links or only TikTok links in one batch.");
    const links = parseLinks(next);
    setRows((current) =>
      links.map((link) => current.find((row) => row.link === link) ?? rollRow(link, views, defaults, mixPreset, qtyMode, pctsRef.current)),
    );
  }

  const hours = useMemo(() => {
    if (frame === "Custom time") return Math.max(0, Math.round(Number(customHours) || 0));
    if (frame !== "Custom date") return FRAMES.find((item) => item.id === frame)?.hours ?? 24;
    const end = new Date(`${customDate}T23:59:00`).getTime();
    if (!customDate || Number.isNaN(end)) return 0;
    return Math.max(1, Math.round((end - Date.now()) / 3600000));
  }, [frame, customDate, customHours]);

  const sectionKey = `${sections.views === false ? 0 : 1}|${EXTRA_META.map((item) => (sections[item.key] === false ? 0 : 1)).join("")}`;
  const batchKey = "auto";
  const liveExtras = extras.filter((item) => sections[item.key] !== false);

  function opened(row: LinkRow): LinkRow {
    const nextExtras = { ...row.extras };
    for (const item of EXTRA_META) {
      if (sections[item.key] === false) nextExtras[item.key] = { ...nextExtras[item.key], on: false };
    }
    return { ...row, views: sections.views === false ? "0" : row.views, extras: nextExtras };
  }

  useEffect(() => {
    setPlans((current) => {
      const next = { ...current };
      let changed = false;
      rows.forEach((row, index) => {
        const lead = leadHours(index, rows.length, Math.max(hours, 1));
        const stamp = rowStamp(row, hours, lead, sectionKey, batchKey);
        if (next[row.link]?.stamp === stamp) return;
        const start = new Date(Date.now() + lead * 3600 * 1000);
        start.setSeconds(0, 0);
        next[row.link] = { stamp, runs: buildDrafts(rowWithBatch(opened(row), batchPace), Math.max(1, hours - lead), start) };
        changed = true;
      });
      for (const link of Object.keys(next)) {
        if (!rows.some((row) => row.link === link)) {
          delete next[link];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [rows, hours, sectionKey, batchKey]);

  function runsFor(row: LinkRow, index: number) {
    const lead = leadHours(index, rows.length, Math.max(hours, 1));
    const stamp = rowStamp(row, hours, lead, sectionKey, batchKey);
    const saved = plans[row.link];
    if (saved?.stamp === stamp) return saved.runs;
    const start = new Date(Date.now() + lead * 3600 * 1000);
    start.setSeconds(0, 0);
    return buildDrafts(rowWithBatch(opened(row), batchPace), Math.max(1, hours - lead), start);
  }

  function patchRun(link: string, index: number, key: string, patch: Partial<Pick<RunDraft, "at" | "amount" | "on">>) {
    const row = rows.find((item) => item.link === link);
    if (!row) return;
    const lead = leadHours(index, rows.length, Math.max(hours, 1));
    const stamp = rowStamp(row, hours, lead, sectionKey, batchKey);
    const base = plansRef.current[link]?.stamp === stamp ? plansRef.current[link].runs : runsFor(row, index);
    const runs = base.map((item) => (item.key === key ? { ...item, ...patch } : item));
    const sums = draftSums(runs);
    const extrasNext = { ...row.extras };
    for (const item of EXTRA_META) {
      if (!runs.some((run) => run.type === item.key)) continue;
      extrasNext[item.key] = { ...extrasNext[item.key], qty: String(sums[item.key] || 0), qtyManual: true };
    }
    const nextRow: LinkRow = {
      ...row,
      views: runs.some((run) => run.type === "views") ? String(sums.views || 0) : row.views,
      viewsManual: runs.some((run) => run.type === "views") ? true : row.viewsManual,
      extras: extrasNext,
    };
    const nextStamp = rowStamp(nextRow, hours, lead, sectionKey, batchKey);
    setPlans((current) => ({ ...current, [link]: { stamp: nextStamp, runs } }));
    setRows((current) => current.map((item) => (item.link === link ? nextRow : item)));
  }

  const total = rows.reduce((sum, row, index) => {
    const runs = runsFor(row, index);
    const sums = draftSums(runs);
    const picked = Object.fromEntries(
      extras.filter((item) => row.extras[item.key].on).map((item) => [item.key, sums[item.key] || Number(row.extras[item.key].qty) || 0]),
    );
    return sum + priceOf(bundle, sums.views || Number(row.views) || 0, picked, panel);
  }, 0);

  async function submit() {
    if (sections.views !== false && rows.some((row) => row.views === "" || Number(row.views) < FLOORS.views)) {
      setNote("Views are empty or under 100. Below 100 is not allowed.");
      return;
    }
    for (const row of rows) {
      for (const item of extras) {
        if (sections[item.key] === false) continue;
        if (!row.extras[item.key].on) continue;
        const raw = row.extras[item.key].qty;
        if (raw === "") {
          setNote(`${item.label} is empty. Minimum ${FLOORS[item.key]} allowed hai.`);
          return;
        }
        if (Number(raw) < FLOORS[item.key]) {
          setNote(`Below ${FLOORS[item.key]} not allowed for ${item.label}.`);
          return;
        }
        const pace = row.extras[item.key].pace ?? freshPace();
        if (pace.intervalMode === "manual" && (pace.intervalMinutes < 1 || pace.intervalMinutes > 10080)) {
          setNote(`${item.label} interval 1 se 10080 minutes ke beech hona chahiye.`);
          return;
        }
      }
      const viewPace = row.viewPace ?? freshPace();
      if (sections.views !== false && viewPace.intervalMode === "manual" && (viewPace.intervalMinutes < 1 || viewPace.intervalMinutes > 10080)) {
        setNote("Views interval 1 se 10080 minutes ke beech hona chahiye.");
        return;
      }
      const runs = runsFor(row, rows.indexOf(row));
      for (const run of runs) {
        const amount = Math.floor(Number(run.amount) || 0);
        const floor = FLOORS[run.type] || 1;
        if (amount < floor) {
          setNote(`${run.type} ka run ${amount} hai. Minimum ${floor} hona chahiye.`);
          return;
        }
        if (!run.at || Number.isNaN(new Date(run.at).getTime())) {
          setNote(`${run.type} has an invalid delivery time.`);
          return;
        }
      }
    }
    if (rows.length === 0) {
      setNote("Add at least 1 valid link.");
      return;
    }
    if (sensePlatform(text) === "mixed") {
      setNote("Use only Instagram links or only TikTok links in one batch.");
      return;
    }
    if ((frame === "Custom date" || frame === "Custom time") && hours < 1) {
      setNote(frame === "Custom time" ? "Enter the custom time in hours." : "Choose a custom date.");
      return;
    }
    if (balance < total) {
      setNote("Wallet does not cover this batch. Add credit first.");
      return;
    }
    setPending(true);
    setNote("");
    try {
      const result = await submitMassBatch({
        data: {
          bundleId: platform === "tiktok" ? "bundle-tt" : "bundle-ig",
          platform,
          campaignName: name,
          timeframe: frame === "Custom date" ? `Custom · ${customDate}` : frame === "Custom time" ? `Custom · ${hours}h` : frame,
          intervalHours: hours,
          links: rows.map((row, index) => {
            const planned = runsFor(row, index);
            const live = planned.filter((run) => run.on !== false);
            const sums = draftSums(live);
            const placed = (type: string, fallback: number) => planned.some((run) => run.type === type) ? (sums[type] || 0) : fallback;
            return {
            link: row.link,
            views: placed("views", Number(row.views)),
            viewRuns: Math.max(1, live.filter((run) => run.type === "views").length),
            extras: Object.fromEntries(
              extras.filter((item) => row.extras[item.key].on && placed(item.key, Number(row.extras[item.key].qty)) > 0).map((item) => [item.key, placed(item.key, Number(row.extras[item.key].qty))]),
            ),
            runs: Object.fromEntries(
              extras.filter((item) => row.extras[item.key].on && placed(item.key, Number(row.extras[item.key].qty)) > 0).map((item) => [item.key, Math.max(1, live.filter((run) => run.type === item.key).length)]),
            ),
            drops: live.map((run) => ({ type: run.type, amount: Math.floor(Number(run.amount) || 0), at: new Date(run.at).toISOString() })),
            };
          }),
        },
      });
      setNote(`${result.placed} placed · ${result.failed} failed · ${inr(result.total_paise)}.`);
      setText("");
      setRows([]);
      setTab("batches");
      loadBatches();
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Batch stopped.");
    } finally {
      setPending(false);
    }
  }

  const shown = batches.filter((batch) => {
    const named = batch.campaign_name.toLowerCase().includes(query.trim().toLowerCase());
    const statusOk = status === "all" || batch.status === status || (status === "failed" && batch.status === "partial");
    return named && statusOk;
  });
  const completed = batches.filter((batch) => batch.status === "completed").length;
  const processing = batches.filter((batch) => batch.status === "processing").length;
  const failed = batches.filter((batch) => batch.status === "failed" || batch.status === "partial").length;
  const rate = batches.length ? Math.round((completed / batches.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-16">
      <div className="grid grid-cols-2 rounded-2xl bg-[#eef3f8] p-1">
        <button type="button" onClick={() => setTab("create")} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-[14px] font-semibold ${tab === "create" ? "bg-white shadow-sm" : "text-[#64748b]"}`}>
          <Zap className="size-4" /> Create
        </button>
        <button type="button" onClick={() => setTab("batches")} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-[14px] font-semibold ${tab === "batches" ? "bg-white shadow-sm" : "text-[#64748b]"}`}>
          <Clock className="size-4" /> Batches
        </button>
      </div>

      {tab === "create" ? (
        <div className="space-y-3">
          <section className="rounded-3xl border border-[#f3e3c3] bg-[#fffaf3] p-4 text-center">
            <p className="font-semibold text-[#1f2937]"><span className="mr-1 text-amber-500">✦</span> Mass Order — Bulk Engagement</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#64748b]">Order several links at once. Paste them or upload a CSV/TXT file, customize each link, submit the batch, and track it in history.</p>
          </section>

          <section className="rounded-3xl border border-[#e7eef6] bg-white p-4">
            <p className="flex items-center gap-2 font-semibold"><span className="text-[#64748b]">◎</span> Apna Bundle</p>
            <select
              value={bundleId}
              onChange={(event) => setBundleId(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[#e7eef6] bg-[#f3f7fb] px-3 text-[14px]"
            >
              <option value="bundle-ig">Instagram</option>
              <option value="bundle-tt">TikTok</option>
            </select>
            <p className="mt-2 text-[12px] text-[#94a3b8]">
              {platform === "tiktok"
                ? "TikTok is selected. The order uses TikTok views, likes, shares, saves, comments, and reposts from Full Engagement APIs."
                : "Instagram is selected. The order uses Instagram views, likes, shares, saves, comments, and reposts from Full Engagement APIs."}
            </p>
            <p className="mt-3 text-[11px] font-semibold tracking-[0.14em] text-[#94a3b8]">CAMPAIGN NAME (OPTIONAL)</p>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Diwali Reels Mega Campaign 2026" className="mt-1 h-11 w-full rounded-xl bg-[#e7f0f8] px-3 text-[14px] outline-none" />
          </section>

          <section className="rounded-3xl border border-[#e7eef6] bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-2 font-semibold"><Link2 className="size-4" /> Links</p>
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[#e7eef6] px-3 py-1 text-[12px] font-semibold">
                <Upload className="size-3.5" /> Upload CSV / TXT
                <input
                  type="file"
                  accept=".csv,.txt,text/plain"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    onText(`${text}\n${await file.text()}`);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            <textarea
              value={text}
              onChange={(event) => onText(event.target.value)}
              placeholder={"One link per line.\nhttps://instagram.com/p/abc\nhttps://instagram.com/p/xyz\n\nOr upload a CSV (first column = link)."}
              className="h-36 w-full resize-y rounded-2xl border border-[#e7eef6] p-3 text-[13px] outline-none"
            />
            <p className="mt-2 text-[12px] text-[#94a3b8]">{rows.length} valid link(s)</p>

            <p className="mt-4 text-[11px] font-semibold tracking-[0.14em] text-[#94a3b8]">DEFAULT BASE QUANTITY (VIEWS)</p>
            <div className="mt-1">
              <input
                value={views}
                inputMode="numeric"
                onChange={(event) => {
                  const qty = event.target.value.replace(/[^\d]/g, "");
                  setViews(qty);
                  const nextViews = Math.floor(Number(qty) || 0);
                  setRows((current) => current.map((row) => {
                    if (row.viewsManual) return row;
                    if (qtyMode === "exact" && mixPreset === "custom") return { ...row, views: qty };
                    const line = mixPreset === "custom" ? pctsRef.current : mixCurve(mixPreset, Math.max(nextViews, 100));
                    const extras = applyPcts(row.extras, nextViews, line);
                    for (const item of EXTRA_META) if (row.extras[item.key].qtyManual) extras[item.key] = row.extras[item.key];
                    return { ...row, views: qty, extras };
                  }));
                }}
                className="h-11 w-full rounded-xl bg-[#e7f0f8] px-3 text-[15px] outline-none"
              />
            </div>
            {views !== "" && Number(views) < 100 && <p className="mt-1 text-[12px] font-semibold text-rose-600">Below 100 not allowed</p>}

            <p className="mt-4 text-[11px] font-semibold tracking-[0.14em] text-[#94a3b8]">DEFAULT TIMEFRAME</p>
            <select value={frame} onChange={(event) => setFrame(event.target.value as (typeof FRAMES)[number]["id"])} className="mt-1 h-11 w-full rounded-xl border border-[#e7eef6] bg-white px-3">
              {FRAMES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            {frame === "Custom date" && (
              <input type="date" value={customDate} onChange={(event) => setCustomDate(event.target.value)} className="mt-2 h-11 w-full rounded-xl bg-[#e7f0f8] px-3" />
            )}
            {frame === "Custom time" && (
              <label className="mt-2 flex h-11 items-center gap-2 rounded-xl bg-[#e7f0f8] px-3">
                <input
                  value={customHours}
                  inputMode="numeric"
                  onChange={(event) => setCustomHours(event.target.value.replace(/[^\d]/g, ""))}
                  className="w-full bg-transparent text-[15px] outline-none"
                  placeholder="Hours"
                />
                <span className="text-[12px] text-[#64748b]">hours</span>
              </label>
            )}
            <p className="mt-2 text-[12px] text-[#94a3b8]">
              {hours > 0
                ? `Default delivery time is ${hours} hours. Every service stays on Auto until you set one yourself.`
                : "Choose a custom time or date. Services on Auto use that window."}
            </p>

            <p className="mt-4 text-[11px] font-semibold tracking-[0.14em] text-[#94a3b8]">ENGAGEMENT MIX</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {([
                ["light", "Light"],
                ["recommended", "Recommended"],
                ["viral", "Viral push"],
              ] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setMixPreset(id)} className={`h-11 rounded-2xl px-2 text-[12px] font-semibold ${mixPreset === id ? "bg-[#111827] text-white" : "bg-[#f3f6fa] text-[#334155]"}`}>
                  {label}{id === "recommended" && <span className="ml-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white">BEST</span>}
                </button>
              ))}
              <button type="button" onClick={() => setMixPreset("custom")} className={`h-11 rounded-2xl px-2 text-[12px] font-semibold ${mixPreset === "custom" ? "bg-[#111827] text-white" : "bg-[#f3f6fa] text-[#334155]"}`}>Your own amounts</button>
            </div>
            <div className="my-3 h-px bg-[#d7e0ea]" />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => {
                if (mixPreset === "custom" && qtyMode !== "percent") {
                  const base = Math.max(1, Number(views) || 1);
                  const next: Record<string, number> = {};
                  for (const item of EXTRA_META) next[item.key] = Math.round((Number(defaults[item.key].qty) || 0) / base * 100000) / 1000;
                  setPcts((current) => ({ ...current, ...next }));
                }
                setQtyMode("percent");
              }} className={`h-11 rounded-2xl text-[13px] font-semibold ${qtyMode === "percent" ? "bg-[#111827] text-white" : "bg-[#f3f6fa] text-[#334155]"}`}>% of views</button>
              <button type="button" onClick={() => setQtyMode("exact")} className={`h-11 rounded-2xl text-[13px] font-semibold ${qtyMode === "exact" ? "bg-[#111827] text-white" : "bg-[#f3f6fa] text-[#334155]"}`}>Exact number</button>
            </div>
            <p className="mt-2 text-[12px] text-[#64748b]">
              {mixPreset === "light" && "Light: a quiet post. Fewer likes and very few comments or shares."}
              {mixPreset === "recommended" && "Recommended: the same mix real posts get with this many views."}
              {mixPreset === "viral" && "Viral push: about double a normal post, like content that is taking off."}
              {mixPreset === "custom" && "Your own amounts. % of views follows the views. Exact number stays as you type it."}
            </p>

            <p className="mt-4 text-[11px] font-semibold tracking-[0.14em] text-[#94a3b8]">DEFAULT EXTRA ENGAGEMENT (OPTIONAL)</p>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {liveExtras.map((item) => (
                <label key={item.key} className={`flex items-center gap-2 rounded-2xl border border-[#eef2f6] px-3 py-2 text-[13px] ${defaults[item.key].on ? "" : "opacity-55"}`}>
                  <input
                    type="checkbox"
                    checked={defaults[item.key].on}
                    onChange={() => {
                      const next = !defaults[item.key].on;
                      setDefaults((current) => ({ ...current, [item.key]: { ...current[item.key], on: next } }));
                      setRows((current) => current.map((entry) => ({
                        ...entry,
                        extras: { ...entry.extras, [item.key]: { ...entry.extras[item.key], on: next } },
                      })));
                    }}
                  />
                  <item.icon className="size-3.5 text-[#64748b]" />
                  <span className="flex-1">{item.label}</span>
                  <input
                    value={qtyMode === "percent" ? (pctText[item.key] ?? trimPct(pcts[item.key] ?? 0)) : defaults[item.key].qty}
                    inputMode={qtyMode === "percent" ? "decimal" : "numeric"}
                    aria-label={`${item.label} ${qtyMode === "percent" ? "percent" : "quantity"}`}
                    onChange={(event) => {
                      if (qtyMode === "percent") {
                        const raw = event.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
                        const pct = raw === "" || raw === "." ? 0 : Math.min(100, Number(raw) || 0);
                        const nextPcts = { ...pctsRef.current, [item.key]: pct };
                        setMixPreset("custom");
                        setPcts(nextPcts);
                        setPctText((current) => ({ ...current, [item.key]: raw }));
                        const base = Math.floor(Number(views) || 0);
                        setDefaults((current) => applyPcts(current, base, nextPcts));
                        setRows((current) => current.map((entry) => {
                          const extras = applyPcts(entry.extras, Math.floor(Number(entry.views) || 0), nextPcts);
                          for (const extra of EXTRA_META) if (entry.extras[extra.key].qtyManual) extras[extra.key] = entry.extras[extra.key];
                          return { ...entry, extras };
                        }));
                        return;
                      }
                      const qty = event.target.value.replace(/[^\d]/g, "");
                      setMixPreset("custom");
                      setDefaults((current) => ({ ...current, [item.key]: { ...current[item.key], qty } }));
                      setRows((current) => current.map((entry) => entry.extras[item.key].qtyManual ? entry : ({
                        ...entry,
                        extras: { ...entry.extras, [item.key]: { ...entry.extras[item.key], qty } },
                      })));
                    }}
                    className="h-8 w-20 rounded-full bg-[#eef5fb] text-center text-[13px] font-semibold outline-none"
                  />
                  {qtyMode === "percent" && <span className="text-[11px] font-bold text-[#7c6bff]">% = {Number(defaults[item.key].qty || 0).toLocaleString("en-IN")}</span>}
                  {defaults[item.key].on && defaults[item.key].qty !== "" && Number(defaults[item.key].qty) < FLOORS[item.key] && <span className="text-[11px] font-semibold text-rose-600">min {FLOORS[item.key]}</span>}
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-[#94a3b8]">Tick or untick at the top to turn that service on or off for every link. You can also change one link on its own. An unticked service is not ordered, and its quantity and runs are not placed. On Light, Recommended, or Viral, changing views updates likes, comments, shares, saves, and reposts. Real posts: likes {REAL_BAND.likes}, comments {REAL_BAND.comments}, shares {REAL_BAND.shares}, saves {REAL_BAND.saves}.</p>

            {rows.length > 0 && (
              <div className="mt-4 max-h-[70vh] space-y-4 overflow-auto pr-1">
                {rows.map((row, index) => {
                  const planned = runsFor(row, index);
                  const patchPace = (type: string, patch: Partial<Pace>, source: "runs" | "interval" | "window" | "other" = "other") => {
                    setRows((current) => current.map((item) => {
                      if (item.link !== row.link) return item;
                      const prev = servicePace(item, type);
                      const quantity = type === "views" ? Math.floor(Number(item.views) || 0) : Math.floor(Number(item.extras[type as ExtraKey]?.qty) || 0);
                      const floor = (PROVIDER_MIN[type] ?? FLOORS[type] ?? 10) + 1;
                      const maxRuns = Math.max(1, Math.floor(quantity / floor) || 1);
                      const runsNow = patch.runsMode === "manual" && (patch.runs || 0) >= 1
                        ? patch.runs || 1
                        : prev.runsMode === "manual" && prev.runs >= 1 ? prev.runs : autoRuns(Math.max(quantity, 1), type);
                      const next = linkPace(prev, patch, source, Math.min(maxRuns, runsNow), maxRuns);
                      if (type === "views") return { ...item, viewPace: next };
                      const key = type as ExtraKey;
                      return { ...item, extras: { ...item.extras, [key]: { ...item.extras[key], pace: next } } };
                    }));
                  };
                  const serviceLine = (type: string, label: string, qty: string, on: boolean, onQty: (value: string) => void, onToggle?: () => void) => {
                    const mine = planned.filter((item) => item.type === type);
                    const liveMine = mine.filter((item) => item.on !== false);
                    const open = openPlan === `${row.link}::${type}`;
                    const pace = servicePace(row, type);
                    const quantity = Math.floor(Number(qty) || 0);
                    const chunk = PROVIDER_MIN[type] ?? FLOORS[type] ?? 10;
                    const maxRuns = Math.max(1, Math.floor(quantity / (quantity > chunk ? chunk + 1 : Math.max(1, chunk))));
                    const runs = runsForPace(pace, type, quantity);
                    const lineHours = hoursForPace(pace, type, quantity, Math.floor(Number(row.views) || quantity || 100), hours);
                    const risk = riskLabel(pace.variance);
                    const amounts = mine.map((item) => Math.floor(Number(item.amount) || 0));
                    const average = amounts.reduce((sum, amount) => sum + amount, 0) / Math.max(1, amounts.length);
                    const spreadDown = amounts.length ? Math.max(0, Math.round(average - Math.min(...amounts))) : 0;
                    const spreadUp = amounts.length ? Math.max(0, Math.round(Math.max(...amounts) - average)) : 0;
                    const manual = pace.runsMode === "manual";
                    return (
                      <div key={type} className={`rounded-2xl border border-white/10 bg-black/20 px-2 py-2 ${on ? "" : "opacity-45"}`}>
                        <div className="flex items-center gap-1">
                          {onToggle ? <input type="checkbox" checked={on} onChange={onToggle} /> : <span className="w-4" />}
                          <span className="w-16">{label}</span>
                          <input value={qty} inputMode="numeric" disabled={!on} onChange={(event) => onQty(event.target.value.replace(/[^\d]/g, ""))} className="h-7 w-20 rounded-lg bg-white text-center" />
                        </div>
                        <button type="button" disabled={!on} onClick={() => setOpenPlan(open ? null : `${row.link}::${type}`)} className="mx-auto mt-2 flex items-center gap-1 text-[11px] font-semibold tracking-wide text-[#94a3b8] disabled:opacity-40">
                          <Settings2 className="size-3" /> SETTINGS {open ? "▴" : "▾"}
                        </button>
                        {open && on && (
                          <div className="mt-3 space-y-2">
                            <div className="rounded-2xl border border-violet-400/40 bg-black/30 p-3">
                              <p className="text-[11px] font-bold tracking-[0.14em] text-cyan-200">DELIVERY TIME</p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {(["auto", "6h", "12h", "24h", "48h", "custom"] as const).map((windowId) => (
                                  <button key={windowId} type="button" onClick={() => patchPace(type, { window: windowId }, windowId === "auto" ? "other" : "window")} className={`rounded-full px-3 py-1 text-[12px] font-semibold ${pace.window === windowId ? "btn-gradient bg-gradient-to-r from-violet-600 to-cyan-500 text-white" : "border border-white/15 bg-white/5"}`}>
                                    {windowId === "auto" ? "Auto" : windowId === "custom" ? "Custom" : windowId}
                                  </button>
                                ))}
                              </div>
                              {pace.window === "custom" && (
                                <label className="mt-2 flex items-center gap-2">
                                  <input
                                    inputMode="numeric"
                                    value={pace.customHours || ""}
                                    placeholder="hours"
                                    onChange={(event) => {
                                      const raw = event.target.value.replace(/[^\d]/g, "");
                                      const next = Number(raw);
                                      patchPace(type, { window: "custom", customHours: raw === "" ? 0 : Math.min(24 * 30, next || 0) }, "window");
                                    }}
                                    className="h-10 w-24 rounded-xl border border-white/15 bg-white px-3 text-[14px] font-semibold text-[#0f172a] outline-none"
                                  />
                                  <span className="text-[12px] text-[#94a3b8]">hours · {formatDuration(lineHours)}</span>
                                </label>
                              )}
                              <p className="mt-2 text-[11px] text-[#94a3b8]">{pace.runsMode === "manual" && pace.runs >= 1 && pace.intervalMode === "manual" && pace.intervalMinutes >= 1 ? `${pace.runs} runs × ${pace.intervalMinutes} min = ${formatDuration((pace.runs * pace.intervalMinutes) / 60).replace("~", "")}.` : pace.window === "auto" ? `Auto uses the ${hours || 24} hour default. Set runs and interval and this time follows them.` : `This service finishes inside ${formatDuration(lineHours)}. Runs and interval follow this time.`}</p>
                            </div>
                            <div className="rounded-2xl border border-violet-400/40 bg-black/30 p-3">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] font-bold tracking-[0.14em] text-cyan-200">NUMBER OF RUNS</p>
                                <p className="text-[11px] text-[#94a3b8]">max {maxRuns}</p>
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <button type="button" onClick={() => patchPace(type, { runsMode: "auto", runs: 0 })} className={`h-10 rounded-xl px-3 text-[12px] font-semibold ${manual ? "border border-white/15 bg-white/5" : "btn-gradient bg-gradient-to-r from-violet-600 to-cyan-500 text-white"}`}>Auto</button>
                                <input
                                  inputMode="numeric"
                                  value={manual ? String(pace.runs || "") : ""}
                                  placeholder={manual ? "runs" : `${runs} auto`}
                                  onChange={(event) => {
                                    const raw = event.target.value.replace(/[^\d]/g, "");
                                    const next = Number(raw);
                                    if (raw !== "" && next >= 1) patchPace(type, { runsMode: "manual", runs: Math.min(maxRuns, next) }, "runs");
                                    else patchPace(type, { runsMode: "manual", runs: 0 }, "runs");
                                  }}
                                  className="h-10 min-w-0 flex-1 rounded-xl border border-white/15 bg-white px-3 font-semibold text-[#0f172a] outline-none placeholder:font-medium placeholder:text-[#94a3b8]"
                                />
                              </div>
                              <p className="mt-2 text-[11px] text-[#94a3b8]">{manual && pace.runs >= 1 ? `${Math.min(maxRuns, pace.runs)} runs for this service only. Quantity per run moves to match.` : "Auto picks the run count. Type a number to set this service only."}</p>
                            </div>
                            <div className="rounded-2xl border border-violet-400/40 bg-black/30 p-3">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] font-bold tracking-[0.14em] text-cyan-200">INTERVAL</p>
                                <p className="text-[11px] text-[#94a3b8]">minutes between runs</p>
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <button type="button" onClick={() => patchPace(type, { intervalMode: "auto", intervalMinutes: 0 })} className={`h-10 rounded-xl px-3 text-[12px] font-semibold ${pace.intervalMode === "manual" ? "border border-white/15 bg-white/5" : "btn-gradient bg-gradient-to-r from-violet-600 to-cyan-500 text-white"}`}>Auto</button>
                                <input
                                  inputMode="numeric"
                                  value={pace.intervalMode === "manual" ? String(pace.intervalMinutes || "") : ""}
                                  placeholder={`${Math.max(1, Math.round((lineHours / Math.max(1, runs)) * 60))} min auto`}
                                  onChange={(event) => {
                                    const raw = event.target.value.replace(/[^\d]/g, "");
                                    const next = Number(raw);
                                    if (raw !== "" && next >= 1 && next <= 10080) patchPace(type, { intervalMode: "manual", intervalMinutes: next }, "interval");
                                    else patchPace(type, { intervalMode: "manual", intervalMinutes: 0 }, "interval");
                                  }}
                                  className="h-10 min-w-0 flex-1 rounded-xl border border-white/15 bg-white px-3 font-semibold text-[#0f172a] outline-none placeholder:font-medium placeholder:text-[#94a3b8]"
                                />
                              </div>
                              {pace.intervalMode === "manual" && pace.intervalMinutes < 1 && <p className="mt-2 text-[12px] font-semibold text-rose-300">Below 1 minute is not allowed</p>}
                              <p className="mt-2 text-[11px] text-[#94a3b8]">{pace.intervalMode === "manual" && pace.intervalMinutes >= 1 ? `This service only: ${pace.intervalMinutes} minutes between runs while delivery time is Auto.` : "Auto follows the delivery time."}</p>
                            </div>
                            <div className="rounded-2xl border border-violet-400/40 bg-black/30 p-3">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] font-bold tracking-[0.14em] text-cyan-200">RANDOM VARIANCE</p>
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">±{pace.variance}%</span>
                              </div>
                              <input type="range" min={10} max={50} value={pace.variance} onChange={(event) => patchPace(type, { variance: Number(event.target.value) })} className="mt-2 w-full accent-amber-500" />
                              <div className={`mt-2 rounded-2xl border p-3 ${risk.tone === "amber" ? "border-amber-200 bg-amber-50" : risk.tone === "rose" ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
                                <div className="mb-2 flex items-center justify-between font-semibold text-[#0f172a]">
                                  <span>Detection Risk</span>
                                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px]">{risk.label}</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-white">
                                  <div className={`h-full rounded-full ${risk.tone === "rose" ? "bg-rose-500" : risk.tone === "emerald" ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${Math.min(100, pace.variance * 1.6)}%` }} />
                                </div>
                                <p className={`mt-2 text-[12px] ${risk.tone === "rose" ? "text-rose-700" : risk.tone === "emerald" ? "text-emerald-700" : "text-amber-700"}`}>{risk.hint}</p>
                              </div>
                              <div className="mt-2 flex items-center justify-between rounded-xl border border-white/10 px-3 py-2">
                                <span>Per run</span>
                                <span>-{spreadDown.toLocaleString("en-IN")} to +{spreadUp.toLocaleString("en-IN")}</span>
                              </div>
                            </div>
                            <button type="button" aria-pressed={pace.peak} onClick={() => patchPace(type, { peak: !pace.peak })} className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left ${pace.peak ? "border-amber-300 bg-amber-50 text-[#0f172a]" : "border-violet-400/40 bg-black/30"}`}>
                              <div>
                                <p className="flex items-center gap-1 text-[12px] font-bold tracking-wide"><Lock className="size-3.5" /> PEAK HOURS BOOST</p>
                                <p className={`text-[11px] ${pace.peak ? "text-[#7c5c28]" : "text-[#94a3b8]"}`}>{pace.peak ? "On. More quantity lands between 6 and 11 PM IST." : "Off. Runs stay on the normal schedule."}</p>
                              </div>
                              <span className={`relative h-7 w-12 shrink-0 rounded-full ${pace.peak ? "bg-[#7c3aed]" : "bg-[#475569]"}`}>
                                <span className="absolute top-0.5 size-6 rounded-full bg-white shadow" style={{ left: pace.peak ? 22 : 2 }} />
                              </span>
                            </button>
                            <div className="rounded-2xl border border-violet-400/40 bg-black/30 p-3">
                              <p className="mb-2 flex items-center gap-1 font-semibold"><Calendar className="size-4" /> Schedule</p>
                              <div className="grid grid-cols-3 gap-2 text-center">
                                <div><p className="text-[16px] font-bold">{liveMine.length}</p><p className="text-[10px] text-[#94a3b8]">runs</p></div>
                                <div><p className="text-[16px] font-bold">{formatDuration((pace.intervalMode === "manual" && pace.window === "auto" && pace.intervalMinutes >= 1 ? pace.intervalMinutes : Math.max(1, Math.round((lineHours / Math.max(1, liveMine.length || runs)) * 60))) / 60)}</p><p className="text-[10px] text-[#94a3b8]">interval</p></div>
                                <div><p className="text-[12px] font-bold">{(liveMine[liveMine.length - 1] ?? mine[mine.length - 1])?.at.replace("T", " ") ?? ""}</p><p className="text-[10px] text-[#94a3b8]">finish</p></div>
                              </div>
                              <button type="button" onClick={() => setShowRuns(showRuns === `${row.link}::${type}` ? null : `${row.link}::${type}`)} className="btn-gradient mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-[13px] font-bold text-white">
                                {showRuns === `${row.link}::${type}` ? "Hide schedule" : "Show schedule"}
                              </button>
                              {showRuns === `${row.link}::${type}` && (
                                <div className="mt-2 max-h-56 space-y-1 overflow-auto rounded-xl border border-white/10 p-2">
                                  {mine.map((run, runIndex) => (
                                    <div key={run.key} className={`flex items-center gap-1 ${run.on === false ? "opacity-45" : ""}`}>
                                      <button type="button" role="checkbox" aria-checked={run.on !== false} aria-label={run.on === false ? "Run off" : "Run on"} onClick={() => patchRun(row.link, index, run.key, { on: run.on === false })} className={`grid size-5 shrink-0 place-items-center rounded-[5px] border ${run.on === false ? "border-white/30 bg-transparent text-transparent" : "border-[#f97316] bg-[#f97316] text-white"}`}>
                                        <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.8"><path d="M4 10.5 8 14.5 16 5.5" /></svg>
                                      </button>
                                      <span className="grid size-5 place-items-center rounded-full bg-white text-[10px] font-bold text-[#111827]">{runIndex + 1}</span>
                                      <input type="datetime-local" disabled={run.on === false} value={run.at} onChange={(event) => patchRun(row.link, index, run.key, { at: event.target.value })} className="h-8 min-w-0 flex-1 rounded-lg bg-white px-1 text-[11px] text-[#0f172a] disabled:opacity-60" />
                                      <input value={run.amount} disabled={run.on === false} inputMode="numeric" onChange={(event) => patchRun(row.link, index, run.key, { amount: event.target.value.replace(/[^\d]/g, "") })} className="h-8 w-16 rounded-lg bg-white text-center text-[11px] text-[#0f172a] disabled:opacity-60" />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  };
                  return (
                  <article key={row.link} className="overflow-hidden rounded-3xl border border-[#7c6bff]/50 bg-[#120c22] text-[12px] shadow-[0_0_24px_rgba(124,107,255,0.18)]">
                    <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-gradient-to-r from-violet-600/30 to-cyan-500/20 px-3 py-2">
                      <span className="rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 px-3 py-1 text-[11px] font-bold tracking-wide text-white">Order {index + 1}</span>
                      <span className="text-[11px] font-semibold text-cyan-100">{planned.filter((run) => run.on !== false).length}/{planned.length} runs</span>
                    </div>
                    <div className="p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">Link</p>
                    <p className="mt-1 truncate rounded-xl border border-white/10 bg-black/20 px-2 py-1.5 font-semibold text-white">{row.link}</p>
                    <p className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">Services</p>
                    <div className="mt-2 space-y-2">
                      {sections.views !== false && serviceLine("views", "Views", row.views, true,
                        (next) => setRows((current) => current.map((item) => {
                          if (item.link !== row.link) return item;
                          const nextViews = Math.floor(Number(next) || 0);
                          if (qtyMode === "exact" && mixPreset === "custom") return { ...item, views: next, viewsManual: true };
                          const line = mixPreset === "custom" ? pcts : mixCurve(mixPreset, Math.max(Number(views) || nextViews, 100));
                          const extras = applyPcts(item.extras, nextViews, line);
                          for (const extra of EXTRA_META) if (item.extras[extra.key].qtyManual) extras[extra.key] = item.extras[extra.key];
                          return { ...item, views: next, viewsManual: true, extras };
                        })),
                      )}
                      {sections.views !== false && row.views !== "" && Number(row.views) < 100 && <p className="text-rose-600">Views min 100</p>}
                      {liveExtras.map((item) => serviceLine(
                        item.key,
                        item.label,
                        row.extras[item.key].qty,
                        row.extras[item.key].on,
                        (qty) => setRows((current) => current.map((entry) => entry.link === row.link ? { ...entry, extras: { ...entry.extras, [item.key]: { ...entry.extras[item.key], qty, qtyManual: true } } } : entry)),
                        () => setRows((current) => current.map((entry) => entry.link === row.link ? { ...entry, extras: { ...entry.extras, [item.key]: { ...entry.extras[item.key], on: !entry.extras[item.key].on } } } : entry)),
                      ))}
                    </div>
                    <button type="button" onClick={() => setOpenPlan(openPlan === `${row.link}::mix` ? null : `${row.link}::mix`)} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-gradient-to-r from-violet-600/40 to-cyan-500/30 text-[13px] font-semibold text-white">
                      <span>{openPlan === `${row.link}::mix` ? "⌃" : "⌄"}</span>
                      {openPlan === `${row.link}::mix` ? "Hide" : "Show"} schedule ({planned.filter((run) => run.on !== false).length}/{planned.length})
                    </button>
                    {openPlan === `${row.link}::mix` && (
                      <div className="mt-2 max-h-80 space-y-1.5 overflow-auto">
                        <p className="px-1 text-[10px] text-[#94a3b8]">Tick a run to place it. Untick a run and that run stays off. It will not be ordered.</p>
                        {planned.map((run) => {
                          const seen = planned.filter((item) => item.type === run.type && item.on !== false && item.at <= run.at).reduce((sum, item) => sum + Math.max(0, Math.floor(Number(item.amount) || 0)), 0);
                          return (
                            <div key={run.key} className={`flex items-center gap-1 rounded-xl bg-white/10 px-2 py-1.5 ${run.on === false ? "opacity-45" : ""}`}>
                              <button type="button" role="checkbox" aria-checked={run.on !== false} aria-label={run.on === false ? "Run off" : "Run on"} onClick={() => patchRun(row.link, index, run.key, { on: run.on === false })} className={`grid size-5 shrink-0 place-items-center rounded-[5px] border ${run.on === false ? "border-white/40 bg-transparent text-transparent" : "border-[#f97316] bg-[#f97316] text-white"}`}>
                                <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.8"><path d="M4 10.5 8 14.5 16 5.5" /></svg>
                              </button>
                              <span className="w-14 shrink-0 capitalize text-[10px] font-semibold text-cyan-100">{run.type}</span>
                              <input type="datetime-local" disabled={run.on === false} value={run.at} onChange={(event) => patchRun(row.link, index, run.key, { at: event.target.value })} className="h-7 min-w-0 flex-1 rounded-lg bg-white px-1 text-[11px] text-[#0f172a] disabled:opacity-60" />
                              <input value={run.amount} disabled={run.on === false} inputMode="numeric" onChange={(event) => patchRun(row.link, index, run.key, { amount: event.target.value.replace(/[^\d]/g, "") })} className="h-7 w-12 rounded-lg bg-white text-center text-[11px] font-semibold text-[#0f172a] disabled:opacity-60" />
                              <span className="w-12 shrink-0 text-right text-[10px] font-semibold text-white">{run.on === false ? "off" : `=${seen.toLocaleString("en-IN")}`}</span>
                            </div>
                          );
                        })}
                        {planned.length === 0 && <p className="px-1 text-[11px] text-[#94a3b8]">Set a quantity and the schedule shows here.</p>}
                      </div>
                    )}
                    </div>
                  </article>
                  );
                })}
              </div>
            )}
          </section>

          {rows.length === 0 && (
            <p className="flex items-center gap-2 rounded-2xl border border-[#f3e3c3] bg-[#fff8e8] px-3 py-3 text-[13px] text-amber-800">
              <Clock className="size-4" /> Add at least 1 valid link.
            </p>
          )}
          <section className="rounded-3xl border border-[#e7eef6] bg-white p-4 text-center">
            <p className="text-[14px] text-[#64748b]">{rows.length} order(s) ready • Total {inr(total)}</p>
            <button type="button" disabled={pending || rows.length === 0} onClick={submit} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#5aa2f3] text-[15px] font-semibold text-white disabled:opacity-60">
              <Zap className="size-4" /> {pending ? "Submitting…" : "Submit All Orders"}
            </button>
          </section>
          {note && <p className="text-center text-[13px] text-[#334155]">{note}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="TOTAL BATCHES" value={String(batches.length)} />
            <Stat label="COMPLETED" value={String(completed)} tone="text-emerald-500" />
            <Stat label="PROCESSING" value={String(processing)} />
            <Stat label="FAILED / PARTIAL" value={String(failed)} tone="text-rose-500" />
            <Stat label="SUCCESS RATE" value={`${rate}%`} tone="text-orange-500" />
          </div>
          <section className="space-y-2 rounded-3xl border border-[#e7eef6] bg-white p-3">
            <label className="flex h-11 items-center gap-2 rounded-xl bg-[#e7f0f8] px-3 text-[#94a3b8]">
              <Search className="size-4" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by campaign name..." className="w-full bg-transparent text-[14px] text-[#0f172a] outline-none" />
            </label>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 w-full rounded-xl border border-[#e7eef6] bg-white px-3 text-[14px]">
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed / partial</option>
            </select>
            <button type="button" onClick={loadBatches} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#e7eef6] text-[14px] font-semibold">
              <RefreshCw className="size-4" /> Refresh
            </button>
          </section>
          {shown.length === 0 ? (
            <section className="grid min-h-40 place-items-center rounded-3xl border border-[#e7eef6] bg-white px-6 py-10 text-center text-[14px] text-[#94a3b8]">
              <div>
                <BarChart3 className="mx-auto mb-3 size-6" />
                No batches yet. Create one from the "Create" tab.
              </div>
            </section>
          ) : (
            shown.map((batch) => (
              <article key={batch.id} className="rounded-3xl border border-[#e7eef6] bg-white p-4">
                <button type="button" onClick={() => setOpenId(openId === batch.id ? null : batch.id)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{batch.campaign_name}</p>
                      <p className="text-[12px] text-[#94a3b8]">{batch.platform} · {batch.timeframe} · {new Date(batch.created_at).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase ${batch.status === "completed" ? "bg-emerald-50 text-emerald-600" : batch.status === "processing" ? "bg-sky-50 text-sky-600" : "bg-rose-50 text-rose-600"}`}>{batch.status}</span>
                  </div>
                  <p className="mt-2 text-[13px] text-[#334155]">{batch.placed_count}/{batch.link_count} links · {inr(batch.total_paise)}</p>
                </button>
                {openId === batch.id && (
                  <div className="mt-3 space-y-2 border-t border-[#eef2f6] pt-3 text-[12px]">
                    {batch.links.map((link) => (
                      <div key={link.link} className="rounded-xl bg-[#f8fafc] px-3 py-2">
                        <p className="truncate font-semibold">{link.link}</p>
                        <p className="text-[#64748b]">{link.order_number ?? "No order"} · {link.status} · {inr(link.total_paise)}</p>
                        {link.error && <p className="text-rose-600">{link.error}</p>}
                      </div>
                    ))}
                    {batch.status === "processing" && (
                      <button
                        type="button"
                        onClick={async () => {
                          await completeMassBatch({ data: batch.id });
                          loadBatches();
                        }}
                        className="h-10 w-full rounded-xl bg-[#111827] text-[13px] font-semibold text-white"
                      >
                        Mark batch complete
                      </button>
                    )}
                    <p className="text-[#94a3b8]">YoYoMedia already has the placed links. Mark complete only updates this desk.</p>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "text-[#0f172a]" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-[#e7eef6] bg-white px-4 py-3">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-[#94a3b8]">{label}</p>
      <p className={`mt-1 text-[28px] font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
