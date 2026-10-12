/**
 * dsh-compaction-counter — locale dictionaries.
 * Chinese is the product copy; English mirrors it.
 */

/** Simplified Chinese dictionary (source of truth for keys). */
export const zh = {
  'compact.label': '压缩',
  'compact.value': '{count} 次',
  'compact.failed': '失败 {count}',
  'compact.aria': '本会话上下文压缩计数',
  'compact.tip.auto': '自动压缩：{count} 次',
  'compact.tip.manual': '手动压缩（/compact）：{count} 次',
  'compact.tip.failed': '压缩失败：{count} 次',
  'compact.tip.shadowed': '累计折叠上下文：≈ {tokens} tokens',
  'compact.tip.prunes': '工具结果修剪：{count} 次（≈ {tokens} tokens）',
  'compact.tip.last': '最近一次：{time} · {model}（{provider}，≈ {tokens} tokens）',
} satisfies Record<string, string>

/** The `compaction-counter` namespace key union. */
export type CompactionCounterKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'compact.label': 'Compacted',
  'compact.value': '{count}×',
  'compact.failed': '{count} failed',
  'compact.aria': 'Context compactions in this session',
  'compact.tip.auto': 'Automatic compactions: {count}',
  'compact.tip.manual': 'Manual compactions (/compact): {count}',
  'compact.tip.failed': 'Failed compact attempts: {count}',
  'compact.tip.shadowed': 'Context folded away in total: ≈ {tokens} tokens',
  'compact.tip.prunes': 'Tool-result prunes: {count} (≈ {tokens} tokens)',
  'compact.tip.last': 'Latest: {time} · {model} ({provider}, ≈ {tokens} tokens)',
} satisfies Record<CompactionCounterKey, string>

/** Locale namespace id registered under ctx.locale. */
export const NS = 'compaction-counter'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The compaction-counter copy. */
    [NS]: CompactionCounterKey
  }
}
