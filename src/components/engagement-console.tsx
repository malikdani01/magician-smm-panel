import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  Activity,
  Calendar,
  Eye,
  Heart,
  Instagram,
  Link2,
  Lock,
  MessageCircle,
  Music2,
  Rocket,
  Send,
  Settings2,
  Share2,
  ShieldCheck,
  Bookmark,
  Clock,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Sprout,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { askPanelAi, engagementFloors, engagementSections, getCatalog, getPrefs, getWallet, panelRates, placeOrder, type BundleItem, type BundleRow } from "@/lib/panel.functions";
import { inr } from "@/lib/money";
import {
  DEFAULT_PACE,
  GROWTH_FAMILIES,
  TEMPLATE_COUNT,
  autoRuns,
  answerOrganic,
  mixFromRatios,
  SETTINGS_RATIO_DEFAULTS,
  planDrops,
  mixCurve,
  trimPct,
  REAL_BAND,
  mixDrops,
  PROVIDER_MIN,
  formatDuration,
  growthPreview,
  growthTemplate,
  organicOpening,
  planOrganicAsk,
  presetWeights,
  ratioReport,
  riskLabel,
  windowHours,
  paceHours,
  paceGapMinutes,
  linkPace,
  type Pace,
} from "@/lib/organic";

function sensePlatform(value: string) {
  const text = value.toLowerCase();
  const tiktok = text.includes("tiktok.com");
  const instagram = text.includes("instagram.com") || text.includes("instagr.am");
  if (tiktok && !instagram) return "tiktok" as const;
  if (instagram && !tiktok) return "instagram" as const;
  return null;
}

const ORDER_TYPES = ["views", "likes", "shares", "reposts", "saves", "comments"];
const PRESETS = [10000, 50000, 100000, 500000, 1000000];
const CURVE_SERIES = [
  { key: "views", label: "Views", Icon: Eye, stroke: "#60a5fa", dot: "#2563eb", wash: "#93c5fd" },
  { key: "likes", label: "Likes", Icon: Heart, stroke: "#5eead4", dot: "#0f766e", wash: "#99f6e4" },
  { key: "saves", label: "Saves", Icon: Bookmark, stroke: "#fbbf24", dot: "#d97706", wash: "#fde68a" },
  { key: "shares", label: "Shares", Icon: Share2, stroke: "#3b82f6", dot: "#1d4ed8", wash: "#bfdbfe" },
] as const;
const TYPE_TONE: Record<string, { title: string; icon: string }> = {
  views: { title: "text-[#0f172a]", icon: "text-sky-500" },
  likes: { title: "text-emerald-600", icon: "text-rose-500" },
  shares: { title: "text-[#2563eb]", icon: "text-[#2563eb]" },
  reposts: { title: "text-emerald-600", icon: "text-emerald-500" },
  saves: { title: "text-amber-600", icon: "text-amber-500" },
  comments: { title: "text-fuchsia-300", icon: "text-fuchsia-300" },
};

const ICONS: Record<string, typeof Eye> = {
  views: Eye,
  likes: Heart,
  shares: Share2,
  reposts: RefreshCw,
  saves: Bookmark,
  comments: MessageCircle,
};

function lineQty(item: BundleItem, base: number, overrides: Record<string, number>) {
  if (overrides[item.engagement_type] != null) return overrides[item.engagement_type];
  if (item.is_base) return base;
  return Math.round((base * item.ratio_bps) / 10000);
}

const MIX_COPY: Record<"light" | "recommended" | "viral" | "custom", string> = {
  light: "Light: a quiet post. Fewer likes and very few comments or shares.",
  recommended: "Recommended: the same mix real posts get with this many views. Safest and looks the most natural.",
  viral: "Viral push: about double a normal post, like content that is taking off.",
  custom: "Your own amounts: set them as a % of views (they follow the views if you change them) or as exact numbers.",
};

