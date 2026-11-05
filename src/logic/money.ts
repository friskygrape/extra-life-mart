/** Bills and coins available in the change tray, in cents, largest first. */
export const DENOMINATIONS = [2000, 1000, 500, 100, 50, 25, 10, 5] as const;

/** There are no pennies, so cash totals round to the nearest 5 cents. Card stays exact. */
export function roundToNickel(cents: number): number {
  return Math.round(cents / 5) * 5;
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** What a customer hands over: always more than the total, in amounts people really pay with. */
export function customerTender(total: number, rng: () => number = Math.random): number {
  const options = [100, 500, 1000, 2000, 5000, 10000]
    .map((step) => (Math.floor(total / step) + 1) * step)
    .filter((amount, i, all) => all.indexOf(amount) === i);
  // Prefer the smaller amounts, and keep to the three closest to the total.
  const sorted = options.sort((a, b) => a - b).slice(0, 3);
  return sorted[Math.floor(rng() * sorted.length)];
}
