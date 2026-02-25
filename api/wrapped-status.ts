import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Returns whether the "Wrapped" annual recap is currently available and which
 * year it covers, based on the *server* clock.
 *
 * Availability window:
 *   - December  (month 11) → wrappedYear = current calendar year (e.g. Dec 2025 → 2025)
 *   - January   (month  0) → wrappedYear = previous calendar year (e.g. Jan 2026 → 2025)
 *   - All other months     → not available
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed: 0 = Jan, 11 = Dec
  const year = now.getFullYear();

  let available = false;
  let wrappedYear = year - 1;

  if (month === 11) {
    // December: the current year's data is now complete (or nearly so)
    available = true;
    wrappedYear = year;
  } else if (month === 0) {
    // January: still showing last year's recap
    available = true;
    wrappedYear = year - 1;
  }

  res
    .status(200)
    .setHeader("Cache-Control", "no-store")
    .json({ available, year: wrappedYear });
}
