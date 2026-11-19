export type DeskCurrency = {
  code: string;
  symbol: string;
  locale: string;
  name: string;
  digits: number;
  flag: string;
};

export const CURRENCIES: DeskCurrency[] = [
  { code: "INR", symbol: "₹", locale: "en-IN", name: "Indian Rupee", digits: 2, flag: "🇮🇳" },
  { code: "USD", symbol: "$", locale: "en-US", name: "US Dollar", digits: 2, flag: "🇺🇸" },
  { code: "PKR", symbol: "Rs ", locale: "en-PK", name: "Pakistani Rupee", digits: 2, flag: "🇵🇰" },
  { code: "EUR", symbol: "€", locale: "de-DE", name: "Euro", digits: 2, flag: "🇪🇺" },
  { code: "GBP", symbol: "£", locale: "en-GB", name: "British Pound", digits: 2, flag: "🇬🇧" },
  { code: "AED", symbol: "AED ", locale: "en-AE", name: "UAE Dirham", digits: 2, flag: "🇦🇪" },
  { code: "SAR", symbol: "SAR ", locale: "ar-SA", name: "Saudi Riyal", digits: 2, flag: "🇸🇦" },
  { code: "BDT", symbol: "৳", locale: "bn-BD", name: "Bangladeshi Taka", digits: 2, flag: "🇧🇩" },
  { code: "TRY", symbol: "₺", locale: "tr-TR", name: "Turkish Lira", digits: 2, flag: "🇹🇷" },
  { code: "MYR", symbol: "RM ", locale: "ms-MY", name: "Malaysian Ringgit", digits: 2, flag: "🇲🇾" },
  { code: "CAD", symbol: "C$", locale: "en-CA", name: "Canadian Dollar", digits: 2, flag: "🇨🇦" },
  { code: "AUD", symbol: "A$", locale: "en-AU", name: "Australian Dollar", digits: 2, flag: "🇦🇺" },
  { code: "JPY", symbol: "¥", locale: "ja-JP", name: "Japanese Yen", digits: 0, flag: "🇯🇵" },
  { code: "CNY", symbol: "¥", locale: "zh-CN", name: "Chinese Yuan", digits: 2, flag: "🇨🇳" },
  { code: "SGD", symbol: "S$", locale: "en-SG", name: "Singapore Dollar", digits: 2, flag: "🇸🇬" },
  { code: "QAR", symbol: "QAR ", locale: "en-QA", name: "Qatari Riyal", digits: 2, flag: "🇶🇦" },
  { code: "KWD", symbol: "KWD ", locale: "en-KW", name: "Kuwaiti Dinar", digits: 3, flag: "🇰🇼" },
  { code: "OMR", symbol: "OMR ", locale: "en-OM", name: "Omani Rial", digits: 3, flag: "🇴🇲" },
  { code: "BHD", symbol: "BHD ", locale: "en-BH", name: "Bahraini Dinar", digits: 3, flag: "🇧🇭" },
  { code: "NZD", symbol: "NZ$", locale: "en-NZ", name: "New Zealand Dollar", digits: 2, flag: "🇳🇿" },
  { code: "CHF", symbol: "CHF ", locale: "de-CH", name: "Swiss Franc", digits: 2, flag: "🇨🇭" },
  { code: "ZAR", symbol: "R ", locale: "en-ZA", name: "South African Rand", digits: 2, flag: "🇿🇦" },
  { code: "NGN", symbol: "₦", locale: "en-NG", name: "Nigerian Naira", digits: 2, flag: "🇳🇬" },
  { code: "IDR", symbol: "Rp ", locale: "id-ID", name: "Indonesian Rupiah", digits: 0, flag: "🇮🇩" },
  { code: "THB", symbol: "฿", locale: "th-TH", name: "Thai Baht", digits: 2, flag: "🇹🇭" },
  { code: "PHP", symbol: "₱", locale: "en-PH", name: "Philippine Peso", digits: 2, flag: "🇵🇭" },
  { code: "VND", symbol: "₫", locale: "vi-VN", name: "Vietnamese Dong", digits: 0, flag: "🇻🇳" },
  { code: "EGP", symbol: "E£", locale: "en-EG", name: "Egyptian Pound", digits: 2, flag: "🇪🇬" },
  { code: "LKR", symbol: "Rs ", locale: "si-LK", name: "Sri Lankan Rupee", digits: 2, flag: "🇱🇰" },
  { code: "NPR", symbol: "Rs ", locale: "ne-NP", name: "Nepalese Rupee", digits: 2, flag: "🇳🇵" },
  { code: "KRW", symbol: "₩", locale: "ko-KR", name: "South Korean Won", digits: 0, flag: "🇰🇷" },
  { code: "HKD", symbol: "HK$", locale: "en-HK", name: "Hong Kong Dollar", digits: 2, flag: "🇭🇰" },
  { code: "MXN", symbol: "MX$", locale: "es-MX", name: "Mexican Peso", digits: 2, flag: "🇲🇽" },
  { code: "BRL", symbol: "R$", locale: "pt-BR", name: "Brazilian Real", digits: 2, flag: "🇧🇷" },
];

export const CURRENCY_PRESETS = CURRENCIES;
export const CURRENCY_KEY = "mg-display-currency";

let base: DeskCurrency = CURRENCIES[0];
let display: DeskCurrency = CURRENCIES[0];
let rates: Record<string, number> = { INR: 1 };
let fxUpdated = 0;
let fxStale = false;
let tick = 0;
const listeners = new Set<() => void>();

