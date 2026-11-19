/** True only when the provider explicitly says this service supports drip-feed. */
export function dripEnabled(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const flag = value.trim().toLowerCase();
    return flag === "1" || flag === "true" || flag === "yes" || flag === "on";
  }
  return false;
}
