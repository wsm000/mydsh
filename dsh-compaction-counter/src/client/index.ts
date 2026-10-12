/**
 * dsh-compaction-counter client plugin: the browser half. Registers a compact
 * status chip into the conversation session header ("…" row) showing how many
 * times this conversation's context has been compacted:
 *
 *   • `压缩 N 次` — successful summarizing compactions (auto + manual),
 *   • a red `失败 M` badge when an attempt closed with an error,
 *
 * with the details in the tooltip: auto/manual split, how many tokens the
 * summaries folded away in total, which route wrote the newest one, and the
 * model-free tool-result prunes counted separately.
 *
 * The number is a whole-session figure read from the `compactionStats`
 * projection, so paging history or the compaction itself never changes it.
 * There is no host call in the component and no wire traffic of its own.
 *
 * @module dsh-compaction-counter/client
 */
import { memo } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: the conversation SlotMap merge for the header-actions seat, the
// locale namespace map, and the `compactionStats` projection key.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { CompactionStats } from '../types.ts'
import { NS, en, zh } from './locales.ts'
import { adoptStyles } from './styles.ts'

/** Required services: the slot registry and the locale dictionary. */
export const inject = ['slots', 'locale']

/** §-separated session-stat row shape used by the header-actions seat. */
type CompactionChipProps = PropsRuntime<'conversation.session.header.actions'> & PropsLocale<typeof NS>

/**
 * Format a token estimate compactly, keeping one decimal while it still adds
 * information (960 → "960", 23 257 → "23.3k", 232 570 → "233k",
 * 1 250 000 → "1.25M").
 * @param value - the token figure.
 * @returns the display string.
 */
function formatTokens(value: number): string {
  if (value < 1000) return String(value)
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 100_000 ? 1 : 0)}k`
  return `${(value / 1_000_000).toFixed(2)}M`
}

/**
 * Format an instant as local wall time, minute precision.
 * @param value - epoch milliseconds.
 * @returns "MM-DD HH:mm" in the viewer's timezone.
 */
function formatTime(value: number): string {
  const date = new Date(value)
  const pad = (part: number): string => String(part).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * The header status chip. Renders whenever the `compactionStats` projection is
 * available — including the zero case, because "0 次" is the answer to "has
 * this context been compacted at all?" — and renders nothing only while the
 * capability is absent (host unit unmounted, or no baseline yet).
 * @param props - standard kit (sessionId, useProjection) + the `t` locale seat.
 */
export function CompactionChipView({ useProjection, t }: CompactionChipProps): React.JSX.Element | null {
  const stats = useProjection('compactionStats') as CompactionStats | undefined
  if (stats === undefined) return null

  const { count, manual, failed, prunes, shadowedTokens, prunedTokens, lastTime, lastProvider, lastModel, lastShadowedTokens } = stats

  const automatic = Math.max(0, count - manual)
  const lines = [t('compact.tip.auto', { count: automatic })]
  if (manual > 0) lines.push(t('compact.tip.manual', { count: manual }))
  if (failed > 0) lines.push(t('compact.tip.failed', { count: failed }))
  if (shadowedTokens > 0) lines.push(t('compact.tip.shadowed', { tokens: formatTokens(shadowedTokens) }))
  if (lastTime !== null && lastModel !== null) {
    lines.push(t('compact.tip.last', {
      time: formatTime(lastTime),
      model: lastModel,
      provider: lastProvider ?? '—',
      tokens: formatTokens(lastShadowedTokens ?? 0),
    }))
  }
  if (prunes > 0) lines.push(t('compact.tip.prunes', { count: prunes, tokens: formatTokens(prunedTokens) }))

  return (
    <span className="dsh_cc_chip" role="group" aria-label={t('compact.aria')} title={lines.join('\n')}>
      <span className="dsh_cc_label">{t('compact.label')}</span>
      <span className="dsh_cc_count">{t('compact.value', { count })}</span>
      {failed > 0 && <span className="dsh_cc_failed">{t('compact.failed', { count: failed })}</span>}
    </span>
  )
}

/** The registered occupant: the same view, memoized across projection snapshots. */
export const CompactionChip = memo(CompactionChipView)

/**
 * Compose the compaction-counter surface.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-compaction-counter: dictionaries')

  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'compaction-counter',
    order: 61,
    locale: NS,
  }, CompactionChip))
}