export function findCurrency(code: string): DeskCurrency {
  const hit = CURRENCIES.find((item) => item.code === code.toUpperCase());
  return hit ?? { ...CURRENCIES[0], code: code.toUpperCase().slice(0, 8) };
}

export function parseCurrency(raw: string): DeskCurrency {
  const code = String(raw || "").split("|")[0] || "INR";
  return findCurrency(code);
}

export function packCurrency(item: DeskCurrency) {
  return item.code;
}

function bump() {
  tick += 1;
  listeners.forEach((fn) => fn());
}

export function subscribeCurrency(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function currencySnapshot() {
  return `${base.code}|${display.code}|${tick}|${fxUpdated}`;
}

export function moneyState() {
  return { base, display, fxUpdated, fxStale, rate: rateFor(display.code) };
}

export function applyCurrency(next: DeskCurrency) {
  applyDisplay(next);
}

export function applyDisplay(next: DeskCurrency) {
  display = findCurrency(next.code);
  if (typeof window !== "undefined") {
    try { localStorage.setItem(CURRENCY_KEY, display.code); } catch { /* ignore */ }
  }
  bump();
}

export function applyBase(next: DeskCurrency) {
  base = findCurrency(next.code);
  if (!rates[base.code]) rates = { ...rates, [base.code]: 1 };
  bump();
}

export function applyFx(next: { rates: Record<string, number>; updatedAt: number; stale?: boolean; base?: string }) {
  if (next.base) base = findCurrency(next.base);
  const clean: Record<string, number> = {};
  for (const [code, value] of Object.entries(next.rates || {})) {
    const rate = Number(value);
    if (rate > 0 && Number.isFinite(rate)) clean[code.toUpperCase()] = rate;
  }
  clean[base.code] = 1;
  rates = clean;
  fxUpdated = Number(next.updatedAt) || 0;
  fxStale = Boolean(next.stale);
  bump();
}

export function savedDisplayCode() {
  if (typeof window === "undefined") return "";
  try { return localStorage.getItem(CURRENCY_KEY) || ""; } catch { return ""; }
}

function rateFor(code: string) {
  if (code === base.code) return 1;
  const rate = rates[code];
  return rate > 0 ? rate : 0;
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Stored minor units (paise of the base currency) → display major units. */
export function fromMinor(minor: number) {
  const major = (Number(minor) || 0) / 100;
  const rate = rateFor(display.code);
  if (!rate) return major;
  return roundTo(major * rate, display.digits);
}

/** Display major units → stored base minor units. Picks the paise that shows back closest to the typed amount. */
export function toBaseMinor(displayMajor: number) {
  const rate = rateFor(display.code);
  const major = Number(displayMajor) || 0;
  if (!rate) return Math.round(major * 100);
  const target = roundTo(major, display.digits);
  const guess = Math.round((target / rate) * 100);
  const span = Math.max(4, Math.ceil(rate) + 2);
  let best = guess;
  let bestErr = Infinity;
  for (let candidate = guess - span; candidate <= guess + span; candidate++) {
    const shown = roundTo((candidate / 100) * rate, display.digits);
    const err = Math.abs(shown - target);
    if (err < bestErr) {
      best = candidate;
      bestErr = err;
    }
  }
  return best;
}

/** Format a number that is already in the user's currency. Does not convert. */
export function formatMajor(major: number) {
  const value = Number(major) || 0;
  const negative = value < 0;
  const abs = roundTo(Math.abs(value), display.digits);
  const whole = Math.abs(abs - Math.round(abs)) < 1e-8;
  const formatted = abs.toLocaleString(display.locale || "en-IN", {
    minimumFractionDigits: whole ? 0 : display.digits,
    maximumFractionDigits: whole ? 0 : display.digits,
  });
  return `${negative ? "-" : ""}${display.symbol}${formatted}`;
}

export function inr(minor: number) {
  const negative = (Number(minor) || 0) < 0;
  const amount = fromMinor(Math.abs(Number(minor) || 0));
  const formatted = amount.toLocaleString(display.locale || "en-IN", {
    minimumFractionDigits: display.digits,
    maximumFractionDigits: display.digits,
  });
  return `${negative ? "-" : ""}${display.symbol}${formatted}`;
}

export function moneyCode() {
  return display.code;
}

/** Convert a major amount from one currency to another using the loaded rates. Null if a rate is missing. */
export function convertMajor(amount: number, fromCode: string, toCode: string) {
  const from = fromCode.toUpperCase();
  const to = toCode.toUpperCase();
  const value = Number(amount) || 0;
  if (from === to) return roundTo(value, findCurrency(to).digits);
  const fromRate = rateFor(from);
  const toRate = rateFor(to);
  if (!fromRate || !toRate) return null;
  return roundTo((value / fromRate) * toRate, findCurrency(to).digits);
}

/** 1 USD in `code`, 8 PKR under the live rate. Returns null if rates are not loaded. */
export function usdtQuote(code: string) {
  const quote = code.toUpperCase();
  const live = convertMajor(1, "USD", quote);
  if (live == null || live <= 0) return null;
  if (quote === "USD") return 1;
  const discount = convertMajor(8, "PKR", quote) ?? 0;
  return roundTo(Math.max(live * 0.5, live - discount), findCurrency(quote).digits);
}

export function compact(n: number) {
  return new Intl.NumberFormat(display.locale || "en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
