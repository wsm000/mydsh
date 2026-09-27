/**
 * dsh-session-cost — locale dictionaries.
 * Chinese is the product copy; English mirrors it.
 */

/** Simplified Chinese dictionary (source of truth for keys). */
export const zh = {
  'cost.label': '会话费用',
  'cost.value': '≈ ¥{amount}',
  'cost.tooltip': '按 {model} 的单价估算整个会话的费用；参考价，实际账单可能因峰谷时段/优惠而不同。',
  'steps.label': '步数',
  'period.peak': '当前：高峰时段',
  'period.idle': '当前：空闲时段（半价）',
  'period.peakShort': '高峰价',
  'period.idleShort': '空闲半价',
  'period.tooltip.peak': '高峰时段（仅工作日，北京时间 9:00–12:00、14:00–18:00），价格为空闲时段的两倍；双休日全天空闲。',
  'period.tooltip.idle': '空闲时段（每周双休日全天，以及工作日北京时间 0:00–9:00、12:00–14:00、18:00–24:00），价格为高峰时段的一半。',
} satisfies Record<string, string>

/** The `session-cost` namespace key union. */
export type SessionCostKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'cost.label': 'Session cost',
  'cost.value': '≈ ¥{amount}',
  'cost.tooltip': 'Estimated for the whole session at {model} unit prices; reference only, actual billing may differ by peak/valley period or discounts.',
  'steps.label': 'Steps',
  'period.peak': 'Currently: peak hours',
  'period.idle': 'Currently: off-peak (half price)',
  'period.peakShort': 'peak rate',
  'period.idleShort': 'off-peak (half)',
  'period.tooltip.peak': 'Peak hours (weekdays only, Beijing 9:00–12:00 and 14:00–18:00); prices are 2× the off-peak rate. Weekends are off-peak all day.',
  'period.tooltip.idle': 'Off-peak hours (all day Saturday & Sunday, plus weekdays 0:00–9:00, 12:00–14:00, 18:00–24:00 Beijing); prices are half the peak rate.',
} satisfies Record<SessionCostKey, string>

/** Locale namespace id registered under ctx.locale. */
export const NS = 'session-cost'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The session cost / api-calls / peak-valley copy. */
    [NS]: SessionCostKey
  }
}
