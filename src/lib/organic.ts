export type Pace = {
  window: "auto" | "6h" | "12h" | "24h" | "48h" | "custom";
  customHours: number;
  runsMode: "auto" | "manual";
  runs: number;
  intervalMode: "auto" | "manual";
  intervalMinutes: number;
  variance: number;
  peak: boolean;
};

export const DEFAULT_PACE: Pace = {
  window: "auto",
  customHours: 24,
  runsMode: "auto",
  runs: 0,
  intervalMode: "auto",
  intervalMinutes: 0,
  variance: 25,
  peak: false,
};

const CHUNK: Record<string, number> = {
  views: 100,
  likes: 10,
  comments: 10,
  shares: 10,
  reposts: 10,
  saves: 50,
  followers: 10,
};

function mix(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function runBand(providerMin: number) {
  const floor = Math.max(1, providerMin) + 1;
  const band = Math.max(3, Math.round(Math.max(1, providerMin) * 0.08));
  return { floor, ceiling: floor + band };
}

export function autoRuns(quantity: number, type: string) {
  const chunk = PROVIDER_MIN[type] ?? CHUNK[type] ?? 10;
  if (quantity <= chunk) return 1;
  const { floor, ceiling } = runBand(chunk);
  const max = Math.max(1, Math.floor(quantity / floor));
  const minPieces = Math.max(1, Math.min(max, Math.ceil(quantity / ceiling)));
  if (max <= 2) return max;
  const mid = floor + Math.ceil((ceiling - floor) / 2);
  const wanted = Math.max(minPieces, Math.floor(quantity / mid) || 1);
  return Math.min(max, wanted);
}

export function organicAutoHours(views: number) {
  const runs = Math.max(1, autoRuns(Math.max(views, 1), "views"));
  return Math.max(2, Math.round(runs * 0.27));
}

export function windowHours(pace: Pace, runs: number, viewsQty = 10000) {
  if (pace.window === "6h") return 6;
  if (pace.window === "12h") return 12;
  if (pace.window === "24h") return 24;
  if (pace.window === "48h") return 48;
  if (pace.window === "custom") return Math.max(1, pace.customHours || 1);
  return organicAutoHours(viewsQty);
}

export function paceGapMinutes(pace: Pace, runs: number, viewsQty = 10000) {
  const count = Math.max(1, Math.floor(runs) || 1);
  if (pace.intervalMode === "manual" && pace.intervalMinutes >= 1) return Math.round(pace.intervalMinutes);
  const hours = windowHours(pace, count, viewsQty);
  return Math.max(1, Math.round((hours / count) * 60));
}

export function paceHours(pace: Pace, runs: number, viewsQty = 10000) {
  const count = Math.max(1, Math.floor(runs) || 1);
  if (pace.intervalMode === "manual" && pace.intervalMinutes >= 1 && count >= 1) {
    return Math.max(1 / 60, (count * pace.intervalMinutes) / 60);
  }
  return windowHours(pace, count, viewsQty);
}

export function windowFromSpan(hours: number): Pick<Pace, "window" | "customHours"> {
  const capped = Math.min(24 * 30, Math.max(1, Math.round(hours)));
  if (capped === 6) return { window: "6h", customHours: 6 };
  if (capped === 12) return { window: "12h", customHours: 12 };
  if (capped === 24) return { window: "24h", customHours: 24 };
  if (capped === 48) return { window: "48h", customHours: 48 };
  return { window: "custom", customHours: capped };
}

/** Runs and interval change the delivery window only after both are set by hand. A delivery-time pick never takes them off Auto. */
export function linkPace(current: Pace, patch: Partial<Pace>, source: "runs" | "interval" | "window" | "other", _runsNow: number, _maxRuns = 500): Pace {
  const next: Pace = { ...current, ...patch };
  if ((source === "runs" || source === "interval") && next.runsMode === "manual" && next.runs >= 1 && next.intervalMode === "manual" && next.intervalMinutes >= 1) {
    return { ...next, ...windowFromSpan((next.runs * next.intervalMinutes) / 60) };
  }
  return next;
}

export function formatDuration(hours: number) {
  const totalMin = Math.max(1, Math.round(hours * 60));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `~${m}m`;
  return `~${h}h ${m}m`;
}

export function riskLabel(variance: number) {
  if (variance < 18) return { label: "High", hint: "High detection risk — increase variance", tone: "rose" as const };
  if (variance < 35) return { label: "Medium", hint: "Moderate risk — consider increasing", tone: "amber" as const };
  return { label: "Low", hint: "Looks closer to organic pacing", tone: "emerald" as const };
}

export type RunRow = { at: Date; amount: number; total: number; peak: boolean };

function istHour(date: Date) {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return Number(hour);
}

export function isPeakHour(date: Date) {
  const hour = istHour(date);
  return hour >= 18 && hour < 23;
}

function nextPeakStart(from: Date) {
  for (let step = 0; step < 30; step += 1) {
    const probe = new Date(from.getTime() + step * 60 * 60 * 1000);
    if (istHour(probe) !== 18) continue;
    const minute = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", minute: "2-digit" }).format(probe),
    );
    return new Date(probe.getTime() - minute * 60 * 1000);
  }
  return new Date(from.getTime() + 6 * 60 * 60 * 1000);
}

