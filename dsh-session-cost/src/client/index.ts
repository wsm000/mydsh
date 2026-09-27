/**
 * dsh-session-cost client plugin: the browser half. Registers a compact
 * status chip into the conversation session header ("…" row) showing
 *   • estimated session cost in CNY (from tokenUsage × current model prices),
 *   • the conversation's closed model-step count (from the sessionStats projection),
 *   • a live DeepSeek peak/valley (峰谷) period indicator that flips every 30s.
 *
 * All data is read on the client from session projections and the local clock;
 * there is no host side and no wire traffic. The whole chip is a reference
 * estimate for the UI — never a billing input.
 */
import { useEffect, useMemo, useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: the conversation SlotMap merge for the header-actions seat and
// the token/session projection key types.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-session-stats/types'
import type {} from '@deepseek-ai/dsh-token-meter/projection'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { NS, en, zh } from './locales.ts'
import { adoptStyles } from './styles.ts'
import { DEFAULT_MODEL, estimateCost, formatCny, isPeakTime, priceOf } from './pricing.ts'

/** Required services: the slot registry and the locale dictionary. */
export const inject = ['slots', 'locale']

/** Asia/Shanghai is UTC+8 with no DST — a fixed offset is exact. */
const BEIJING_OFFSET_MIN = 8 * 60

/** How often the peak/valley indicator re-checks the clock (ms). */
const PERIOD_TICK_MS = 30_000

/** Beijing local clock parts read from one instant (no tearing across midnight). */
interface BeijingClock {
  /** Minute-of-day in Beijing time (0..1439). */
  minute: number
  /** Beijing-local day of week (0=Sunday .. 6=Saturday). */
  weekday: number
}

/** Shift the instant into Beijing wall time (+8h, no DST) and read UTC parts — day-of-week rolls over exactly at Beijing midnight. */
function beijingClock(now: Date): BeijingClock {
  const shifted = new Date(now.getTime() + BEIJING_OFFSET_MIN * 60_000)
  return {
    minute: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  }
}

/** §-separated session-stat row shape used by the header-actions seat. */
type CostChipProps = PropsRuntime<'conversation.session.header.actions'> & PropsLocale<typeof NS>

/**
 * The header status chip.
 * @param props - standard kit (sessionId, useProjection) + the `t` locale seat.
 */
export function CostChip({ useProjection, t }: CostChipProps): React.JSX.Element | null {
  const tokenUsage = useProjection('tokenUsage')
  const sessionStats = useProjection('sessionStats') as
    | (object & { steps?: number; turns?: number })
    | undefined

  // Current Beijing clock, refreshed every 30s so the period flips at
  // 09:00 / 12:00 / 14:00 / 18:00 and across midnight / weekend boundaries
  // without a page reload.
  const [clock, setClock] = useState(() => beijingClock(new Date()))
  useEffect(() => {
    const id = window.setInterval(() => setClock(beijingClock(new Date())), PERIOD_TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  // Peak windows apply on weekdays only; weekends are idle all day.
  const peak = isPeakTime(clock.minute, clock.weekday)
  const price = priceOf(DEFAULT_MODEL)

  const amount = useMemo(() => {
    if (tokenUsage === undefined) return null
    return estimateCost(
      tokenUsage.uncachedInputTokens ?? 0,
      tokenUsage.cacheReadTokens ?? 0,
      tokenUsage.outputTokens ?? 0,
      peak,
      price,
    )
  }, [tokenUsage, peak, price])

  // Keep this intentionally simple: the current DSH projection's closed
  // model-step count is the number the user wants to see.
  const steps = typeof sessionStats?.steps === 'number' ? sessionStats.steps : null
  const hasAnything = amount !== null && amount > 0.0049 || steps !== null && steps > 0
  if (!hasAnything) return null

  return (
    <span className="dsh_sc_chip" role="group" aria-label={t('cost.label')}>
      {amount !== null && amount > 0.0049 && (
        <span className="dsh_sc_item" title={t('cost.tooltip', { model: DEFAULT_MODEL })}>
          <span className="dsh_sc_itemLabel">{t('cost.label')}</span>
          <span className="dsh_sc_amount">{t('cost.value', { amount: formatCny(amount) })}</span>
        </span>
      )}
      {steps !== null && steps > 0 && (
        <span className="dsh_sc_item" title={t('steps.label')}>
          <span className="dsh_sc_itemLabel">{t('steps.label')}</span>
          <span className="dsh_sc_amount">{steps}</span>
        </span>
      )}
      <span
        className={`dsh_sc_period ${peak ? 'dsh_sc_period--peak' : 'dsh_sc_period--idle'}`}
        title={peak ? t('period.tooltip.peak') : t('period.tooltip.idle')}
      >
        <span className="dsh_sc_periodDot" aria-hidden="true" />
        {peak ? t('period.peak') : t('period.idle')}
      </span>
    </span>
  )
}

/**
 * Compose the session-cost surface.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-session-cost: dictionaries')

  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'session-cost',
    order: 60,
    locale: NS,
  }, CostChip))
}
