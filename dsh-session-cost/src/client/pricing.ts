/**
 * Cost + peak/valley pricing logic for dsh-session-cost.
 *
 * DeepSeek peak/valley (峰谷) pricing — peak windows unchanged since the
 * 2026-08-17 switch, but the price book was cut later in 2026 and the official
 * page now publishes USD rates (source: api-docs.deepseek.com/quick_start/pricing):
 *   - PEAK windows (Beijing time): 09:00–12:00 and 14:00–18:00, weekdays only
 *     (Saturday and Sunday are priced idle all day)
 *   - IDLE (all other times): priced at exactly 1/2 of the peak rate
 *
 * 2026-09 price book (per 1M tokens, PEAK, USD):
 *   deepseek-flash  : input 0.30 / cache-hit 0.006 / output 1.20
 *   deepseek-v4-pro : input 1.32 / cache-hit 0.044 / output 3.96
 * The legacy ids deepseek-v4-flash / deepseek-v4-flash-vision-exp are still
 * accepted by the API and billed at the Flash price.
 *
 * All of this is pure reference estimation for the UI. The real bill is
 * settled by the provider; the numbers here only help the user gauge cost and
 * avoid peak hours.
 */

/** Peak windows as [startMinute, endMinute) within a 24h day (Beijing hours). */
export const PEAK_WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [9 * 60, 12 * 60],
  [14 * 60, 18 * 60],
]

/** Idle price factor (off-peak is half of peak). */
export const IDLE_PRICE_FACTOR = 0.5

/**
 * Fixed CNY-per-USD rate used to display estimates in ¥ — the official price
 * book is quoted in USD, so the ¥ figures here are only as good as this rate.
 */
export const USD_TO_CNY = 7.1

/** Model id used when the current model cannot be determined on the client. */
export const DEFAULT_MODEL = 'deepseek-flash'

/**
 * Peak unit prices in USD per 1M tokens. PEAK rates; idle applies
 * IDLE_PRICE_FACTOR. Edit this table to update prices — it is the single source.
 */
export const COST_PRICES_USD: Record<string, { input: number; cacheHit: number; output: number }> = {
  'deepseek-flash': { input: 0.3, cacheHit: 0.006, output: 1.2 },
  // Legacy ids, still accepted and billed at the Flash price:
  'deepseek-v4-flash': { input: 0.3, cacheHit: 0.006, output: 1.2 },
  'deepseek-v4-flash-vision-exp': { input: 0.3, cacheHit: 0.006, output: 1.2 },
  'deepseek-v4-pro': { input: 1.32, cacheHit: 0.044, output: 3.96 },
}

/** Convert one USD price row into the CNY row the estimators use. */
function toCny(price: { input: number; cacheHit: number; output: number }) {
  return {
    input: price.input * USD_TO_CNY,
    cacheHit: price.cacheHit * USD_TO_CNY,
    output: price.output * USD_TO_CNY,
  }
}

/** CNY price for one model id, falling back to DEFAULT_MODEL when unknown. */
export function priceOf(modelId: string | undefined): { input: number; cacheHit: number; output: number } {
  const id = modelId ?? DEFAULT_MODEL
  return toCny(COST_PRICES_USD[id] ?? COST_PRICES_USD[DEFAULT_MODEL])
}

/**
 * Whether a given Beijing-local minute-of-day falls inside a peak window
 * (time-of-day only — use {@link isPeakTime} to also exclude weekends).
 * @param minutesOfDay - minute-of-day in Beijing time (0..1439).
 */
export function isPeakMinute(minutesOfDay: number): boolean {
  return PEAK_WINDOWS.some(([start, end]) => minutesOfDay >= start && minutesOfDay < end)
}

/** Weekend days in `Date#getUTCDay` convention: 0 = Sunday, 6 = Saturday. */
export const WEEKEND_DAYS: ReadonlyArray<number> = [0, 6]

/**
 * Whether a Beijing-local instant falls inside a peak window. Peak windows
 * apply on weekdays only: Saturday and Sunday (双休日) are idle — half price —
 * all day, regardless of the time of day.
 * @param minutesOfDay - minute-of-day in Beijing time (0..1439).
 * @param weekday      - Beijing-local day of week (0=Sunday .. 6=Saturday).
 */
export function isPeakTime(minutesOfDay: number, weekday: number): boolean {
  if (weekday === 0 || weekday === 6) return false
  return isPeakMinute(minutesOfDay)
}

/**
 * Estimate the whole-session cost in CNY from token usage totals, priced at
 * the given model's unit rates and the current peak/idle factor.
 * @param uncachedInput - uncached input tokens (¥ input/M).
 * @param cacheRead     - cache-hit input tokens (¥ cacheHit/M).
 * @param output        - output tokens (¥ output/M).
 * @param peak          - whether to use peak (true) or idle (false) rate.
 * @param price         - the model's unit price table.
 * @returns estimated CNY amount.
 */
export function estimateCost(
  uncachedInput: number,
  cacheRead: number,
  output: number,
  peak: boolean,
  price: { input: number; cacheHit: number; output: number },
): number {
  const factor = peak ? 1 : IDLE_PRICE_FACTOR
  return factor * (
    (uncachedInput / 1e6) * price.input +
    (cacheRead / 1e6) * price.cacheHit +
    (output / 1e6) * price.output
  )
}

/** Format a CNY amount compactly (e.g. 0.0123 → "0.01", 12.345 → "12.35"). */
export function formatCny(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0.00'
  if (amount < 0.01) return '<0.01'
  return amount.toFixed(2)
}
