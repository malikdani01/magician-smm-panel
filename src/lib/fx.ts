/** Provider rates are USD per 1,000. The desk shows INR. */
export const USD_TO_INR = 84;

/** 8, 9, or 10 extra per 1,000, in the provider panel's own currency. */
export function sellMarkupMajor(seed: string | number) {
  const digits = String(seed).replace(/\D/g, "");
  const n = Number(digits.slice(-4) || "0");
  return 8 + (n % 3);
}

/** Same extra, stored as INR paise. Prefer sellMarkupMajor plus the provider currency. */
export function sellMarkupPaise(seed: string | number) {
  return sellMarkupMajor(seed) * 100;
}

export function usdQtyToPaise(ratePerThousandUsd: number, quantity: number) {
  if (!Number.isFinite(ratePerThousandUsd) || !Number.isFinite(quantity) || quantity <= 0) return 0;
  return Math.max(1, Math.round((quantity / 1000) * ratePerThousandUsd * USD_TO_INR * 100));
}