function linePrice(item: BundleItem, quantity: number, panel: Record<string, number>) {
  if (quantity <= 0) return 0;
  const set = panel[item.engagement_type];
  if (set > 0) return Math.max(1, Math.round((quantity / 1000) * set));
  const rate = item.price_per_10k_paise || item.price_per_1k_paise * 10;
  return Math.max(1, Math.round((quantity * rate) / 10000));
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-[#3b82f6]" : "bg-[#dbe4ee]"}`}
    >
      <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition ${on ? "left-5" : "left-0.5"}`} />
    </button>
  );
}

export function EngagementConsole() {
  const router = useRouter();
  const [bundles, setBundles] = useState<BundleRow[]>([]);
  const [platform, setPlatform] = useState<"instagram" | "tiktok">("instagram");
  const [link, setLink] = useState("");
  const [base, setBase] = useState(10000);
  const [custom, setCustom] = useState("10000");
  const [enabled, setEnabled] = useState<string[]>(ORDER_TYPES);
  const [sections, setSections] = useState<Record<string, boolean>>({ views: true, likes: true, saves: true, shares: true, reposts: true, comments: false });
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [pace, setPace] = useState<Record<string, Pace>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [runsOpen, setRunsOpen] = useState<string | null>(null);
  const [curves, setCurves] = useState<Record<string, number[]>>(() => {
    const weights = presetWeights("natural");
    return { views: weights, likes: weights, saves: weights, shares: weights, reposts: weights, comments: weights };
  });
  const [pattern, setPattern] = useState(223);
  const [picker, setPicker] = useState(false);
  const [family, setFamily] = useState<string>("random-walk");
  const algo = true;
  const [ratiosOn, setRatiosOn] = useState(true);
  const [qtyMode, setQtyMode] = useState<"percent" | "exact">("exact");
  const [pcts, setPcts] = useState<Record<string, number>>(() => mixCurve("recommended", 10000));
  const [pctText, setPctText] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(mixCurve("recommended", 10000)).map(([type, pct]) => [type, trimPct(pct)])));
  const [mixPreset, setMixPreset] = useState<"light" | "recommended" | "viral" | "custom">("recommended");
  const [savedRatios, setSavedRatios] = useState<Record<string, number>>(SETTINGS_RATIO_DEFAULTS);
  const [ask, setAsk] = useState(false);
  const [chat, setChat] = useState<{ role: "user" | "assistant"; text: string; apply?: boolean; mix?: Record<string, number> | null }[]>([]);
  const [aiPending, setAiPending] = useState(false);
  const [mixNote, setMixNote] = useState("");
  const [draft, setDraft] = useState("");
  const [floors, setFloors] = useState<Record<string, number>>({ views: 100, likes: 10, shares: 10, saves: 50, reposts: 10 });
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleStart] = useState(() => new Date());
  const [runDrafts, setRunDrafts] = useState<{ key: string; type: string; at: string; amount: string; on: boolean }[]>([]);
  const [panel, setPanel] = useState<Record<string, number>>({});
  const [qtyText, setQtyText] = useState<Record<string, string>>({});
  const [hourText, setHourText] = useState<Record<string, string>>({});
  const [runsText, setRunsText] = useState<Record<string, string>>({});
  const [intervalText, setIntervalText] = useState<Record<string, string>>({});
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState("");
  const [focusQty, setFocusQty] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    engagementFloors({ data: platform })
      .then((next) => setFloors((current) => ({ ...current, ...next })))
      .catch(() => undefined);
    engagementSections({ data: platform })
      .then((next) => setSections(next))
      .catch(() => undefined);
    panelRates({ data: platform })
      .then((next) => setPanel(next || {}))
      .catch(() => setPanel({}));
  }, [platform]);

  useEffect(() => {
    if (qtyMode === "percent" || mixPreset !== "custom" || !ratiosOn || base < 100) return;
    const mix = mixFromRatios(base, savedRatios, floors);
    setOverrides(mix);
    setQtyText({});
    const parts = Object.entries(mix).map(([type, qty]) => `${type} ${savedRatios[type]}% = ${qty.toLocaleString("en-IN")}`);
    setMixNote(parts.length ? `Settings ratios: ${parts.join(", ")}. Jo minimum se neeche tha, woh minimum pe chipak gaya.` : "Settings mein likes, saves, shares aur reposts 0% hain.");
  }, [base, ratiosOn, floors, savedRatios, qtyMode, mixPreset]);

  useEffect(() => {
    if (qtyMode !== "percent" && mixPreset === "custom") return;
    setOverrides((current) => {
      const next = { ...current };
      for (const [type, pct] of Object.entries(pcts)) {
        next[type] = Math.max(0, Math.round((base * pct) / 100));
      }
      return next;
    });
    setQtyText({});
  }, [qtyMode, base, pcts, mixPreset]);

  useEffect(() => {
    getCatalog()
      .then((catalog) => setBundles(catalog.bundles))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Catalog failed."));
    getWallet()
      .then((wallet) => setBalance(wallet.balance_paise))
      .catch(() => setBalance(0));
    getPrefs()
      .then((prefs) => {
        try {
          setSavedRatios({ ...SETTINGS_RATIO_DEFAULTS, ...JSON.parse(prefs.ratios_json || "{}") });
        } catch {
          setSavedRatios(SETTINGS_RATIO_DEFAULTS);
        }
      })
      .catch(() => setSavedRatios(SETTINGS_RATIO_DEFAULTS));
  }, []);

  const bundle = bundles.find((item) => item.platform === platform) ?? bundles[0];
  const sectionOn = (type: string) => sections[type] !== false && (type !== "comments" || sections.comments === true);
  const cards = (bundle?.items ?? []).filter((item) => ORDER_TYPES.includes(item.engagement_type) && sectionOn(item.engagement_type));
  const shown = cards;

  const qtyOf = (item: BundleItem) => {
    const on = enabled.includes(item.engagement_type);
    if (!on) return 0;
    const floor = floors[item.engagement_type] ?? (item.is_base ? 100 : 1);
    if (qtyMode === "percent" && !item.is_base && overrides[item.engagement_type] != null) {
      return Math.min(item.max_quantity, Math.max(0, lineQty(item, base, overrides)));
    }
    return Math.min(item.max_quantity, Math.max(floor, lineQty(item, base, overrides)));
  };

  const active = shown.filter((item) => enabled.includes(item.engagement_type));
  const billed = (type: string, fallback: number) => {
    const rows = runDrafts.filter((row) => row.type === type);
    if (!rows.length) return fallback;
    return rows.filter((row) => row.on).reduce((sum, row) => sum + Math.max(0, Math.floor(Number(row.amount) || 0)), 0);
  };
  const quantities = Object.fromEntries(active.map((item) => [item.engagement_type, billed(item.engagement_type, qtyOf(item))]));
  const totalPaise = active.reduce((sum, item) => sum + linePrice(item, billed(item.engagement_type, qtyOf(item)), panel), 0);
  const totalQty = active.reduce((sum, item) => sum + billed(item.engagement_type, qtyOf(item)), 0);
  const report = ratioReport(quantities);
  const canPay = balance >= totalPaise && totalPaise > 0;
  const schedule = mixDrops(
    active.map((item) => {
      const current = paceFor(item.engagement_type);
      const requested = chosenRuns(item.engagement_type, Math.max(qtyOf(item), 1));
      return {
        type: item.engagement_type,
        quantity: qtyOf(item),
        runs: requested,
        hours: paceHours(current, requested, base),
        curve: curves[item.engagement_type] ?? curves.views,
        variance: current.variance,
        peak: current.peak,
        min: floors[item.engagement_type],
        gapMinutes: current.intervalMode === "manual" && current.intervalMinutes >= 1
          ? current.intervalMinutes
          : undefined,
        lockRuns: current.runsMode === "manual" && current.runs >= 1,
      };
    }),
    scheduleStart,
  );
  const scheduleStamp = schedule.map((drop) => `${drop.type}|${drop.at.toISOString()}|${drop.amount}`).join("~");
  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;

  function localStamp(date: Date) {
    const pad = (part: number) => String(part).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  useEffect(() => {
    setRunDrafts(scheduleRef.current.map((drop, index) => ({
      key: `${drop.type}-${index}`,
      type: drop.type,
      at: localStamp(drop.at),
      amount: String(drop.amount),
      on: true,
    })));
  }, [scheduleStamp]);

  function patchRun(key: string, next: Partial<{ at: string; amount: string; on: boolean }>) {
    setRunDrafts((current) => current.map((row) => (row.key === key ? { ...row, ...next } : row)));
  }

  function setBaseQty(next: number) {
    const value = Math.max(100, Math.min(10_000_000, Math.floor(next) || 100));
    setBase(value);
    setCustom(String(value));
    setQtyText({});
    if (qtyMode !== "percent" && mixPreset === "custom") setRatiosOn(true);
  }

  function applyMixPreset(id: "light" | "recommended" | "viral") {
    const next = mixCurve(id, base);
    const text: Record<string, string> = {};
    for (const [type, pct] of Object.entries(next)) text[type] = trimPct(pct);
    setPcts(next);
    setPctText(text);
    setRatiosOn(false);
    setMixPreset(id);
  }

  useEffect(() => {
    if (mixPreset === "custom") return;
    const next = mixCurve(mixPreset, base);
    const text: Record<string, string> = {};
    for (const [type, pct] of Object.entries(next)) text[type] = trimPct(pct);
    setPcts(next);
    setPctText(text);
  }, [base, mixPreset]);

  function paceFor(type: string): Pace {
    return pace[type] ?? DEFAULT_PACE;
  }

  function chosenRuns(type: string, quantity: number) {
    const chunk = floors[type] ?? PROVIDER_MIN[type] ?? 10;
    const max = quantity > chunk ? Math.max(1, Math.floor(quantity / (chunk + 1))) : 1;
    const raw = runsText[type];
    if (raw != null && raw !== "") {
      const typed = Math.floor(Number(raw));
      if (typed >= 1 && typed <= max) return typed;
    }
    const current = paceFor(type);
    if (current.runsMode === "manual" && current.runs > 0) return Math.min(max, current.runs);
    return autoRuns(Math.max(quantity, 1), type);
  }

  function applyWindow(type: string, next: Partial<Pace>) {
    patchPace(type, next, next.window === "auto" ? "other" : "window");
  }

  function patchPace(type: string, next: Partial<Pace>, source: "runs" | "interval" | "window" | "other" = "other") {
    const prev = paceFor(type);
    const quantity = Math.max(1, Number(quantities[type] ?? prev.runs) || 1);
    const chunk = floors[type] ?? PROVIDER_MIN[type] ?? 10;
    const maxRuns = quantity > chunk ? Math.max(1, Math.floor(quantity / (chunk + 1))) : 1;
    const runsNow = next.runsMode === "manual" && (next.runs || 0) >= 1
      ? Number(next.runs)
      : prev.runsMode === "manual" && prev.runs >= 1 ? prev.runs : autoRuns(quantity, type);
    const linked = linkPace(prev, next, source, Math.min(maxRuns, Math.max(1, runsNow)), maxRuns);
    setPace((current) => ({ ...current, [type]: linked }));
    if (linked.window === "custom") setHourText((current) => ({ ...current, [type]: String(linked.customHours || "") }));
    if (source === "window" && linked.runsMode === "manual") setRunsText((current) => ({ ...current, [type]: String(linked.runs || "") }));
    if (source !== "interval" && linked.intervalMode === "manual") setIntervalText((current) => ({ ...current, [type]: String(linked.intervalMinutes || "") }));
  }

  function applyMix(mix?: Record<string, number> | null) {
    const next = mix && Object.keys(mix).length ? mix : mixFromRatios(base, savedRatios, floors);
    setOverrides((current) => ({ ...current, ...next }));
    setQtyText({});
    setEnabled((current) => Array.from(new Set([...current, "likes", "shares", "reposts", "saves"])));
    return next;
  }

  function applyOrganicOrder(plan: { views?: number; mix?: Record<string, number>; variance?: number; window?: Pace["window"] }) {
    const views = Math.max(100, plan.views || base);
    if (plan.views && plan.views >= 100) {
      setBase(plan.views);
      setCustom(String(plan.views));
    }
    const mix = plan.mix ?? {};
    setOverrides((current) => ({ ...current, ...mix }));
    setQtyText({});
    setQtyMode("exact");
    setMixPreset("custom");
    setRatiosOn(false);
    const on = ["views", ...Object.entries(mix).filter(([, qty]) => qty > 0).map(([type]) => type)];
    setEnabled((current) => Array.from(new Set([...current, ...on])));
    setRunsText({});
    setIntervalText({});
    setHourText({});
    setPace(() => {
      const next: Record<string, Pace> = {};
      for (const type of ["views", "likes", "comments", "shares", "saves", "reposts"]) {
        next[type] = { ...DEFAULT_PACE, window: plan.window ?? "auto", variance: plan.variance ?? DEFAULT_PACE.variance };
      }
      return next;
    });
    return views;
  }

  async function askOrganic(question: string) {
    const text = question.trim();
    if (!text || aiPending) return;
    const viewsPace = paceFor("views");
    const runs = viewsPace.runsMode === "manual" && viewsPace.runs > 0 ? viewsPace.runs : autoRuns(Math.max(quantities.views || base, 1), "views");
    const hours = paceHours(viewsPace, runs, base);
    const finish = new Date(Date.now() + hours * 3600 * 1000).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    setChat((current) => [...current, { role: "user", text }]);
    setDraft("");
    const plan = planOrganicAsk(text, { views: base, quantities, ratios: savedRatios, botting: report.botting });
    if (plan?.mode === "order") {
      applyOrganicOrder(plan);
      setChat((current) => [...current, { role: "assistant", text: plan.text }]);
      return;
    }
    setAiPending(true);
    const local = () => answerOrganic(text, { quantities, health: report.health, botting: report.botting, hours, runs, peak: viewsPace.peak, finish, ratios: savedRatios });
    try {
      const result = await askPanelAi({
        data: {
          question: text,
          context: `Link pasted: ${/^https?:\/\//.test(link.trim())}. Views ${quantities.views || base}, likes ${quantities.likes || 0}, shares ${quantities.shares || 0}, saves ${quantities.saves || 0}, reposts ${quantities.reposts || 0}. Health ${report.health}/100. Botting risk ${report.botting}%. Runs ${runs}. Window ${hours.toFixed(1)} hours. Peak ${viewsPace.peak ? "on" : "off"}. Finish ${finish}.`,
        },
      });
      setChat((current) => [...current, { role: "assistant", text: result.text, apply: result.apply, mix: result.mix }]);
    } catch {
      setChat((current) => [...current, { role: "assistant", text: local(), apply: /ratio|suggest|best|mix/i.test(text) }]);
    } finally {
      setAiPending(false);
    }
  }

  function openAssistant() {
    const linkReady = /^https?:\/\//.test(link.trim());
    setChat([{ role: "assistant", text: organicOpening({ linkReady, quantities, botting: report.botting }) }]);
    setDraft("");
    setAsk(true);
  }

  async function submit() {
    if (!bundle) return;
    setError("");
    if (!/^https?:\/\//.test(link.trim())) {
      setError("Please enter a valid link.");
      return;
    }
    const sensed = sensePlatform(link);
    if (sensed && sensed !== platform) {
      setPlatform(sensed);
      setError(sensed === "tiktok" ? "This link is TikTok. TikTok is selected now. Place the order again." : "This link is Instagram. Instagram is selected now. Place the order again.");
      return;
    }
    if (enabled.includes("views") && (!custom || Number(custom) < (floors.views || 100))) {
      setError(`Below ${floors.views || 100} not allowed.`);
      return;
    }
    if (active.length === 0) {
      setError("Turn on at least one service.");
      return;
    }
    for (const item of active) {
      const floor = floors[item.engagement_type] ?? (item.is_base ? 100 : 1);
      const raw = qtyText[item.engagement_type];
      if (raw !== undefined && (raw === "" || Number(raw) < floor)) {
        setError(`Below ${floor} not allowed.`);
        return;
      }
      const current = paceFor(item.engagement_type);
      if (current.window === "custom") {
        const hoursRaw = hourText[item.engagement_type] ?? String(current.customHours || "");
        if (hoursRaw === "" || Number(hoursRaw) < 1) {
          setError("Below 1 not allowed.");
          return;
        }
      }
      if (current.runsMode === "manual") {
        const runsRaw = runsText[item.engagement_type] ?? String(current.runs || "");
        const chunk = floors[item.engagement_type] ?? 10;
        const maxRuns = qtyOf(item) > chunk ? Math.max(1, Math.floor(qtyOf(item) / (chunk + 1))) : 1;
        if (runsRaw === "" || Number(runsRaw) < 1) {
          setError("Below 1 not allowed.");
          return;
        }
        if (Number(runsRaw) > maxRuns) {
          setError(`Above ${maxRuns} not allowed.`);
          return;
        }
      }
      if (current.intervalMode === "manual") {
        const gapRaw = intervalText[item.engagement_type] ?? String(current.intervalMinutes || "");
        if (gapRaw === "" || Number(gapRaw) < 1) {
          setError("Below 1 not allowed.");
          return;
        }
        if (Number(gapRaw) > 10080) {
          setError("Above 10080 minutes not allowed.");
          return;
        }
      }
    }
    if (!canPay) {
      setError("Insufficient balance.");
      return;
    }
    setPending(true);
    try {
      const source = runDrafts.length
        ? runDrafts
        : schedule.map((drop, index) => ({ key: `${drop.type}-${index}`, type: drop.type, at: localStamp(drop.at), amount: String(drop.amount), on: true }));
      const orderQuantities = Object.fromEntries(
        active
          .map((item) => {
            const rows = source.filter((row) => row.type === item.engagement_type && row.on);
            const qty = rows.length ? rows.reduce((sum, row) => sum + Math.max(0, Math.floor(Number(row.amount) || 0)), 0) : qtyOf(item);
            return [item.engagement_type, qty] as const;
          })
          .filter((entry) => entry[1] > 0),
      );
      const drops = source
        .filter((row) => row.on && orderQuantities[row.type] > 0)
        .map((row) => ({ type: row.type, amount: Math.floor(Number(row.amount) || 0), at: new Date(row.at).toISOString() }))
        .filter((row) => row.amount > 0 && !Number.isNaN(new Date(row.at).getTime()));
      if (drops.length === 0) {
        setError("Kam se kam ek run on rakho.");
        return;
      }
      for (const drop of drops) {
        const floor = floors[drop.type] ?? 1;
        if (drop.amount < floor) {
          setError(`Below ${floor} not allowed for ${drop.type}.`);
          return;
        }
      }
      const viewsPace = paceFor("views");
      const delivery: Record<string, { hours: number; runs: number; variance: number; peak: boolean; curve: number[] }> = {};
      for (const item of active) {
        if (!orderQuantities[item.engagement_type]) continue;
        const current = paceFor(item.engagement_type);
        const lineRuns = chosenRuns(item.engagement_type, Math.max(quantities[item.engagement_type] || base, 1));
        delivery[item.engagement_type] = {
          hours: paceHours(current, lineRuns, base),
          runs: lineRuns,
          variance: current.variance,
          peak: current.peak,
          curve: curves[item.engagement_type] ?? curves.views ?? [0.02, 1],
        };
      }
      const viewsRuns = delivery.views?.runs ?? autoRuns(quantities.views || base, "views");
      await placeOrder({
        data: {
          bundleId: bundle.id,
          link: link.trim(),
          baseQuantity: base,
          organic: algo,
          intervalHours: Math.max(1, Math.round(paceGapMinutes(viewsPace, viewsRuns, base) / 60)),
          variancePercent: viewsPace.variance,
          enabledTypes: Object.keys(orderQuantities),
          quantities: orderQuantities,
          delivery,
          drops,
        },
      });
      await router.navigate({ to: "/engagement-orders" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Order failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-24">
      <section className="rounded-[24px] border border-[#e7eef6] bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
          <Rocket className="size-4 text-[#64748b]" /> Select Platform
        </h2>
        <div className="flex gap-2">
          <PlatformButton active={platform === "instagram"} onClick={() => setPlatform("instagram")} icon={<Instagram className="size-4" />} label="INSTAGRAM" gradient="from-emerald-400 via-teal-400 to-violet-500" />
          <PlatformButton active={platform === "tiktok"} onClick={() => setPlatform("tiktok")} icon={<Music2 className="size-4" />} label="TIKTOK" gradient="from-cyan-300 to-emerald-300" />
        </div>
      </section>

      <section className="rounded-[24px] border border-[#e7eef6] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Link2 className="size-4 text-[#64748b]" /> Video/Post Link
          </h2>
          <button type="button" onClick={openAssistant} className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[12px] font-semibold text-amber-700">
            <Sparkles className="size-3.5" /> Ask AI
          </button>
        </div>
        <input
          value={link}
          onChange={(event) => {
            const next = event.target.value;
            setLink(next);
            const sensed = sensePlatform(next);
            if (sensed) setPlatform(sensed);
          }}
          placeholder={platform === "tiktok" ? "https://tiktok.com/..." : "https://instagram.com/..."}
          className="h-12 w-full rounded-2xl border border-transparent bg-[#eef5fb] px-4 text-[14px] outline-none focus:border-[#93c5fd]"
        />
      </section>

      <section className="rounded-[24px] border border-[#e7eef6] bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
          <Eye className="size-4 text-[#64748b]" /> Base Views Quantity
        </h2>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setBaseQty(preset)}
              className={`h-10 min-w-14 rounded-xl px-3 text-[13px] font-semibold ${base === preset ? "bg-[#111827] text-white" : "bg-[#f3f6fa] text-[#334155]"}`}
            >
              {preset >= 1000000 ? "1M" : `${preset / 1000}K`}
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-[13px] text-[#64748b]">
          or custom:
          <input
            value={focusQty === "views-custom" ? custom : String(billed("views", Number(custom) || base))}
            inputMode="numeric"
            onFocus={() => {
              setFocusQty("views-custom");
              setCustom(String(billed("views", Number(custom) || base)));
            }}
            onBlur={() => setFocusQty(null)}
            onChange={(event) => {
              const raw = event.target.value.replace(/[^\d]/g, "");
              setCustom(raw);
              const next = Number(raw);
              if (next >= (floors.views || 100)) setBaseQty(Math.min(10_000_000, next));
            }}
            className="h-10 w-28 rounded-xl bg-[#eef5fb] px-3 font-semibold text-[#0f172a] outline-none"
          />
          views
        </label>
        {custom !== "" && Number(custom) < (floors.views || 100) && <p className="mt-2 text-[12px] font-semibold text-rose-600">Below {floors.views || 100} not allowed</p>}
        {mixNote && custom !== "" && Number(custom) >= (floors.views || 100) && <p className="mt-2 text-[12px] text-[#1d4ed8]">{mixNote}</p>}
      </section>

      <section>
        <div className="mb-2 flex items-end justify-between">
          <div>
            <h2 className="text-[18px] font-semibold">Engagement Breakdown</h2>
            <p className="text-[13px] text-[#64748b]">Customize organic settings per type</p>
          </div>
          <span className="rounded-full bg-[#111827] px-3 py-1 text-[12px] font-semibold text-white">{active.length} active</span>
        </div>
        <div className="mb-2 grid grid-cols-3 gap-2">
          {([
            ["light", "Light"],
            ["recommended", "Recommended"],
            ["viral", "Viral push"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => applyMixPreset(id)} className={`h-11 rounded-2xl px-1 text-[11px] font-semibold sm:text-[13px] ${mixPreset === id ? "bg-[#111827] text-white" : "bg-[#f3f6fa] text-[#334155]"}`}>
              {label}{id === "recommended" && <span className="ml-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white">BEST</span>}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setMixPreset("custom")} className={`mb-2 h-10 rounded-2xl px-4 text-[13px] font-semibold ${mixPreset === "custom" ? "bg-[#111827] text-white" : "bg-[#f3f6fa] text-[#334155]"}`}>Your own amounts</button>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => {
            if (mixPreset === "custom") {
              const next: Record<string, number> = {};
              const text: Record<string, string> = {};
              for (const row of shown) {
                if (row.is_base) continue;
                const qty = qtyOf(row);
                const pct = Math.round((qty / Math.max(base, 1)) * 10000) / 100;
                next[row.engagement_type] = pct;
                text[row.engagement_type] = trimPct(pct);
              }
              setPcts((current) => ({ ...current, ...next }));
              setPctText((current) => ({ ...current, ...text }));
            }
            setRatiosOn(false);
            setQtyMode("percent");
          }} className={`h-11 rounded-2xl text-[13px] font-semibold ${qtyMode === "percent" ? "bg-[#111827] text-white" : "bg-[#f3f6fa] text-[#334155]"}`}>% of views</button>
          <button type="button" onClick={() => { setQtyMode("exact"); setRatiosOn(false); setQtyText({}); }} className={`h-11 rounded-2xl text-[13px] font-semibold ${qtyMode === "exact" ? "bg-[#111827] text-white" : "bg-[#f3f6fa] text-[#334155]"}`}>Exact number</button>
        </div>
        <p className="mb-3 text-[12px] text-[#64748b]">{MIX_COPY[mixPreset]}</p>
        <div className="space-y-3">
          {shown.map((item) => {
            const on = enabled.includes(item.engagement_type);
            const quantity = on ? billed(item.engagement_type, qtyOf(item)) : 0;
            const requested = chosenRuns(item.engagement_type, Math.max(quantity, 1));
            const currentPace = paceFor(item.engagement_type);
            const hours = paceHours(currentPace, requested, base);
            const manual = (runsText[item.engagement_type] != null && runsText[item.engagement_type] !== "") || currentPace.runsMode === "manual";
            const gapMinutes = currentPace.intervalMode === "manual" && currentPace.intervalMinutes >= 1
              ? currentPace.intervalMinutes
              : paceGapMinutes({ ...currentPace, intervalMode: "auto", intervalMinutes: 0 }, requested, base);
            const rows = planDrops({
              quantity,
              type: item.engagement_type,
              runs: requested,
              hours,
              curve: curves[item.engagement_type] ?? curves.views,
              variance: currentPace.variance,
              peak: currentPace.peak,
              min: floors[item.engagement_type],
              gapMinutes,
              lockRuns: manual,
            });
            const runs = manual ? requested : (rows.length || requested);
            const floor = floors[item.engagement_type] ?? (item.is_base ? 100 : 1);
            const qtyRaw = item.is_base ? custom : (qtyText[item.engagement_type] ?? String(quantity));
            const Icon = ICONS[item.engagement_type] ?? Eye;
            const tone = TYPE_TONE[item.engagement_type] ?? TYPE_TONE.views;
            const risk = riskLabel(currentPace.variance);
            const low = rows.length ? Math.min(...rows.map((row) => row.amount)) : 0;
            const high = rows.length ? Math.max(...rows.map((row) => row.amount)) : 0;
            const average = rows.length ? quantity / rows.length : 0;
            const spreadDown = Math.max(0, Math.round(average - low));
            const spreadUp = Math.max(0, Math.round(high - average));
            const chunk = floors[item.engagement_type] ?? PROVIDER_MIN[item.engagement_type] ?? 10;
            const maxRuns = quantity > chunk ? Math.max(1, Math.floor(quantity / (chunk + 1))) : 1;
            const usePercent = qtyMode === "percent" && !item.is_base;
            const pctShown = pctText[item.engagement_type] ?? trimPct(pcts[item.engagement_type] ?? (base > 0 ? (quantity / base) * 100 : 0));
            return (
              <article key={item.engagement_type} className="rounded-[24px] border border-[#e7eef6] bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className={`size-4 ${tone.icon}`} />
                      <p className={`font-semibold ${tone.title}`}>{item.name.replace(/^(Stage|House|Aisle|Pocket|Cue) /, "") || item.engagement_type}</p>
                      {item.is_base && <span className="rounded bg-[#111827] px-1.5 py-0.5 text-[9px] font-bold text-white">BASE</span>}
                    </div>
                    <p className="mt-1 text-[11px] font-semibold tracking-wide text-[#3b82f6]">
                      <Sparkles className="mr-1 inline size-3" />
                      {runs} RUNS · {formatDuration(hours).replace("~", "~").toUpperCase()} · min {chunk}/order
                    </p>
                    <p className="text-[11px] text-[#94a3b8]">Min: {(floors[item.engagement_type] ?? item.min_quantity).toLocaleString("en-IN")} • Max: {item.max_quantity.toLocaleString("en-IN")} • {panel[item.engagement_type] ? `${inr(panel[item.engagement_type])} / 1k` : "Bundle rate"}</p>
                  </div>
                  <input
                    disabled={!on}
                    value={usePercent ? pctShown : (focusQty === item.engagement_type ? qtyRaw : String(quantity))}
                    inputMode={usePercent ? "decimal" : "numeric"}
                    onFocus={() => {
                      setFocusQty(item.engagement_type);
                      if (usePercent) {
                        setPctText((current) => ({ ...current, [item.engagement_type]: pctShown }));
                        return;
                      }
                      const shownQty = String(quantity);
                      if (item.is_base) setCustom(shownQty);
                      else setQtyText((current) => ({ ...current, [item.engagement_type]: shownQty }));
                    }}
                    onBlur={() => {
                      setFocusQty(null);
                      if (!usePercent) return;
                      const next = Math.min(100, Math.max(0, Number(pctText[item.engagement_type]) || 0));
                      setPcts((current) => ({ ...current, [item.engagement_type]: next }));
                      setPctText((current) => ({ ...current, [item.engagement_type]: trimPct(next) }));
                    }}
                    onChange={(event) => {
                      if (usePercent) {
                        const raw = event.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
                        setPctText((current) => ({ ...current, [item.engagement_type]: raw }));
                        setRatiosOn(false);
                        setMixPreset("custom");
                        if (raw === "" || raw === ".") {
                          setPcts((current) => ({ ...current, [item.engagement_type]: 0 }));
                          return;
                        }
                        const next = Number(raw);
                        if (!Number.isNaN(next)) setPcts((current) => ({ ...current, [item.engagement_type]: Math.min(100, Math.max(0, next)) }));
                        return;
                      }
                      const raw = event.target.value.replace(/[^\d]/g, "");
                      if (item.is_base) {
                        setCustom(raw);
                        const next = Number(raw);
                        if (raw !== "" && next >= floor) setBaseQty(Math.min(10_000_000, next));
                        return;
                      }
                      setQtyText((current) => ({ ...current, [item.engagement_type]: raw }));
                      setRatiosOn(false);
                      setMixPreset("custom");
                      const next = Number(raw);
                      if (raw !== "" && next >= floor) {
                        setOverrides((current) => ({ ...current, [item.engagement_type]: Math.min(item.max_quantity, next) }));
                      }
                    }}
                    className="h-10 w-20 rounded-full border border-[#e7eef6] bg-white text-center text-[13px] font-semibold outline-none"
                  />
                  {usePercent && <span className="text-[12px] font-bold text-[#c4b5fd]">%</span>}
                  <span className="w-16 text-right text-[13px] font-semibold text-[#64748b]">{on ? inr(linePrice(item, quantity, panel)) : "—"}</span>
                  <Switch
                    on={on}
                    onClick={() => {
                      setEnabled((current) => current.includes(item.engagement_type) ? current.filter((type) => type !== item.engagement_type) : [...current, item.engagement_type]);
                    }}
                  />
                </div>
                {on && !item.is_base && (
                  <p className="mt-2 text-[12px] font-semibold text-[#67e8f9]">
                    {qtyMode === "percent" ? `= ${quantity.toLocaleString("en-IN")} ${item.engagement_type}` : `= ${trimPct(base > 0 ? (quantity / base) * 100 : 0)}% of views`}
                  </p>
                )}
                {on && !item.is_base && REAL_BAND[item.engagement_type] && (
                  <p className="mt-1 text-[12px] text-[#94a3b8]">
                    Real posts: {REAL_BAND[item.engagement_type]} · suggested {Math.round((base * (mixCurve("recommended", base)[item.engagement_type] ?? 0)) / 100).toLocaleString("en-IN")}
                  </p>
                )}
                {on && qtyRaw !== "" && Number(qtyRaw) < floor && <p className="mt-2 text-[12px] font-semibold text-rose-600">Below {floor} not allowed</p>}
                <button type="button" onClick={() => setOpen(open === item.engagement_type ? null : item.engagement_type)} className="mx-auto mt-3 flex items-center gap-1 text-[11px] font-semibold tracking-wide text-[#94a3b8]">
                  <Settings2 className="size-3" /> SETTINGS {open === item.engagement_type ? "▴" : "▾"}
                </button>
                {open === item.engagement_type && (
                  <div className="mt-3 space-y-3 border-t border-[#eef2f6] pt-3 text-[13px]">
                    <p className="text-[11px] font-semibold tracking-wide text-[#94a3b8]">DELIVERY TIME</p>
                    <div className="flex flex-wrap gap-2">
                      {(["auto", "6h", "12h", "24h", "48h", "custom"] as const).map((window) => (
                        <button key={window} type="button" onClick={() => applyWindow(item.engagement_type, { window })} className={`rounded-full px-3 py-1 text-[12px] font-semibold ${paceFor(item.engagement_type).window === window ? "bg-[#111827] text-white" : "bg-[#f3f6fa]"}`}>
                          {window === "auto" ? "Auto" : window === "custom" ? "Custom" : window}
                        </button>
                      ))}
                    </div>
                    {paceFor(item.engagement_type).window === "custom" && (
                      <label className="block">
                        <span className="flex items-center gap-2">
                          <input
                            inputMode="numeric"
                            value={hourText[item.engagement_type] ?? String(paceFor(item.engagement_type).customHours || "")}
                            placeholder="hours"
                            onChange={(event) => {
                              const raw = event.target.value.replace(/[^\d]/g, "");
                              setHourText((current) => ({ ...current, [item.engagement_type]: raw }));
                              const next = Number(raw);
                              if (raw !== "" && next >= 1) applyWindow(item.engagement_type, { window: "custom", customHours: Math.min(24 * 30, next) });
                            }}
                            className="h-10 w-24 rounded-xl bg-[#f3f6fa] px-3 text-[14px] font-semibold outline-none"
                          />
                          <span className="text-[12px] text-[#64748b]">hours. This line finishes in {formatDuration(hours).replace("~", "")}.</span>
                        </span>
                        {(hourText[item.engagement_type] ?? "") !== "" && Number(hourText[item.engagement_type]) < 1 && <p className="mt-1 text-[12px] font-semibold text-rose-600">Below 1 not allowed</p>}
                      </label>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold tracking-wide text-[#94a3b8]">NUMBER OF RUNS</p>
                      <p className="text-[11px] text-[#94a3b8]">max {maxRuns} ({quantity.toLocaleString("en-IN")} ÷ {quantity > chunk ? chunk + 1 : chunk})</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => { setRunsText((current) => { const next = { ...current }; delete next[item.engagement_type]; return next; }); patchPace(item.engagement_type, { runsMode: "auto", runs: 0 }); }} className={`h-10 rounded-xl px-4 font-semibold ${manual ? "bg-[#f3f6fa] text-[#334155]" : "bg-[#111827] text-white"}`}>Auto</button>
                      <input
                        inputMode="numeric"
                        value={runsText[item.engagement_type] ?? (manual ? String(paceFor(item.engagement_type).runs || "") : "")}
                        placeholder={manual ? "runs" : `${runs} runs (auto)`}
                        onChange={(event) => {
                          const raw = event.target.value.replace(/[^\d]/g, "");
                          setRunsText((current) => ({ ...current, [item.engagement_type]: raw }));
                          const next = Number(raw);
                          if (raw !== "" && next >= 1 && next <= maxRuns) patchPace(item.engagement_type, { runsMode: "manual", runs: next }, "runs");
                          else patchPace(item.engagement_type, { runsMode: "manual", runs: 0 }, "runs");
                        }}
                        className="h-10 min-w-0 flex-1 rounded-xl bg-[#f3f6fa] px-3 font-semibold text-[#0f172a] outline-none placeholder:font-medium placeholder:text-[#94a3b8]"
                      />
                    </div>
                    {runsText[item.engagement_type] !== undefined && runsText[item.engagement_type] !== "" && Number(runsText[item.engagement_type]) < 1 && <p className="text-[12px] font-semibold text-rose-600">Below 1 not allowed</p>}
                    {runsText[item.engagement_type] !== undefined && Number(runsText[item.engagement_type]) > maxRuns && <p className="text-[12px] font-semibold text-rose-600">Above {maxRuns} not allowed</p>}
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold tracking-wide text-[#94a3b8]">INTERVAL</p>
                      <p className="text-[11px] text-[#94a3b8]">minutes between runs</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => { setIntervalText((current) => { const next = { ...current }; delete next[item.engagement_type]; return next; }); patchPace(item.engagement_type, { intervalMode: "auto", intervalMinutes: 0 }); }} className={`h-10 rounded-xl px-4 font-semibold ${currentPace.intervalMode === "manual" ? "bg-[#f3f6fa] text-[#334155]" : "bg-[#111827] text-white"}`}>Auto</button>
                      <input
                        inputMode="numeric"
                        value={intervalText[item.engagement_type] ?? (currentPace.intervalMode === "manual" ? String(currentPace.intervalMinutes || "") : "")}
                        placeholder={`${paceGapMinutes({ ...currentPace, intervalMode: "auto", intervalMinutes: 0 }, requested, base)} min (auto)`}
                        onChange={(event) => {
                          const raw = event.target.value.replace(/[^\d]/g, "");
                          setIntervalText((current) => ({ ...current, [item.engagement_type]: raw }));
                          const next = Number(raw);
                          if (raw !== "" && next >= 1 && next <= 10080) patchPace(item.engagement_type, { intervalMode: "manual", intervalMinutes: next }, "interval");
                          else patchPace(item.engagement_type, { intervalMode: "manual", intervalMinutes: 0 }, "interval");
                        }}
                        className="h-10 min-w-0 flex-1 rounded-xl bg-[#f3f6fa] px-3 font-semibold text-[#0f172a] outline-none placeholder:font-medium placeholder:text-[#94a3b8]"
                      />
                    </div>
                    {intervalText[item.engagement_type] !== undefined && intervalText[item.engagement_type] !== "" && Number(intervalText[item.engagement_type]) < 1 && <p className="text-[12px] font-semibold text-rose-600">Below 1 not allowed</p>}
                    {intervalText[item.engagement_type] !== undefined && Number(intervalText[item.engagement_type]) > 10080 && <p className="text-[12px] font-semibold text-rose-600">Above 10080 minutes not allowed</p>}
                    <p className="text-[11px] text-[#94a3b8]">{currentPace.runsMode === "manual" && currentPace.runs >= 1 && currentPace.intervalMode === "manual" && currentPace.intervalMinutes >= 1 ? `${currentPace.runs} runs × ${currentPace.intervalMinutes} min = ${formatDuration((currentPace.runs * currentPace.intervalMinutes) / 60).replace("~", "")}.` : currentPace.window === "auto" ? "Set runs and an interval, and the delivery time follows. Or pick a delivery time and runs plus interval follow it." : `Finishes in ${formatDuration(hours).replace("~", "")}. Runs and interval follow this time.`}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold tracking-wide text-[#94a3b8]">RANDOM VARIANCE</p>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">±{paceFor(item.engagement_type).variance}%</span>
                    </div>
                    <input type="range" min={10} max={50} value={paceFor(item.engagement_type).variance} onChange={(event) => patchPace(item.engagement_type, { variance: Number(event.target.value) })} className="w-full accent-amber-500" />
                    <div className={`rounded-2xl border p-3 ${risk.tone === "amber" ? "border-amber-200 bg-amber-50" : risk.tone === "rose" ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
                      <div className="mb-2 flex items-center justify-between font-semibold">
                        <span>Detection Risk</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px]">{risk.label}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white">
                        <div className={`h-full rounded-full ${risk.tone === "rose" ? "bg-rose-500" : risk.tone === "emerald" ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${Math.min(100, paceFor(item.engagement_type).variance * 1.6)}%` }} />
                      </div>
                      <p className={`mt-2 text-[12px] ${risk.tone === "rose" ? "text-rose-700" : risk.tone === "emerald" ? "text-emerald-700" : "text-amber-700"}`}>{risk.hint}</p>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-[#f8fafc] px-3 py-2">
                      <span>Per run:</span>
                      <span>-{spreadDown.toLocaleString("en-IN")} to +{spreadUp.toLocaleString("en-IN")}</span>
                    </div>
                    <div
                      role="switch"
                      aria-checked={paceFor(item.engagement_type).peak}
                      onClick={() => patchPace(item.engagement_type, { peak: !paceFor(item.engagement_type).peak })}
                      className={`flex w-full cursor-pointer items-center justify-between rounded-2xl px-3 py-2 text-left ${paceFor(item.engagement_type).peak ? "bg-amber-50 ring-1 ring-amber-200" : "bg-[#f4f7fb]"}`}
                    >
                      <div>
                        <p className="flex items-center gap-1 text-[12px] font-semibold tracking-wide text-[#334155]">
                          <Lock className="size-3.5" /> PEAK HOURS BOOST
                          {paceFor(item.engagement_type).peak && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">ON</span>}
                        </p>
                        <p className="text-[11px] text-[#94a3b8]">{paceFor(item.engagement_type).peak ? "Bigger drops between 6–11 PM IST" : "More during 6-11 PM IST"}</p>
                      </div>
                      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${paceFor(item.engagement_type).peak ? "bg-[#3b82f6]" : "bg-[#dbe4ee]"}`}>
                        <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition ${paceFor(item.engagement_type).peak ? "left-5" : "left-0.5"}`} />
                      </span>
                    </div>
                    <div className="rounded-2xl bg-[#f8fafc] p-3">
                      <p className="mb-2 flex items-center gap-1 font-semibold"><Calendar className="size-4" /> Schedule Preview</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <Stat n={String(runs)} l="orders" />
                        <Stat n={formatDuration((currentPace.intervalMode === "manual" && currentPace.intervalMinutes >= 1 ? currentPace.intervalMinutes : paceGapMinutes({ ...currentPace, intervalMode: "auto", intervalMinutes: 0 }, runs, base)) / 60)} l="interval" />
                        <Stat n={rows[rows.length - 1]?.at.toLocaleString("en-IN", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) ?? ""} l="finish" />
                      </div>
                      <button type="button" onClick={() => setRunsOpen(runsOpen === item.engagement_type ? null : item.engagement_type)} className="mt-3 flex w-full items-center justify-center gap-1 text-[12px] font-semibold text-[#64748b]">
                        <span className="tracking-widest text-[#cbd5e1]">≡</span> {runs} YoYoMedia orders {runsOpen === item.engagement_type ? "▴" : "▾"}
                      </button>
                      {runsOpen === item.engagement_type && (
                        <ol className="mt-2 max-h-56 space-y-2 overflow-auto text-[12px]">
                          {rows.map((row, index) => (
                            <li key={index} className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-2">
                                <span className="grid size-5 place-items-center rounded-full bg-[#111827] text-[10px] font-bold text-white">{index + 1}</span>
                                {index === 0 ? "places now" : row.at.toLocaleString("en-IN", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                              </span>
                              <span className="font-semibold text-[#0f172a]">+{row.amount.toLocaleString("en-IN")}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <Delivery
          pattern={pattern}
          picker={picker}
          family={family}
          onFamily={setFamily}
          onTogglePicker={() => setPicker((value) => !value)}
          onPattern={(id) => {
            setPattern(id);
            setFamily(growthTemplate(id).name);
            setPicker(false);
          }}
          onNew={() => {
            const next = 1 + Math.floor(Math.random() * TEMPLATE_COUNT);
            setPattern(next);
            setFamily(growthTemplate(next).name);
          }}
          quantities={quantities}
          pace={pace}
          curves={curves}
          drops={runDrafts.filter((row) => row.on).map((row) => ({
            type: row.type,
            at: new Date(row.at).getTime(),
            amount: Math.max(0, Math.floor(Number(row.amount) || 0)),
          }))}
          schedule={(
            <div className="mt-3 overflow-hidden rounded-2xl border border-[#e7eef6]">
              <button type="button" onClick={() => setScheduleOpen((open) => !open)} className="flex h-12 w-full items-center justify-center gap-2 text-[14px] font-semibold text-[#1f2937]">
                <span className="text-[#64748b]">{scheduleOpen ? "⌃" : "⌄"}</span>
                {scheduleOpen ? "Hide" : "Show"} Schedule ({runDrafts.filter((row) => row.on).length}/{schedule.length})
              </button>
              {scheduleOpen && (
                <div className="max-h-[420px] space-y-2 overflow-auto px-3 pb-3">
                  <p className="px-1 text-[11px] text-[#64748b]">A tick means the run is on and will be placed. An empty box means the run is off and will not be placed.</p>
                  {runDrafts.slice(0, 80).map((row) => {
                    const Icon = ICONS[row.type] ?? Eye;
                    const tone = TYPE_TONE[row.type] ?? TYPE_TONE.views;
                    const when = new Date(row.at);
                    let running = 0;
                    for (const item of runDrafts) {
                      if (item.type !== row.type || !item.on) continue;
                      if (item.at > row.at || (item.at === row.at && item.key > row.key)) continue;
                      running += Math.max(0, Math.floor(Number(item.amount) || 0));
                    }
                    return (
                      <div key={row.key} className={`flex flex-wrap items-center gap-2 rounded-2xl bg-[#e7f6ee] px-3 py-2 ${row.on ? "" : "opacity-50"}`}>
                        <button type="button" role="checkbox" aria-checked={row.on} aria-label={row.on ? "Run on" : "Run off"} onClick={() => patchRun(row.key, { on: !row.on })} className={`grid size-6 shrink-0 place-items-center rounded-[6px] border ${row.on ? "border-[#f97316] bg-[#f97316] text-white" : "border-[#94a3b8] bg-white text-transparent"}`}>
                          <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.6">
                            <path d="M4 10.5 8 14.5 16 5.5" />
                          </svg>
                        </button>
                        <input type="datetime-local" disabled={!row.on} value={row.at} onChange={(event) => patchRun(row.key, { at: event.target.value })} className="h-8 w-[168px] rounded-lg border border-[#d7e7de] bg-white px-2 text-[12px] text-[#334155] disabled:opacity-60" />
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#111827] px-2 py-1 text-[12px] font-bold text-white">
                          <Icon className={`size-3.5 ${tone.icon}`} />
                          <input value={row.amount} disabled={!row.on} inputMode="numeric" onChange={(event) => patchRun(row.key, { amount: event.target.value.replace(/[^\d]/g, "") })} className="w-16 bg-transparent text-right outline-none disabled:opacity-60" />
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-[12px] font-semibold text-[#334155]">{row.on && !Number.isNaN(when.getTime()) ? `=${running.toLocaleString("en-IN")}` : "off"}</span>
                      </div>
                    );
                  })}
                  {runDrafts.length > 80 && <p className="px-2 text-[12px] text-[#64748b]">The first 80 runs are shown. The other {runDrafts.length - 80} runs follow the same pattern.</p>}
                  {schedule.length === 0 && <p className="px-2 pb-2 text-[12px] text-[#64748b]">Set a quantity and the schedule shows here.</p>}
                </div>
              )}
            </div>
          )}
        />

      <section className="rounded-[24px] border border-[#e7eef6] bg-white p-4 shadow-sm">
        <p className="text-[28px] font-bold text-[#2458c5]">{inr(totalPaise)} <span className="text-[16px] font-semibold text-[#64748b]">total</span></p>
        <p className="text-[13px] text-[#64748b]">{totalQty.toLocaleString("en-IN")} engagements • {active.length} types</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="text-[12px]">
            <p className="flex items-center gap-1 text-[#64748b]"><Wallet className="size-3" /> Balance: {inr(balance)}</p>
            {balance < totalPaise && <p className="font-semibold text-rose-500">Insufficient balance</p>}
          </div>
          <button type="button" disabled={!canPay || pending} onClick={submit} className="h-11 flex-1 rounded-xl bg-[#3b82f6] text-[14px] font-semibold text-white disabled:opacity-60">
            {pending ? "Placing…" : `Place Order — ${inr(totalPaise)}`}
          </button>
        </div>
        {error && <p className="mt-2 text-[13px] text-rose-600">{error}</p>}
      </section>

      {ask && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/25 p-4" onClick={() => setAsk(false)}>
          <div className="flex max-h-[88vh] w-full max-w-[440px] flex-col overflow-hidden rounded-[28px] border border-[#e7eef6] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between px-5 pt-5">
              <div>
                <p className="flex items-center gap-2 font-['Playfair_Display',Georgia,serif] text-[22px] font-semibold text-[#1f2937]">
                  <Sparkles className="size-4 text-amber-500" /> Organic AI Assistant
                </p>
                <p className="mt-1 text-[13px] text-[#64748b]">Analyzes your link and gives real-time engagement guidance.</p>
              </div>
              <button type="button" onClick={() => setAsk(false)} className="grid size-8 place-items-center rounded-full text-[#94a3b8] hover:bg-[#f4f7fb]" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 border-t border-[#eef2f6] px-5 py-3">
              <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold">
                <span className="rounded-full border border-[#e7eef6] px-3 py-1 lowercase">{platform}</span>
                <span className="rounded-full border border-[#e7eef6] px-3 py-1 text-[#94a3b8]">{platform === "tiktok" ? <Music2 className="size-3.5" /> : "—"}</span>
                {/^https?:\/\//.test(link.trim()) ? (
                  <span className="max-w-[180px] truncate rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{link.trim()}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-500"><ShieldAlert className="size-3.5" /> paste a link</span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[13px] font-semibold text-[#334155]">
                <span className="inline-flex items-center gap-1 rounded-full border border-[#e7eef6] px-3 py-1"><Eye className="size-3.5 text-[#64748b]" /> {(quantities.views ?? 0).toLocaleString("en-IN")} Views</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#e7eef6] px-3 py-1"><Heart className="size-3.5 text-rose-400" /> {(quantities.likes ?? 0).toLocaleString("en-IN")} Likes</span>
              </div>
              <p className="mt-2 flex items-center gap-1 text-[13px] text-[#334155]">
                <ShieldCheck className="size-3.5 text-amber-500" /> Health: <b>{report.health}/100</b>
                <span className="text-[#94a3b8]">•</span> Botting risk: <b>{report.botting}%</b>
              </p>
            </div>
            <div className="flex-1 space-y-3 overflow-auto border-t border-[#eef2f6] px-5 py-4">
              {chat.map((message, index) => (
                <div key={index} className={message.role === "user" ? "ml-8 rounded-2xl bg-[#111827] px-3 py-2 text-[13px] text-white" : "rounded-2xl bg-[#eef5fb] px-3 py-3 text-[13px] leading-relaxed whitespace-pre-line text-[#1e293b]"}>
                  {message.text}
                  {message.apply && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = applyMix(message.mix);
                        setChat((current) => [...current, { role: "assistant", text: `Applied ${next.likes.toLocaleString("en-IN")} likes, ${next.saves.toLocaleString("en-IN")} saves, ${next.shares.toLocaleString("en-IN")} shares, ${next.reposts.toLocaleString("en-IN")} reposts.` }]);
                      }}
                      className="mt-2 rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-[#2458c5]"
                    >
                      Apply this mix
                    </button>
                  )}
                </div>
              ))}
              {aiPending && <p className="text-[12px] text-[#64748b]">Asking the free model…</p>}
              <div className="flex flex-wrap gap-2">
                {["Is this safe?", "How long will delivery take?", "How many more likes should I add?", "Suggest the best ratio"].map((prompt) => (
                  <button key={prompt} type="button" onClick={() => askOrganic(prompt)} className="rounded-full border border-amber-200 px-3 py-1 text-[12px] font-semibold text-amber-700">
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
            <form
              className="flex items-center gap-2 border-t border-[#eef2f6] px-4 py-3"
              onSubmit={(event) => {
                event.preventDefault();
                askOrganic(draft);
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Type your question..."
                className="h-11 min-w-0 flex-1 rounded-full bg-[#e8f1fb] px-4 text-[13px] outline-none"
              />
              <button type="submit" className="grid size-11 place-items-center rounded-full bg-[#e7b38a] text-white" aria-label="Send">
                <Send className="size-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleCard({ on, title, badge, text, icon, tone, onClick }: { on: boolean; title: string; badge: string; text: string; icon: ReactNode; tone: "emerald" | "blue"; onClick: () => void }) {
  const wash = tone === "emerald" ? "border-emerald-100 bg-emerald-50/70" : "border-sky-100 bg-sky-50/70";
  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-3 ${wash}`}>
      <span className="grid size-9 place-items-center rounded-full bg-white text-[#0f766e]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold">{title} <span className="ml-1 rounded-full bg-emerald-100 px-1.5 text-[9px] text-emerald-700">{badge}</span></p>
        <p className="text-[11px] text-[#64748b]">{text}</p>
      </div>
      <Switch on={on} onClick={onClick} />
    </div>
  );
}

function PlatformButton({ active, onClick, icon, label, gradient }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; gradient: string }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex h-11 items-center gap-2 rounded-full px-4 text-[12px] font-bold tracking-wide ${active ? `bg-gradient-to-r ${gradient} text-white` : "bg-[#f3f6fa] text-[#64748b]"}`}>
      {icon} {label}
    </button>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div className="rounded-2xl bg-white p-2">
      <p className="text-[16px] font-bold">{n}</p>
      <p className="text-[11px] text-[#94a3b8]">{l}</p>
    </div>
  );
}

function Preset({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-full bg-[#f3f6fa] px-3 py-1 text-[12px] font-semibold">{label}</button>;
}

function Curve({ points, draw, color, wash, dot, onChange, drag, setDrag }: { points: number[]; draw: boolean; color: string; wash: string; dot: string; onChange: (next: number[]) => void; drag: number | null; setDrag: (index: number | null) => void }) {
  const w = 520;
  const h = 210;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 22;
  const coords = points.map((y, index) => {
    const x = padL + (index / Math.max(1, points.length - 1)) * (w - padL - padR);
    const py = padT + (1 - y) * (h - padT - padB);
    return { x, py };
  });
  const d = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.py}`).join(" ");
  const gradId = `wash-${dot.replace("#", "")}`;
  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ background: "var(--desk-card)" }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-56 w-full touch-none"
        onClick={(event) => {
          if (!draw) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const y = 1 - ((event.clientY - rect.top) / rect.height - padT / h) / ((h - padT - padB) / h);
          onChange([...points, Math.min(1, Math.max(0.02, y))].slice(0, 8));
        }}
        onMouseMove={(event) => {
          if (drag == null) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const y = 1 - ((event.clientY - rect.top) / rect.height - padT / h) / ((h - padT - padB) / h);
          const next = points.slice();
          next[drag] = Math.min(1, Math.max(0.02, y));
          onChange(next);
        }}
        onMouseUp={() => setDrag(null)}
        onMouseLeave={() => setDrag(null)}
        onTouchMove={(event) => {
          if (drag == null) return;
          const touch = event.touches[0];
          const rect = event.currentTarget.getBoundingClientRect();
          const y = 1 - ((touch.clientY - rect.top) / rect.height - padT / h) / ((h - padT - padB) / h);
          const next = points.slice();
          next[drag] = Math.min(1, Math.max(0.02, y));
          onChange(next);
        }}
        onTouchEnd={() => setDrag(null)}
      >
        <text x={4} y={padT + 4} fontSize="11" fill="#94a3b8">100%</text>
        <text x={8} y={(padT + h - padB) / 2 + 4} fontSize="11" fill="#94a3b8">50%</text>
        <text x={(padL + w - padR) / 2} y={h - 4} textAnchor="middle" fontSize="11" fill="#94a3b8">50%</text>
        <text x={w - padR} y={h - 4} textAnchor="end" fontSize="11" fill="#94a3b8">100%</text>
        <path d={`${d} L${w - padR},${h - padB} L${padL},${h - padB} Z`} fill={`url(#${gradId})`} opacity="0.55" />
        <path d={d} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        {draw && coords.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.py}
            r="8"
            fill="#fff"
            stroke={dot}
            strokeWidth="2.5"
            onMouseDown={(event) => {
              event.stopPropagation();
              setDrag(index);
            }}
            onClick={(event) => event.stopPropagation()}
            onTouchStart={(event) => {
              event.stopPropagation();
              setDrag(index);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              if (points.length > 2) onChange(points.filter((_, item) => item !== index));
            }}
          />
        ))}
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={wash} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

const PREVIEW_TYPES = [
  { key: "views", label: "Views", Icon: Eye, tint: "text-[#7c5c3a]" },
  { key: "likes", label: "Likes", Icon: Heart, tint: "text-rose-500" },
  { key: "saves", label: "Saves", Icon: Bookmark, tint: "text-[#3b82f6]" },
  { key: "shares", label: "Shares", Icon: Share2, tint: "text-[#2563eb]" },
  { key: "reposts", label: "Reposts", Icon: RefreshCw, tint: "text-[#0ea5e9]" },
] as const;

function axisTicks(max: number) {
  const steps = 4;
  return Array.from({ length: steps + 1 }, (_, index) => Math.round((max * index) / steps));
}

function axisLabel(value: number) {
  if (value >= 1000) {
    const compact = value / 1000;
    return Number.isInteger(compact) ? `${compact}K` : `${compact.toFixed(1)}K`;
  }
  return String(value);
}

function EngagementRate({ quantities }: { quantities: Record<string, number> }) {
  const views = Math.max(0, Math.floor(quantities.views || 0));
  const likes = Math.max(0, Math.floor(quantities.likes || 0));
  const shares = Math.max(0, Math.floor(quantities.shares || 0));
  const saves = Math.max(0, Math.floor(quantities.saves || 0));
  const rate = (qty: number) => (views > 0 ? (qty / views) * 100 : 0);
  const text = (qty: number) => `${rate(qty).toFixed(2)}%`;
  const total = likes + shares + saves;
  const overall = rate(total);
  const rows = [
    { label: "Likes", qty: likes, color: "#60a5fa" },
    { label: "Shares", qty: shares, color: "#22d3ee" },
    { label: "Saves", qty: saves, color: "#f472b6" },
    { label: "Shares + Saves", qty: shares + saves, color: "#a78bfa" },
  ];
  return (
    <div className="rounded-[28px] border border-[#e7eef6] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[18px] font-bold text-[#0f172a]">Live Engagement Rate Preview</p>
          <p className="text-[12px] text-[#94a3b8]">Full order engagement analytics</p>
        </div>
        <span className="rounded-full border border-emerald-300 px-2 py-1 text-[11px] font-bold text-emerald-600">LIVE</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-[#f4f7fb] p-3">
          <p className="text-[11px] font-semibold text-[#64748b]">Views</p>
          <p className="text-[22px] font-bold text-[#0f172a]">{views.toLocaleString("en-IN")}</p>
          <p className="text-[12px] text-[#64748b]">Base 100%</p>
        </div>
        <div className="rounded-2xl bg-[#f4f7fb] p-3">
          <p className="text-[11px] font-semibold text-[#64748b]">Total Engagement</p>
          <p className="text-[22px] font-bold text-[#0f172a]">{total.toLocaleString("en-IN")}</p>
          <p className="text-[12px] text-[#64748b]">{text(total)}</p>
        </div>
      </div>
      <div className="mt-2 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-2xl border border-[#e7eef6] px-3 py-2">
            <div className="flex items-center justify-between text-[12px] font-semibold">
              <span>{row.label}</span>
              <span>{row.qty.toLocaleString("en-IN")} · {text(row.qty)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#eef2f6]">
              <div className="h-1.5 rounded-full" style={{ width: `${Math.max(0, Math.min(100, rate(row.qty)))}%`, background: row.color }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl bg-[#111827] px-3 py-3 text-white">
        <p className="text-[12px] text-white/70">Overall Engagement Rate</p>
        <p className="text-[28px] font-bold">{overall.toFixed(2)}%</p>
        <p className="text-[11px] text-white/60">{total.toLocaleString("en-IN")} engagements / {views.toLocaleString("en-IN")} views</p>
      </div>
    </div>
  );
}

function Delivery({
  pattern,
  picker,
  family,
  onFamily,
  onTogglePicker,
  onPattern,
  onNew,
  quantities,
  pace,
  curves,
  drops,
  schedule,
}: {
  pattern: number;
  picker: boolean;
  family: string;
  onFamily: (name: string) => void;
  onTogglePicker: () => void;
  onPattern: (id: number) => void;
  onNew: () => void;
  quantities: Record<string, number>;
  pace: Record<string, Pace>;
  curves: Record<string, number[]>;
  drops?: { type: string; at: number; amount: number }[];
  schedule?: ReactNode;
}) {
  const specs = [
    { key: "views", color: "#c084fc", label: "Views" },
    { key: "likes", color: "#60a5fa", label: "Likes" },
    { key: "shares", color: "#22d3ee", label: "Shares" },
    { key: "saves", color: "#f472b6", label: "Saves" },
  ] as const;
  const delivery: Record<string, { hours: number; runs: number; variance: number; peak: boolean; curve?: number[]; gapMinutes?: number }> = {};
  for (const spec of specs) {
    const qty = quantities[spec.key] ?? 0;
    const current = pace[spec.key] ?? DEFAULT_PACE;
    const runs = qty > 0 && current.runsMode === "manual" && current.runs > 0 ? current.runs : autoRuns(Math.max(qty, 1), spec.key);
    delivery[spec.key] = {
      hours: qty > 0 ? paceHours(current, Math.max(runs, 1), quantities.views || 10000) : 0,
      runs: qty > 0 ? runs : 0,
      variance: current.variance,
      peak: current.peak,
      curve: curves[spec.key] ?? curves.views,
      gapMinutes: current.intervalMode === "manual" && current.intervalMinutes >= 1 ? current.intervalMinutes : undefined,
    };
  }
  const preview = growthPreview({ quantities, delivery, drops });
  const drawn = preview.drawn;
  const span = preview.span;
  const width = 640;
  const height = 230;
  const left = 36;
  const right = 8;
  const top = 12;
  const bottom = 28;
  const innerW = width - left - right;
  const innerH = height - top - bottom;
  const linePath = (points: number[]) => points.map((point, index) => {
    const x = left + (index / (points.length - 1)) * innerW;
    const y = top + (1 - point) * innerH;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const viewLine = drawn.find((item) => item.key === "views");
  const viewPath = linePath(viewLine?.points ?? []);
  const area = `${viewPath} L${left + innerW},${top + innerH} L${left},${top + innerH} Z`;
  const marks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const hoursAt = span * t;
    const label = t === 0 ? "Start" : hoursAt < 48 ? `${Math.round(hoursAt)}h` : `${(hoursAt / 24).toFixed(1)}d`;
    return { t, label };
  });
  const cards = PREVIEW_TYPES.map((type) => {
    const qty = quantities[type.key] ?? 0;
    const current = pace[type.key] ?? DEFAULT_PACE;
    const runs = current.runsMode === "manual" && current.runs > 0 ? current.runs : autoRuns(Math.max(qty, 1), type.key);
    return { ...type, qty, runs: qty > 0 ? runs : 0, window: current.window === "auto" ? "Auto" : current.window === "custom" ? `${current.customHours}h` : current.window, variance: current.variance };
  }).filter((card) => card.qty > 0 || card.key === "views");
  const total = Object.values(quantities).reduce((sum, value) => sum + value, 0);
  const runSum = cards.reduce((sum, card) => sum + card.runs, 0);
  const hours = Math.max(...cards.map((card) => paceHours(pace[card.key] ?? DEFAULT_PACE, Math.max(card.runs, 1), quantities.views || 10000)), 0.1);
  const bot = preview.bot;
  const botTone = bot.score <= 20 ? "border-emerald-300 text-emerald-700" : bot.score <= 40 ? "border-teal-300 text-teal-700" : bot.score <= 60 ? "border-amber-300 text-amber-700" : bot.score <= 80 ? "border-orange-300 text-orange-700" : "border-rose-300 text-rose-700";
  const botBar = bot.score <= 20 ? "#22c55e" : bot.score <= 40 ? "#14b8a6" : bot.score <= 60 ? "#f59e0b" : bot.score <= 80 ? "#f97316" : "#ef4444";
  const steps = preview.steps || drawn[0]?.points.length || 64;
  const [probe, setProbe] = useState<number | null>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (probe == null) return;
    function hide(event: PointerEvent) {
      const box = graphRef.current;
      if (box && event.target instanceof Node && box.contains(event.target)) return;
      setProbe(null);
    }
    document.addEventListener("pointerdown", hide);
    return () => document.removeEventListener("pointerdown", hide);
  }, [probe]);
  function readProbe(event: { currentTarget: SVGSVGElement; clientX: number; clientY: number }) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * width;
    const py = ((event.clientY - rect.top) / rect.height) * height;
    if (px < left || px > left + innerW || py < top - 4 || py > top + innerH + 8) {
      setProbe(null);
      return;
    }
    const index = Math.max(0, Math.min(steps - 1, Math.round(((px - left) / innerW) * (steps - 1))));
    setProbe(index);
  }
  const probeX = probe == null ? 0 : left + (probe / Math.max(1, steps - 1)) * innerW;
  const probeLines = probe == null ? [] : drawn.filter((line) => line.qty > 0);
  const hoursAt = probe == null ? 0 : (probe / Math.max(1, steps - 1)) * span;
  const clock = new Date(preview.origin + hoursAt * 3600000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const elapsed = hoursAt < 1 ? `${Math.max(0, Math.round(hoursAt * 60))} min` : `${hoursAt.toFixed(1)}h`;

  return (
    <section className="space-y-3">
      <div className="rounded-[28px] border border-[#e7eef6] bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e8f1ff] text-[#3b82f6]">
              <Activity className="size-5" />
            </span>
            <div>
              <p className="text-[18px] font-bold text-[#0f172a]">Live Organic Growth Preview</p>
              <p className="text-[12px] text-[#94a3b8]">Bursts + pauses • Service-wise natural steps</p>
            </div>
          </div>
          <span className={`inline-flex h-9 items-center rounded-full border px-3 text-[12px] font-semibold ${botTone}`}>
            Bot {bot.score}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-semibold">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#3b82f6] px-3 py-1 text-white">
            <Zap className="size-3.5" /> {total.toLocaleString("en-IN")} total
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f5f9] px-3 py-1 text-[#334155]">
            <Activity className="size-3.5" /> {runSum} runs
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f5f9] px-3 py-1 text-[#334155]">
            <Clock className="size-3.5" /> {formatDuration(hours)}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-[#64748b]">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f8fafc] px-2 py-1"><span className="size-2 rounded-full bg-[#c084fc]" /> {(quantities.views ?? 0).toLocaleString("en-IN")}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f8fafc] px-2 py-1"><span className="size-2 rounded-full bg-[#60a5fa]" /> {(quantities.likes ?? 0).toLocaleString("en-IN")}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f8fafc] px-2 py-1"><span className="size-2 rounded-full bg-[#22d3ee]" /> {(quantities.shares ?? 0).toLocaleString("en-IN")}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f8fafc] px-2 py-1"><span className="size-2 rounded-full bg-[#f472b6]" /> {(quantities.saves ?? 0).toLocaleString("en-IN")}</span>
        </div>

        <div ref={graphRef} className="relative mt-2">
          <svg viewBox={`0 0 ${width} ${height}`} onPointerDown={readProbe} className="h-64 w-full cursor-crosshair rounded-2xl bg-[#0b1220]">
            {[0.25, 0.5, 0.75].map((tick) => {
              const y = top + (1 - tick) * innerH;
              return <line key={tick} x1={left} x2={width - right} y1={y} y2={y} stroke="#1e293b" />;
            })}
            <path d={area} fill="#c084fc" opacity="0.16" />
            {drawn.filter((line) => line.qty > 0).map((line) => (
              <path key={line.key} d={linePath(line.points)} fill="none" stroke={line.color} strokeWidth={line.key === "views" ? 2.8 : 2.2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {marks.map((mark) => (
              <text key={mark.label} x={left + mark.t * innerW} y={height - 8} textAnchor={mark.t === 0 ? "start" : mark.t === 1 ? "end" : "middle"} fontSize="10" fill="#94a3b8">{mark.label}</text>
            ))}
            {probe != null && (
              <>
                <line x1={probeX} x2={probeX} y1={top} y2={top + innerH} stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="1" />
                {probeLines.map((line) => {
                  const y = top + (1 - (line.points[probe] ?? 0)) * innerH;
                  return <circle key={line.key} cx={probeX} cy={y} r="4.5" fill={line.color} stroke="#ffffff" strokeWidth="1.5" />;
                })}
              </>
            )}
          </svg>
          {probe != null && (
            <div
              className="pointer-events-none absolute z-10 w-[148px] rounded-2xl border border-[#e2e8f0] bg-white/95 p-2.5 text-[#0f172a] shadow-lg"
              style={{ left: `${Math.min(78, Math.max(2, (probeX / width) * 100 - (probeX > width * 0.62 ? 28 : 0)))}%`, top: "18%" }}
            >
              <p className="text-[12px] font-bold">{clock}</p>
              <p className="mb-1 text-[10px] text-[#94a3b8]">{elapsed}</p>
              <ul className="space-y-1">
                {probeLines.map((line) => (
                  <li key={line.key} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <span className="size-2 rounded-full" style={{ background: line.color }} />
                      {line.label}
                    </span>
                    <span className="font-bold">{Math.round(line.totals?.[probe] ?? 0).toLocaleString("en-IN")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-3 text-[12px] text-[#64748b]">
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[#c084fc]" /> Views</span>
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[#60a5fa]" /> Likes</span>
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[#22d3ee]" /> Shares</span>
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[#f472b6]" /> Saves</span>
        </div>
        <div className={`mt-3 rounded-2xl border p-3 ${botTone}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[14px] font-bold">Bot score {bot.score}/100</p>
            <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold">{bot.band} · {bot.name}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e7eef6]">
            <div className="h-2 rounded-full" style={{ width: `${bot.score}%`, background: botBar }} />
          </div>
          <p className="mt-2 text-[12px] font-semibold">{bot.action}</p>
          <div className="mt-2 space-y-2">
            {(bot.checks ?? []).map((check) => (
              <div key={check.label} className={`rounded-xl border px-3 py-2 text-[12px] ${check.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
                <p className="font-bold">{check.title}</p>
                <p className="mt-0.5">{check.why}</p>
                {check.fix ? <p className="mt-0.5 font-semibold">{check.fix}</p> : null}
              </div>
            ))}
          </div>
          {(bot.checks ?? []).every((check) => check.ok) ? <p className="mt-2 text-[12px] font-semibold">Every selected service graph looks right. You can place the order.</p> : <p className="mt-2 text-[12px] font-semibold">Fix the service whose graph is off, then place the order.</p>}
        </div>
      </div>

      <EngagementRate quantities={quantities} />

      <div className="rounded-[28px] border border-[#e7eef6] bg-white p-4 shadow-sm">
        <p className="text-[18px] font-bold"><Sprout className="mr-1 inline size-4 text-emerald-500" /> Per-Type Organic Delivery Preview</p>
        <p className="text-[13px] text-[#64748b]">Each type has its own organic settings</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-semibold">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#111827] px-3 py-1 text-white"><Zap className="size-3.5" /> {total.toLocaleString("en-IN")}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f5f9] px-3 py-1"><Clock className="size-3.5" /> {runSum} runs</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f5f9] px-3 py-1"><Clock className="size-3.5" /> {formatDuration(hours)}</span>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {cards.map((card) => (
            <div key={card.key} className="rounded-2xl bg-[#f4f7fb] px-2 py-3 text-center">
              <card.Icon className={`mx-auto size-4 ${card.tint}`} />
              <p className="mt-1 text-[16px] font-bold">{card.runs}</p>
              <p className="text-[11px] text-[#94a3b8]">{card.window}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-2xl bg-[#f4f7fb] p-3">
          <p className="mb-2 text-[13px] font-semibold text-[#334155]">Per-Type Settings</p>
          <ul className="grid gap-1 text-[13px] sm:grid-cols-2">
            {cards.map((card) => (
              <li key={card.key} className="flex items-center gap-2">
                <card.Icon className={`size-3.5 ${card.tint}`} />
                <span>{card.label}: {card.window} · ±{card.variance}%</span>
              </li>
            ))}
          </ul>
        </div>
        {schedule}
      </div>
    </section>
  );
}