export function buildRuns(quantity: number, runs: number, variance: number, start = new Date(), totalHours = 24, seed = 1, peak = false): RunRow[] {
  const count = Math.max(1, Math.min(runs, Math.max(quantity, 1)));
  let slots: Date[];
  if (peak) {
    const peakCount = Math.max(1, Math.round(count * 0.65));
    const offCount = Math.max(0, count - peakCount);
    const peakStart = nextPeakStart(start);
    const peakGap = (5 * 60 * 60 * 1000) / peakCount;
    const offGap = (Math.max(totalHours, 5) * 60 * 60 * 1000) / Math.max(1, offCount);
    slots = [
      ...Array.from({ length: peakCount }, (_, index) => new Date(peakStart.getTime() + peakGap * index)),
      ...Array.from({ length: offCount }, (_, index) => new Date(start.getTime() + offGap * index)),
    ].sort((a, b) => a.getTime() - b.getTime());
  } else {
    const gap = (totalHours * 3600 * 1000) / count;
    slots = Array.from({ length: count }, (_, index) => new Date(start.getTime() + gap * index));
  }
  const weights = slots.map((at, index) => {
    const swing = (mix(seed + index * 3.1) * 2 - 1) * (variance / 100);
    let weight = Math.max(0.25, 1 + swing);
    if (peak) weight *= isPeakHour(at) ? 2.8 : 0.4;
    return weight;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  let used = 0;
  return weights.map((weight, index) => {
    const amount = index === count - 1 ? Math.max(0, quantity - used) : Math.max(1, Math.round((quantity * weight) / sum));
    used += amount;
    const at = slots[index] ?? start;
    return { at, amount, total: Math.min(quantity, used), peak: peak && isPeakHour(at) };
  }).filter((row) => row.amount > 0);
}

export const PROVIDER_MIN: Record<string, number> = {
  views: 100,
  likes: 10,
  comments: 10,
  shares: 10,
  reposts: 10,
  saves: 50,
  followers: 10,
};

/** Split one line into provider-sized drops across the delivery window. */
export function planDrops(input: {
  quantity: number;
  type: string;
  runs: number;
  hours: number;
  curve?: number[];
  variance?: number;
  peak?: boolean;
  min?: number;
  start?: Date;
  gapMinutes?: number;
  lockRuns?: boolean;
}) {
  const quantity = Math.max(0, Math.floor(input.quantity));
  if (quantity <= 0) return [] as { at: Date; amount: number }[];
  const providerMin = Math.max(1, Math.floor(input.min ?? PROVIDER_MIN[input.type] ?? 10));
  const raised = quantity > providerMin;
  const floor = raised ? providerMin + 1 : Math.max(1, Math.min(quantity, providerMin));
  const start = input.start ?? new Date();
  const hours = Math.max(1 / 60, Number(input.hours) || 1);
  const maxPieces = Math.max(1, Math.floor(quantity / floor));
  const asked = Math.max(1, Math.floor(input.runs) || 1);
  const seed = Math.round(quantity + asked * 17 + (input.variance ?? 25) + input.type.length * 9);
  const sized = variedAmounts(quantity, Math.min(maxPieces, asked), floor, seed, Boolean(input.lockRuns));
  if (sized.length === 0) return [];
  const gapMs = input.gapMinutes && input.gapMinutes >= 1 ? Math.round(input.gapMinutes) * 60 * 1000 : 0;
  return sized.map((amount, index) => {
    if (gapMs > 0) return { at: new Date(start.getTime() + gapMs * index), amount };
    const t = sized.length === 1 ? 0 : index / (sized.length - 1);
    return { at: new Date(start.getTime() + t * hours * 3600 * 1000), amount };
  });
}

const VARIETY = [0, 2, 5, 1, 8, 3, 6, 11, 4, 9, 13, 7, 10, 14, 12];

function variedAmounts(quantity: number, requested: number, floor: number, seed: number, lockCount = false) {
  const safeFloor = Math.max(1, floor);
  const maxCount = Math.max(1, Math.floor(quantity / safeFloor));
  let count = Math.min(maxCount, Math.max(1, requested));
  const softCap = safeFloor + 18;
  if (!lockCount) {
    while (count < maxCount && quantity / count > softCap) count += 1;
  }
  while (count > 1 && quantity / count < safeFloor) count -= 1;
  const cap = Math.max(softCap, Math.ceil(quantity / count) + 4);
  const amounts = Array.from({ length: count }, (_, index) => Math.min(cap, safeFloor + VARIETY[(index + seed) % VARIETY.length]));
  const seen = (index: number, value: number, gap: number) => {
    for (let cursor = Math.max(0, index - gap); cursor < index; cursor += 1) if (amounts[cursor] === value) return true;
    return false;
  };
  let delta = quantity - amounts.reduce((sum, amount) => sum + amount, 0);
  const budget = Math.abs(delta) * 3 + count;
  let spins = 0;
  while (delta !== 0 && spins++ < budget) {
    let moved = false;
    const gap = spins < budget / 2 ? 10 : 4;
    for (let step = 0; step < count && delta !== 0; step += 1) {
      const index = (seed + spins * 5 + step * 3) % count;
      const next = amounts[index] + Math.sign(delta);
      if (next < safeFloor || next > cap || seen(index, next, gap)) continue;
      amounts[index] = next;
      delta -= Math.sign(delta);
      moved = true;
    }
    if (!moved && gap === 4) break;
  }
  const leftover = Math.abs(delta);
  let fix = 0;
  while (delta !== 0 && fix++ < leftover + 2) {
    let moved = false;
    for (let index = 0; index < count && delta !== 0; index += 1) {
      const next = amounts[index] + Math.sign(delta);
      if (next < safeFloor || next > cap + 8) continue;
      amounts[index] = next;
      delta -= Math.sign(delta);
      moved = true;
    }
    if (!moved) break;
  }
  return amounts.filter((amount) => amount > 0);
}

export function trimPct(value: number) {
  if (!Number.isFinite(value)) return "";
  return String(Math.round(value * 1000) / 1000);
}

export const REAL_BAND: Record<string, string> = {
  likes: "3–6%",
  comments: "0.05–0.1%",
  shares: "0.3–0.8%",
  reposts: "0.3–0.8%",
  saves: "0.5–1%",
};

const MIX_CAPS: Record<string, number> = { likes: 20000, comments: 15000 };
const MIX_ANCHORS: Record<"light" | "recommended" | "viral", { views: number; mix: Record<string, number> }[]> = {
  light: [
    { views: 1000, mix: { likes: 2, comments: 0.1, shares: 1, reposts: 1, saves: 1 } },
    { views: 10000, mix: { likes: 2, comments: 0.03, shares: 0.2, reposts: 0.2, saves: 0.3 } },
  ],
  recommended: [
    { views: 1000, mix: { likes: 5, comments: 0.1, shares: 1, reposts: 1, saves: 1 } },
    { views: 10000, mix: { likes: 4.5, comments: 0.08, shares: 0.6, reposts: 0.6, saves: 0.8 } },
    { views: 100000, mix: { likes: 4.5, comments: 0.075, shares: 0.55, reposts: 0.55, saves: 0.75 } },
  ],
  viral: [
    { views: 1000, mix: { likes: 8, comments: 0.2, shares: 1, reposts: 1, saves: 2 } },
    { views: 10000, mix: { likes: 8, comments: 0.15, shares: 1.2, reposts: 1.2, saves: 1.5 } },
  ],
};

export function mixCurve(id: "light" | "recommended" | "viral", views: number) {
  const rows = MIX_ANCHORS[id];
  const viewsQty = Math.max(100, views);
  let raw: Record<string, number>;
  if (viewsQty <= rows[0].views) raw = { ...rows[0].mix };
  else if (viewsQty >= rows[rows.length - 1].views) raw = { ...rows[rows.length - 1].mix };
  else {
    let index = 0;
    while (index < rows.length - 1 && viewsQty > rows[index + 1].views) index += 1;
    const left = rows[index];
    const right = rows[index + 1];
    const span = Math.log10(right.views) - Math.log10(left.views);
    const t = span <= 0 ? 1 : (Math.log10(viewsQty) - Math.log10(left.views)) / span;
    raw = {};
    for (const key of Object.keys(left.mix)) raw[key] = left.mix[key] + (right.mix[key] - left.mix[key]) * t;
  }
  const next: Record<string, number> = {};
  for (const [type, pct] of Object.entries(raw)) {
    const cap = MIX_CAPS[type];
    const qty = (viewsQty * pct) / 100;
    next[type] = cap && qty > cap ? Math.round((cap / viewsQty) * 100000) / 1000 : Math.round(pct * 1000) / 1000;
  }
  return next;
}

const MIX_GAP_MIN: Record<string, number> = {
  likes: 5,
  shares: 9,
  saves: 13,
  reposts: 17,
  comments: 21,
  followers: 25,
};

export type MixLine = {
  type: string;
  quantity: number;
  runs: number;
  hours: number;
  curve?: number[];
  variance?: number;
  peak?: boolean;
  min?: number;
  gapMinutes?: number;
  lockRuns?: boolean;
};

export type MixDrop = { type: string; at: Date; amount: number; total: number };

/** Views are the spine. Likes, saves, shares and reposts land in the gaps, not after every view run is done. */
export function mixDrops(lines: MixLine[], start = new Date()): MixDrop[] {
  const planned = lines
    .filter((line) => Math.floor(line.quantity) > 0)
    .map((line) => ({
      type: line.type,
      drops: planDrops({
        quantity: line.quantity,
        type: line.type,
        runs: line.runs,
        hours: line.hours,
        curve: line.curve,
        variance: line.variance,
        peak: line.peak,
        min: line.min,
        start,
        gapMinutes: line.gapMinutes,
        lockRuns: line.lockRuns,
      }),
    }))
    .filter((line) => line.drops.length > 0);
  if (planned.length === 0) return [];
  const spine = planned.find((line) => line.type === "views") ?? planned.reduce((best, line) => (line.drops.length > best.drops.length ? line : best));
  const spineTimes = spine.drops.map((drop) => drop.at.getTime());
  const last = spineTimes[spineTimes.length - 1] ?? start.getTime();
  const used = new Set<number>();
  const mixed: { type: string; at: Date; amount: number }[] = [];

  const takeTime = (at: number) => {
    let next = at;
    while (used.has(next)) next += 15_000;
    used.add(next);
    return new Date(next);
  };

  spine.drops.forEach((drop) => {
    mixed.push({ type: spine.type, at: takeTime(drop.at.getTime()), amount: drop.amount });
  });

  for (const line of planned) {
    if (line.type === spine.type) continue;
    const ownGap = lines.find((item) => item.type === line.type)?.gapMinutes;
    if (ownGap && ownGap >= 1) {
      line.drops.forEach((drop) => {
        mixed.push({ type: line.type, at: takeTime(drop.at.getTime()), amount: drop.amount });
      });
      continue;
    }
    const count = line.drops.length;
    const gapMin = MIX_GAP_MIN[line.type] ?? 8;
    line.drops.forEach((drop, index) => {
      const slot = count === 1
        ? Math.min(spineTimes.length - 1, Math.max(0, Math.floor(spineTimes.length * 0.4)))
        : Math.min(spineTimes.length - 1, Math.round(((index + 1) * (spineTimes.length - 1)) / (count + 1)));
      const jitter = Math.round((mix(index * 17 + line.type.length * 3) - 0.5) * 4 * 60 * 1000);
      const at = Math.min(last + 8 * 60 * 1000, (spineTimes[slot] ?? start.getTime()) + gapMin * 60 * 1000 + jitter);
      mixed.push({ type: line.type, at: takeTime(at), amount: drop.amount });
    });
  }

  const lifted = liftOffMinimum(mixed, (type) => lines.find((line) => line.type === type)?.min ?? PROVIDER_MIN[type] ?? 1);
  lifted.sort((a, b) => a.at.getTime() - b.at.getTime());
  // Keep a real gap between any two runs so services never fire together.
  const MIN_GAP = 5 * 60 * 1000;
  for (let index = 1; index < lifted.length; index += 1) {
    const prev = lifted[index - 1].at.getTime();
    const now = lifted[index].at.getTime();
    if (now - prev < MIN_GAP) lifted[index] = { ...lifted[index], at: new Date(prev + MIN_GAP) };
  }
  const totals: Record<string, number> = {};
  return lifted.map((row) => {
    totals[row.type] = (totals[row.type] || 0) + row.amount;
    return { ...row, total: totals[row.type] };
  });
}

/** Move quantity so a run is never exactly the provider minimum when the line is bigger than that minimum. */
export function liftOffMinimum<T extends { type: string; amount: number }>(drops: T[], minOf: (type: string) => number) {
  const groups = new Map<string, T[]>();
  for (const drop of drops) {
    const list = groups.get(drop.type);
    if (list) list.push(drop);
    else groups.set(drop.type, [drop]);
  }
  const removed = new Set<T>();
  for (const [type, list] of groups) {
    const providerMin = Math.max(1, Math.floor(minOf(type) || 1));
    const total = list.reduce((sum, drop) => sum + Math.floor(drop.amount), 0);
    if (total <= providerMin) continue;
    let guard = 0;
    while (list.some((drop) => drop.amount <= providerMin) && guard++ < total + list.length) {
      const low = list.find((drop) => drop.amount <= providerMin);
      const rich = list.find((drop) => drop !== low && drop.amount >= providerMin + 2);
      if (low && rich) {
        rich.amount -= 1;
        low.amount += 1;
        continue;
      }
      if (!low || list.length < 2) break;
      const lowAt = list.indexOf(low);
      list.splice(lowAt, 1);
      removed.add(low);
      let left = low.amount;
      let cursor = 0;
      while (left > 0) {
        list[cursor % list.length].amount += 1;
        left -= 1;
        cursor += 1;
      }
    }
  }
  return drops.filter((drop) => !removed.has(drop));
}

const BANDS: Record<string, { lowOk: number; highOk: number; lowDanger: number; highDanger: number; label: string }> = {
  likes: { lowOk: 4, highOk: 10, lowDanger: 1, highDanger: 20, label: "Likes / Views" },
  comments: { lowOk: 0.3, highOk: 1.5, lowDanger: 0.05, highDanger: 4, label: "Comments / Views" },
  shares: { lowOk: 0.3, highOk: 2, lowDanger: 0.02, highDanger: 5, label: "Shares / Views" },
  saves: { lowOk: 0.3, highOk: 3, lowDanger: 0.02, highDanger: 6, label: "Saves / Views" },
};

export function ratioReport(qty: Record<string, number>) {
  const views = qty.views ?? 0;
  const shares = (qty.shares ?? 0) + (qty.reposts ?? 0);
  const measured = {
    likes: qty.likes ?? 0,
    comments: qty.comments ?? 0,
    shares,
    saves: qty.saves ?? 0,
  };
  const checks = Object.entries(BANDS).map(([key, band]) => {
    const value = measured[key as keyof typeof measured];
    const pct = views > 0 ? (value / views) * 100 : 0;
    let status: "ok" | "low" | "high" | "danger_low" | "danger_high" | "none" = "none";
    if (views <= 0) status = "none";
    else if (pct <= band.lowDanger) status = "danger_low";
    else if (pct < band.lowOk) status = "low";
    else if (pct >= band.highDanger) status = "danger_high";
    else if (pct > band.highOk) status = "high";
    else status = "ok";
    const score = status === "ok" || status === "none" ? 100 : status === "low" || status === "high" ? 55 : 20;
    const mid = (band.lowOk + band.highOk) / 2;
    const aim = Math.round((views * mid) / 100);
    return { key, label: band.label, value, pct, status, score, aim, mid };
  });
  const scored = checks.filter((check) => check.status !== "none");
  const health = scored.length ? Math.round(scored.reduce((sum, check) => sum + check.score, 0) / scored.length) : 100;
  const suggestions = checks
    .filter((check) => check.status !== "ok" && check.status !== "none")
    .map((check) =>
      check.status === "high" || check.status === "danger_high"
        ? `Reduce ${check.key} or add more views: currently ${check.value.toLocaleString("en-IN")} (${check.pct.toFixed(2)}%). Aim ~${check.aim.toLocaleString("en-IN")} (${Math.round(check.mid)}%).`
        : `Add more ${check.key}: currently ${check.value.toLocaleString("en-IN")} (${check.pct.toFixed(2)}%). Try ~${check.aim.toLocaleString("en-IN")} (${Math.round(check.mid)}%).`,
    );
  return { checks, health, botting: 100 - health, suggestions, off: health < 100 };
}

export function curvePoints(kind: "s" | "steady" | "viral" | "double") {
  if (kind === "steady") return [0.08, 0.26, 0.46, 0.66, 0.84, 1];
  if (kind === "viral") return [0.02, 0.05, 0.12, 0.7, 0.92, 1];
  if (kind === "double") return [0.04, 0.42, 0.48, 0.55, 0.9, 1];
  return [0.04, 0.1, 0.22, 0.48, 0.78, 1];
}

export type GrowthPreset = {
  id: string;
  group: "popular" | "platform";
  title: string;
  hint: string;
  shape: (t: number) => number;
};

export const GROWTH_PRESETS: GrowthPreset[] = [
  { id: "instant", group: "popular", title: "Instant", hint: "Everything starts right away", shape: (t) => Math.pow(t, 0.22) },
  { id: "natural", group: "popular", title: "Natural", hint: "Fast first hours, then a long tail", shape: (t) => 1 - Math.pow(1 - t, 1.75) },
  { id: "viral", group: "popular", title: "Goes viral", hint: "Slow start, takes off, then levels out", shape: (t) => {
    const raw = 1 / (1 + Math.exp(-11 * (t - 0.58)));
    const start = 1 / (1 + Math.exp(11 * 0.58));
    const end = 1 / (1 + Math.exp(-11 * 0.42));
    return (raw - start) / (end - start);
  } },
  { id: "steady", group: "popular", title: "Steady", hint: "The same amount every hour", shape: (t) => t },
  { id: "organic", group: "platform", title: "Organic", hint: "Builds up, peaks midway, then fades", shape: (t) => t * t * (3 - 2 * t) },
  { id: "universal", group: "platform", title: "Universal", hint: "A small early peak, then a bigger one later", shape: (t) => (t < 0.32 ? (t / 0.32) * 0.22 : 0.22 + Math.pow((t - 0.32) / 0.68, 1.35) * 0.78) },
  { id: "whop", group: "platform", title: "Whop", hint: "A long high plateau with gentle waves", shape: (t) => Math.min(1, Math.max(0, t + Math.sin(t * Math.PI * 5) * 0.035 * (1 - Math.abs(t - 0.5) * 1.2))) },
  { id: "clipstake", group: "platform", title: "Clipstake", hint: "Two separate bursts", shape: (t) => (t < 0.16 ? (t / 0.16) * 0.4 : t < 0.58 ? 0.4 + ((t - 0.16) / 0.42) * 0.08 : t < 0.8 ? 0.48 + ((t - 0.58) / 0.22) * 0.4 : 0.88 + ((t - 0.8) / 0.2) * 0.12) },
  { id: "clipster", group: "platform", title: "Clipster", hint: "Early burst, then a long flat tail", shape: (t) => 1 - Math.pow(1 - t, 3.1) },
  { id: "picsart", group: "platform", title: "Picsart", hint: "Rolling waves of activity", shape: (t) => Math.min(1, Math.max(0, t + Math.sin(t * Math.PI * 6) * 0.045)) },
  { id: "crosswave", group: "platform", title: "Crosswave", hint: "Repeating crests and dips", shape: (t) => Math.min(1, Math.max(0, t + Math.sin(t * Math.PI * 8) * 0.06)) },
  { id: "vyro", group: "platform", title: "Vyro", hint: "Strong start that keeps a solid pace", shape: (t) => 0.42 * Math.pow(t, 0.4) + 0.58 * t },
  { id: "clipping", group: "platform", title: "Clipping.net", hint: "Grows in steps", shape: (t) => Math.min(1, Math.floor(t * 6) / 5 + (t * 6 - Math.floor(t * 6)) * 0.04) },
  { id: "rewards", group: "platform", title: "Content Rewards", hint: "Starts low and ramps up smoothly", shape: (t) => Math.pow(t, 1.65) },
  { id: "promote", group: "platform", title: "Promote.fun", hint: "Slow start, big rush at the end", shape: (t) => Math.pow(t, 2.7) },
  { id: "affiliates", group: "platform", title: "ClipAffiliates", hint: "Most of it late in the window", shape: (t) => Math.pow(t, 2.15) },
  { id: "overlap", group: "platform", title: "Overlap AI", hint: "Quick rise, then a smooth steady drip", shape: (t) => (t < 0.22 ? (t / 0.22) * 0.48 : 0.48 + ((t - 0.22) / 0.78) * 0.52) },
  { id: "gemmi", group: "platform", title: "Gemmi", hint: "Rising pulses", shape: (t) => {
    const step = Math.floor(t * 5);
    const frac = t * 5 - step;
    return Math.min(1, (step * (step + 1)) / 30 + frac * ((step + 1) / 15));
  } },
];

export function findGrowthPreset(id: string) {
  return GROWTH_PRESETS.find((item) => item.id === id) ?? GROWTH_PRESETS[1];
}

export function presetWeights(id: string, samples = 8) {
  const preset = findGrowthPreset(id);
  return Array.from({ length: samples }, (_, index) => {
    const from = preset.shape(index / samples);
    const to = preset.shape((index + 1) / samples);
    return Math.max(0.04, to - from);
  });
}

export function presetCumulative(id: string, steps = 42) {
  const preset = findGrowthPreset(id);
  return Array.from({ length: steps }, (_, index) => {
    const t = steps === 1 ? 1 : index / (steps - 1);
    return Math.max(0, Math.min(1, preset.shape(t)));
  });
}

export function graphBotScore(input: {
  views: number;
  likes: number;
  shares: number;
  saves: number;
  hours: number;
  runs: number;
  variance?: number;
  services?: { key: string; label: string; qty: number; runs: number; hours: number; floor: number }[];
}) {
  const views = Math.max(0, Math.floor(input.views));
  const hours = Math.max(0.25, Number(input.hours) || 1);
  const runs = Math.max(1, Math.floor(input.runs) || 1);
  const reasons: string[] = [];
  let score = 4;
  const likePct = views > 0 ? (input.likes / views) * 100 : 0;
  const sharePct = views > 0 ? (input.shares / views) * 100 : 0;
  const savePct = views > 0 ? (input.saves / views) * 100 : 0;
  const ratioCheck = (label: string, pct: number, qty: number, low: number, high: number, dead: number, hot: number) => {
    if (qty <= 0 || views < 100) return;
    if (pct < dead) {
      score += 26;
      reasons.push(`${label} ${qty.toLocaleString("en-IN")} / ${views.toLocaleString("en-IN")} views = ${pct.toFixed(2)}%. Ratio bahut kam hai. Graph dead lagega aur bot score high hai. ${low}% se ${high}% ke aas paas rakho.`);
    } else if (pct < low) {
      score += 12;
      reasons.push(`${label} ${pct.toFixed(2)}% views se kam hain. Graph weak hai. ${low}% se ${high}% behtar hai.`);
    } else if (pct > hot) {
      score += 28;
      reasons.push(`${label} ${qty.toLocaleString("en-IN")} / ${views.toLocaleString("en-IN")} views = ${pct.toFixed(1)}%. Views ke hisaab se bahut zyada hain. Graph galat ban raha hai aur bot score high hai.`);
    } else if (pct > high) {
      score += 12;
      reasons.push(`${label} ${pct.toFixed(1)}% thode zyada hain. ${low}% se ${high}% organic lagta hai.`);
    }
  };
  ratioCheck("Likes", likePct, input.likes, 2.5, 8, 1, 15);
  ratioCheck("Shares", sharePct, input.shares, 0.4, 2.5, 0.15, 6);
  ratioCheck("Saves", savePct, input.saves, 0.6, 3.5, 0.2, 8);
  const services = input.services ?? [{ key: "views", label: "Views", qty: views, runs, hours, floor: 100 }];
  for (const service of services) {
    if (service.qty <= 0) continue;
    const floor = Math.max(1, service.floor);
    const maxRuns = Math.max(1, Math.floor(service.qty / floor));
    const span = Math.max(0.25, service.hours || hours);
    const ideal = Math.max(3, Math.min(maxRuns, Math.round(Math.sqrt(service.qty) * Math.min(1.4, span / 18))));
    const low = Math.max(2, Math.round(ideal * 0.45));
    const high = Math.max(low + 1, Math.min(maxRuns, Math.round(ideal * 1.8)));
    if (service.runs <= 2 && service.qty >= floor * 4) {
      score += 18;
      reasons.push(`${service.label}: runs bahut kam hain (${service.runs}). Is delivery time mein lagbhag ${low}-${high} runs rakho, warna graph seedhi line banega.`);
    } else if (service.runs < low) {
      score += 10;
      reasons.push(`${service.label}: runs kam hain (${service.runs}). ${low}-${high} ke beech rakho taake graph smooth bane.`);
    } else if (service.runs > maxRuns) {
      score += 16;
      reasons.push(`${service.label}: runs bahut zyada hain (${service.runs}). ${service.qty.toLocaleString("en-IN")} quantity itne runs mein nahi bikharti. ${low}-${Math.max(low, maxRuns)} rakho.`);
    } else if (service.runs > high) {
      score += 10;
      reasons.push(`${service.label}: runs zyada hain (${service.runs}). Graph tukdon mein toot sakta hai. ${low}-${high} kaafi hain.`);
    }
    if (service.key === "views" && service.qty / span > 12000) {
      score += 16;
      reasons.push(`Views ka delivery time chhota hai (${span < 1 ? `${Math.round(span * 60)} min` : `${Math.round(span)}h`}). Graph tez chadhega. Time badhao.`);
    }
  }
  if (hours >= 18 && likePct >= 2.5 && likePct <= 8 && runs >= 8) score -= 6;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const tier = score <= 20
    ? { band: "0-20", name: "Significantly Low", action: "Safe zone. Graph smooth hai, approval chance high." }
    : score <= 40
      ? { band: "20-40", name: "Low", action: "Passing tier. Curve theek hai, clearance chance achha hai." }
      : score <= 60
        ? { band: "40-60", name: "Slight", action: "Graph tight hai. Neeche diye runs ya ratio correct karo." }
        : score <= 80
          ? { band: "60-80", name: "High Risk", action: "Bot score high hai. Graph galat ban raha hai, rejection chance zyada." }
          : { band: "80-100", name: "Very High", action: "Bot score bahut high hai. Ratio ya runs abhi galat hain." };
  if (reasons.length === 0) reasons.push("Views, likes, shares aur saves ka ratio aur runs is time ke hisaab se theek hain.");
  const checks = (input.services ?? []).filter((service) => service.qty > 0).map((service) => {
    const problems: string[] = [];
    const fixes: string[] = [];
    const floor = Math.max(1, service.floor);
    const maxRuns = Math.max(1, Math.floor(service.qty / floor));
    const span = Math.max(0.25, service.hours || hours);
    const ideal = Math.max(3, Math.min(maxRuns, Math.round(Math.sqrt(service.qty) * Math.min(1.4, span / 18))));
    const low = Math.max(2, Math.round(ideal * 0.45));
    const high = Math.max(low + 1, Math.min(maxRuns, Math.round(ideal * 1.8)));
    if (service.runs < low) {
      problems.push(`runs bahut kam hain (${service.runs}). Itne runs se line seedhi / spike banegi.`);
      fixes.push(`runs ${low} se ${high} kar do`);
    } else if (service.runs > high) {
      problems.push(`runs bahut zyada hain (${service.runs}). Quantity itne chhote tukdon mein nahi bikharti.`);
      fixes.push(`runs ${low} se ${high} kar do`);
    }
    if (service.key !== "views" && views >= 100) {
      const bands: Record<string, [number, number]> = { likes: [2.5, 8], shares: [0.4, 2.5], saves: [0.6, 3.5] };
      const band = bands[service.key];
      if (band) {
        const pct = (service.qty / views) * 100;
        const lowQty = Math.max(floor, Math.round((views * band[0]) / 100));
        const highQty = Math.max(lowQty, Math.round((views * band[1]) / 100));
        if (pct < band[0] * 0.7) {
          problems.push(`quantity views ke hisaab se bahut kam hai (${pct.toFixed(2)}%).`);
          fixes.push(`quantity ${lowQty.toLocaleString("en-IN")} se ${highQty.toLocaleString("en-IN")} rakho`);
        } else if (pct > band[1] * 1.4) {
          problems.push(`quantity views ke hisaab se bahut zyada hai (${pct.toFixed(1)}%).`);
          fixes.push(`quantity ${lowQty.toLocaleString("en-IN")} se ${highQty.toLocaleString("en-IN")} rakho`);
        }
      }
    }
    if (service.key === "views" && service.qty / span > 12000) {
      problems.push(`delivery time bahut chhota hai (${Math.round(span)}h). Graph tez chadhega.`);
      fixes.push("delivery time badha do, kam se kam 12-24 hours");
    }
    const ok = problems.length === 0;
    return {
      label: service.label,
      ok,
      title: ok ? `${service.label} ka graph theek hai` : `${service.label} ka graph sahi nahi ban raha`,
      why: ok ? `Runs ${service.runs} aur quantity is delivery time ke hisaab se organic range mein hain.` : problems.join(" "),
      fix: ok ? "" : `Fix: ${fixes.join(", ")}.`,
    };
  });
  return { score, ...tier, reasons, checks };
}

export const GROWTH_FAMILIES = [
  "random-walk",
  "s-curve",
  "viral-spike",
  "steady-climb",
  "double-peak",
  "burst-pause",
  "slow-burn",
  "late-surge",
  "staircase",
  "front-load",
  "night-drip",
  "morning-ramp",
] as const;

export const TEMPLATE_COUNT = 552;

export type GrowthTemplate = { id: number; name: (typeof GROWTH_FAMILIES)[number]; organic: number; seed: number };

export function growthTemplate(id: number): GrowthTemplate {
  const n = ((Math.floor(id) - 1) % TEMPLATE_COUNT + TEMPLATE_COUNT) % TEMPLATE_COUNT;
  return {
    id: n + 1,
    name: GROWTH_FAMILIES[n % GROWTH_FAMILIES.length],
    organic: 96 + (n % 4),
    seed: 17 + n * 13,
  };
}

export function listGrowthCatalog() {
  return Array.from({ length: TEMPLATE_COUNT }, (_, index) => {
    const template = growthTemplate(index + 1);
    return { id: template.id, name: template.name, organic: template.organic };
  });
}

function shape(name: string, t: number) {
  if (name === "s-curve") return 1 / (1 + Math.exp(-12 * (t - 0.5)));
  if (name === "viral-spike") return t < 0.18 ? t * 0.2 : Math.min(1, 0.08 + Math.pow(t, 0.72));
  if (name === "steady-climb") return t;
  if (name === "double-peak") return t < 0.42 ? t * 1.05 : t < 0.58 ? 0.44 : Math.min(1, 0.44 + (t - 0.58) * 1.35);
  if (name === "burst-pause") return Math.min(1, Math.floor(t * 5) / 4.2 + (t % 0.2) * 0.15);
  if (name === "slow-burn") return Math.pow(t, 1.7);
  if (name === "late-surge") return Math.pow(t, 2.6);
  if (name === "staircase") return Math.min(1, Math.floor(t * 7) / 6);
  if (name === "front-load") return Math.pow(t, 0.42);
  if (name === "night-drip") return t < 0.62 ? t * 0.45 : Math.min(1, 0.28 + (t - 0.62) * 1.9);
  if (name === "morning-ramp") return t < 0.3 ? Math.min(1, t * 2.1) : Math.min(1, 0.63 + (t - 0.3) * 0.53);
  return t;
}

export function growthSeries(id: number, steps = 84) {
  const template = growthTemplate(id);
  const points: number[] = [];
  for (let index = 0; index < steps; index += 1) {
    const t = index / (steps - 1);
    if (template.name === "random-walk") {
      const prev = points[index - 1] ?? 0;
      const step = 0.004 + mix(template.seed + index * 1.3) * 0.022;
      points.push(index === steps - 1 ? 1 : Math.min(0.992, prev + step));
      continue;
    }
    const noise = (mix(template.seed + index * 1.7) - 0.5) * 0.028;
    const value = Math.max(0, Math.min(1, shape(template.name, t) + noise));
    points.push(index === 0 ? 0 : Math.max(points[index - 1] ?? 0, value));
  }
  points[0] = 0;
  points[points.length - 1] = 1;
  return { ...template, points };
}

export function bestOrganicMix(views: number, floors?: Record<string, number>) {
  return mixFromRatios(views, { likes: 3.1, shares: 1.3, saves: 1.1, reposts: 0.8 }, floors);
}

export const SETTINGS_RATIO_DEFAULTS: Record<string, number> = {
  views: 100,
  likes: 5,
  comments: 2,
  saves: 1,
  shares: 1,
  reposts: 0.5,
  followers: 2,
  subscribers: 3,
  watch_hours: 5,
  retweets: 4,
};

const FULL_ENGAGEMENT_TYPES = ["likes", "shares", "reposts", "saves"];

/** Percents are the Settings sliders: likes 5 means 5% of views. */
export function mixFromRatios(
  views: number,
  ratios: Record<string, number>,
  floors?: Record<string, number>,
  types: string[] = FULL_ENGAGEMENT_TYPES,
) {
  const base = Math.max(0, Math.floor(views));
  const out: Record<string, number> = {};
  for (const type of types) {
    const pct = Number(ratios[type]);
    if (!Number.isFinite(pct) || pct <= 0) continue;
    const value = Math.round((base * pct) / 100);
    if (value <= 0) continue;
    out[type] = value;
  }
  return out;
}

export function organicOpening(input: { linkReady: boolean; quantities: Record<string, number>; botting: number }) {
  const views = input.quantities.views ?? 0;
  const likes = input.quantities.likes ?? 0;
  const shares = input.quantities.shares ?? 0;
  const saves = input.quantities.saves ?? 0;
  const tone = input.botting <= 20 ? "looks quite natural" : input.botting <= 45 ? "is moderate — you can still place it" : "is high — spread the mix out";
  const lead = input.linkReady
    ? "Link is on the page. I am reading the mix you selected, not the live post."
    : "Please paste your post link first so I can analyze it.";
  return `${lead}
You've selected ${likes.toLocaleString("en-IN")} likes, ${shares.toLocaleString("en-IN")} shares, ${saves.toLocaleString("en-IN")} saves, ${views.toLocaleString("en-IN")} views.
Botting risk is ${input.botting}% — ${tone}. You can ask —
'How many likes should I add?', 'Is this safe?', 'How long will delivery take?'`;
}

export function answerOrganic(question: string, input: {
  quantities: Record<string, number>;
  health: number;
  botting: number;
  hours: number;
  runs: number;
  peak: boolean;
  finish: string;
  ratios?: Record<string, number>;
}) {
  const q = question.toLowerCase();
  const views = input.quantities.views ?? 0;
  const likes = input.quantities.likes ?? 0;
  const ratios = { ...SETTINGS_RATIO_DEFAULTS, ...(input.ratios ?? {}) };
  const mix = mixFromRatios(views, ratios);
  const likePct = views > 0 ? (likes / views) * 100 : 0;
  if (q.includes("safe") || q.includes("risk") || q.includes("bot")) {
    return `Health is ${input.health}/100 and botting risk is ${input.botting}%. ${input.botting <= 20 ? "This mix is in a natural band." : input.botting <= 45 ? "Moderate risk. Raise variance above 35% or move likes toward about 7% of views." : "High risk. Cut the extras or add more views before you place it."} No outside AI is connected — this is the local check.`;
  }
  if (q.includes("long") || q.includes("time") || q.includes("deliver")) {
    return `Views are set for ${input.runs} runs over about ${input.hours < 1 ? `${Math.round(input.hours * 60)} minutes` : `${input.hours.toFixed(1)} hours`}. Finish lands around ${input.finish}. Peak hours boost is ${input.peak ? "on, so most of the quantity is pulled into 6–11 PM IST." : "off. Turn it on if you want the bigger drops between 6 and 11 PM IST."}`;
  }
  if (q.includes("comment")) {
    const have = input.quantities.comments ?? 0;
    const aim = Math.round((views * (ratios.comments || 0)) / 100);
    const delta = aim - have;
    return `On ${views.toLocaleString("en-IN")} views, settings uses ${ratios.comments}% comments. That is about ${aim.toLocaleString("en-IN")} comments (${delta >= 0 ? `add ${delta.toLocaleString("en-IN")}` : `you already have ${Math.abs(delta).toLocaleString("en-IN")} more than that`}). This is only an answer. The order was not changed.`;
  }
  if (q.includes("like")) {
    const aim = mix.likes ?? 0;
    const delta = aim - likes;
    return `You have ${likes.toLocaleString("en-IN")} likes on ${views.toLocaleString("en-IN")} views (${likePct.toFixed(2)}%). Settings is ${ratios.likes}% likes. Aim for about ${aim.toLocaleString("en-IN")} likes (${delta >= 0 ? `add ${delta.toLocaleString("en-IN")}` : `remove ${Math.abs(delta).toLocaleString("en-IN")}`}).`;
  }
  if (q.includes("ratio") || q.includes("suggest") || q.includes("best") || q.includes("mix")) {
    return `Settings mix for ${views.toLocaleString("en-IN")} views: ${(mix.likes ?? 0).toLocaleString("en-IN")} likes (${ratios.likes}%), ${(mix.shares ?? 0).toLocaleString("en-IN")} shares (${ratios.shares}%), ${(mix.saves ?? 0).toLocaleString("en-IN")} saves (${ratios.saves}%), ${(mix.reposts ?? 0).toLocaleString("en-IN")} reposts (${ratios.reposts}%).`;
  }
  return "I can only read this order. Ask: Is this safe? How long will delivery take? How many more likes should I add? Suggest the best ratio. An outside AI API is not connected yet.";
}

const ASK_TYPES = ["views", "likes", "comments", "shares", "saves", "reposts"] as const;

function readAskCount(raw: string, unit?: string) {
  const value = Number(String(raw || "").replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  const mark = (unit || "").toLowerCase();
  if (mark === "k") return Math.round(value * 1000);
  if (mark === "m") return Math.round(value * 1000000);
  return Math.round(value);
}

function grabAskCount(text: string, words: string[]) {
  const group = words.join("|");
  const before = new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?)\\s*(k|m)?\\s*(?:${group})\\b`, "i");
  const after = new RegExp(`\\b(?:${group})\\s*(?:=|of|:)?\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(k|m)?\\b`, "i");
  const hit = text.match(before) || text.match(after);
  if (!hit) return null;
  return readAskCount(hit[1], hit[2]);
}

function engagementTarget(text: string) {
  const ahead = text.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:engagement|engage)/i);
  const behind = text.match(/engagement[^.\n]{0,30}?(\d+(?:\.\d+)?)\s*(?:%|percent)/i);
  const value = ahead ? Number(ahead[1]) : behind ? Number(behind[1]) : null;
  if (value == null || !Number.isFinite(value) || value <= 0 || value > 80) return null;
  return value;
}

export type OrganicAsk = {
  mode: "answer" | "order";
  text: string;
  views?: number;
  mix?: Record<string, number>;
  variance?: number;
  window?: Pace["window"];
};

/** Turns a chat line into either an answer or a full order built from the saved ratios. */
export function planOrganicAsk(question: string, input: {
  views: number;
  quantities: Record<string, number>;
  ratios?: Record<string, number>;
  botting: number;
}): OrganicAsk | null {
  const text = question.trim();
  const q = text.toLowerCase();
  if (!q) return null;
  const ratios = { ...SETTINGS_RATIO_DEFAULTS, ...(input.ratios ?? {}) };
  const specified: Partial<Record<(typeof ASK_TYPES)[number], number>> = {};
  const words: Record<(typeof ASK_TYPES)[number], string[]> = {
    views: ["views", "view"],
    likes: ["likes", "like"],
    comments: ["comments", "comment"],
    shares: ["shares", "share"],
    saves: ["saves", "save"],
    reposts: ["reposts", "repost"],
  };
  for (const type of ASK_TYPES) {
    const count = grabAskCount(text, words[type]);
    if (count) specified[type] = count;
  }
  const engagement = engagementTarget(text);
  const past = /\b(already|pehle|dale the|daale the|daal chuka|lagaye the|laga chuka|ho chuke)\b/.test(q);
  const place = /\b(want|need|chahiye|chahta|chahti|lagao|lagana|lagane|set|order|grow|place|ready|bana|kar do|mujhe)\b/.test(q);
  const lowBot = /\b(bot|botting|risk)\b/.test(q) && /\b(low|kam|less|natural|safe|minimum|min)\b/.test(q);
  const asksMissing = /\b(how many|how much|kitne|kitna)\b/.test(q);
  const suggest = /\b(suggest the best|best ratio|best mix|apply the ratio|set the mix)\b/.test(q);
  const order = !past && (
    suggest
    || engagement != null
    || (Boolean(specified.views) && (place || asksMissing || Object.keys(specified).length > 1))
    || (place && Object.keys(specified).length > 0)
    || (lowBot && place)
  );
  if (!order) return null;
  const views = Math.max(100, specified.views || input.views || input.quantities.views || 10000);
  const mix: Record<string, number> = {};
  const parts = ["likes", "comments", "shares", "saves", "reposts"] as const;
  if (engagement != null) {
    const weight = parts.reduce((sum, type) => sum + (specified[type] ? 0 : Math.max(0, Number(ratios[type]) || 0)), 0) || 1;
    const reserved = parts.reduce((sum, type) => sum + (specified[type] || 0), 0);
    const remain = Math.max(0, engagement - (views > 0 ? (reserved / views) * 100 : 0));
    for (const type of parts) {
      if (specified[type]) {
        mix[type] = specified[type]!;
        continue;
      }
      const share = (Math.max(0, Number(ratios[type]) || 0) / weight) * (remain / 100);
      mix[type] = Math.max(0, Math.round(views * share));
    }
    const total = parts.reduce((sum, type) => sum + (mix[type] || 0), 0);
    const rate = views > 0 ? (total / views) * 100 : 0;
    return {
      mode: "order",
      views,
      mix,
      variance: lowBot ? 42 : undefined,
      window: lowBot ? "48h" : "auto",
      text: `Order set for ${engagement}% engagement on ${views.toLocaleString("en-IN")} views, using your settings ratio. ${parts.map((type) => `${(mix[type] || 0).toLocaleString("en-IN")} ${type}`).join(", ")}. Combined engagement is ${rate.toFixed(2)}%. Delivery time, runs, and interval are on Auto${lowBot ? ", with a 48 hour window so the botting risk stays lower" : ""}. You can still edit any of them.`,
    };
  }
  for (const type of parts) {
    if (specified[type]) mix[type] = specified[type]!;
    else mix[type] = Math.max(0, Math.round((views * (Number(ratios[type]) || 0)) / 100));
  }
  const named = parts.filter((type) => specified[type]);
  const filled = parts.filter((type) => !specified[type]);
  const rate = views > 0 ? (parts.reduce((sum, type) => sum + (mix[type] || 0), 0) / views) * 100 : 0;
  return {
    mode: "order",
    views,
    mix,
    variance: lowBot ? 42 : undefined,
    window: lowBot ? "48h" : "auto",
    text: `Order set. ${views.toLocaleString("en-IN")} views${named.length ? `, with your numbers for ${named.join(", ")}` : ""}. ${filled.length ? `${filled.join(", ")} follow your settings ratio. ` : ""}That is ${parts.map((type) => `${(mix[type] || 0).toLocaleString("en-IN")} ${type}`).join(", ")} (${rate.toFixed(2)}% engagement). Delivery time, runs, and interval are on Auto${lowBot ? ", with a 48 hour window so botting stays lower" : ""}. Current botting on the old mix was ${input.botting}%. You can still edit any field.`,
  };
}

export type PreviewPlan = { hours: number; runs: number; variance?: number; peak?: boolean; curve?: number[]; gapMinutes?: number };

const PREVIEW_SPECS = [
  { key: "views", color: "#c084fc", label: "Views", floor: 100 },
  { key: "likes", color: "#60a5fa", label: "Likes", floor: 10 },
  { key: "shares", color: "#22d3ee", label: "Shares", floor: 10 },
  { key: "saves", color: "#f472b6", label: "Saves", floor: 50 },
] as const;

/** Same curve, bot score and engagement rate the Full Engagement preview draws. */
export function growthPreview(input: {
  quantities: Record<string, number>;
  delivery?: Record<string, PreviewPlan>;
  origin?: number;
  drops?: { type: string; at: number; amount: number }[];
}) {
  const quantities = input.quantities || {};
  const delivery = input.delivery || {};
  const given = (input.drops || []).filter((drop) => drop.amount > 0 && Number.isFinite(drop.at));
  const lag: Record<string, number> = { views: 0, likes: 0.05, shares: 0.09, saves: 0.13 };
  const planned = PREVIEW_SPECS.map((spec) => {
    const qty = Math.max(0, Math.floor(Number(quantities[spec.key]) || 0));
    const plan = delivery[spec.key];
    const own = given.filter((drop) => drop.type === spec.key).sort((a, b) => a.at - b.at);
    const runs = own.length > 0 ? own.length : qty > 0 ? Math.max(1, Math.floor(Number(plan?.runs) || 0) || autoRuns(qty, spec.key)) : 0;
    const ownSpan = own.length > 1 ? (own[own.length - 1].at - own[0].at) / 3600000 : 0;
    const hours = ownSpan > 0 ? ownSpan : qty > 0 ? Math.max(1 / 60, Number(plan?.hours) || windowHours(DEFAULT_PACE, Math.max(runs, 1))) : 0;
    return { ...spec, qty, runs, hours, variance: Number(plan?.variance ?? 25), peak: Boolean(plan?.peak), curve: plan?.curve, gapMinutes: plan?.gapMinutes };
  });
  const span = Math.max(1 / 60, ...planned.map((item) => item.hours), given.length > 1 ? (Math.max(...given.map((drop) => drop.at)) - Math.min(...given.map((drop) => drop.at))) / 3600000 : 0);
  const steps = 96;
  const origin = given.length ? Math.min(...given.map((drop) => drop.at)) : (input.origin ?? Date.now());
  const ceiling = Math.max(Math.floor(Number(quantities.views) || 0), 1);
  const drawn = planned.map((spec) => {
    if (spec.qty <= 0) return { ...spec, points: Array.from({ length: steps }, () => 0), batches: Array.from({ length: steps }, () => 0), totals: Array.from({ length: steps }, () => 0) };
    const scheduled = given.filter((drop) => drop.type === spec.key).sort((a, b) => a.at - b.at);
    const drops = scheduled.length
      ? scheduled.map((drop) => ({ at: new Date(drop.at), amount: drop.amount }))
      : planDrops({
          quantity: spec.qty,
          type: spec.key,
          runs: spec.runs,
          hours: spec.hours,
          curve: spec.curve,
          variance: spec.variance,
          peak: spec.peak,
          gapMinutes: spec.gapMinutes,
          start: new Date(origin + (spec.gapMinutes ? 0 : (lag[spec.key] ?? 0) * spec.hours * 3600000)),
        });
    let acc = 0;
    let cursor = 0;
    const raw = Array.from({ length: steps }, (_, index) => {
      const at = origin + (index / (steps - 1)) * span * 3600000;
      let step = 0;
      while (cursor < drops.length && drops[cursor].at.getTime() <= at + 1000) {
        acc += drops[cursor].amount;
        step += drops[cursor].amount;
        cursor += 1;
      }
      const total = Math.min(spec.qty, acc);
      return { total: Math.sqrt(Math.min(1, total / ceiling)), batch: Math.sqrt(Math.min(1, step / ceiling)), amount: total };
    });
    return { ...spec, points: raw.map((point) => point.total), batches: raw.map((point) => point.batch), totals: raw.map((point) => point.amount) };
  });
  const views = Math.max(0, Math.floor(Number(quantities.views) || 0));
  const likes = Math.max(0, Math.floor(Number(quantities.likes) || 0));
  const shares = Math.max(0, Math.floor(Number(quantities.shares) || 0));
  const saves = Math.max(0, Math.floor(Number(quantities.saves) || 0));
  const viewLine = planned.find((item) => item.key === "views");
  const bot = graphBotScore({
    views,
    likes,
    shares,
    saves,
    hours: viewLine?.hours || span,
    runs: viewLine?.runs || 1,
    variance: viewLine?.variance,
    services: planned.filter((item) => item.qty > 0).map((item) => ({
      key: item.key,
      label: item.label,
      qty: item.qty,
      runs: item.runs,
      hours: item.hours,
      floor: item.floor,
    })),
  });
  const engagement = likes + shares + saves;
  return { drawn, bot, span, steps, origin, views, likes, shares, saves, engagement, rate: views > 0 ? (engagement / views) * 100 : 0 };
}

