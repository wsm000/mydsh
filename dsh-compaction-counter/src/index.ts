/**
 * dsh-compaction-counter host entry.
 *
 * Registers the `compactionStats` session-projection unit: a pure fold of the
 * durable log's `compaction/*` events into whole-session counts. The unit is
 * driven by the projection registry (one `apply` per committed event) and its
 * wire view rides every projection carrier, so the browser reads a finished
 * value instead of replaying the log.
 *
 * Counting rules, straight from the compaction vocabulary
 * (`@deepseek-ai/dsh-compaction/types`):
 *   • `compaction/summary` — one committed summarizing compaction. Its
 *     `sourceCommandId` marks the manual `/compact` path; its
 *     `shadowedTokenCount` is the replaced range's shadow price.
 *   • `compaction/end` — the lock release; `error` marks an unsuccessful
 *     attempt, which is counted separately and never as a compaction.
 *   • `compaction/prune` — a model-free tool-result replacement. Counted on
 *     its own scale: it trades nothing for a summary, so it must not inflate
 *     the "compacted N times" figure.
 *
 * @module dsh-compaction-counter
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-compaction/types'
import type {} from '@deepseek-ai/dsh-session-projection/types'
import { compactionStatsSchema, emptyCompactionStats } from './types.ts'
import type { CompactionStats } from './types.ts'

// Re-exported for the unit tests and for host readers that want the fold or
// the validator without a second import path into the source tree.
export { compactionStatsSchema, emptyCompactionStats }
export type { CompactionStats }

/** Cordis plugin name (the Loader entry and the client bundle id). */
export const name = 'dsh-compaction-counter'

/** The projection registry is the unit's whole purpose; without it the fiber stays pending. */
export const inject = ['sessionProjections']

/**
 * Read a shadow-price token count defensively: the fold must survive a
 * malformed log row without poisoning the accumulated state.
 * @param value - the event's `shadowedTokenCount`.
 * @returns the count, or 0 when absent or not a non-negative finite number.
 */
function shadowPrice(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

/**
 * Pure transition: previous state + one committed session event → next state.
 * Returns the same reference for every unrelated event, which is what keeps
 * the registry's change feed quiet.
 * @param state - the state covering all prior events.
 * @param event - the next committed session event.
 * @returns the next state.
 */
export function foldCompactionStats(state: CompactionStats, event: SessionEvent): CompactionStats {
  switch (event.type) {
    case 'compaction/summary': {
      const shadowed = shadowPrice(event.data.shadowedTokenCount)
      return {
        ...state,
        count: state.count + 1,
        manual: state.manual + (event.data.sourceCommandId === undefined ? 0 : 1),
        shadowedTokens: state.shadowedTokens + shadowed,
        lastTime: event.time,
        lastProvider: typeof event.data.provider === 'string' ? event.data.provider : null,
        lastModel: typeof event.data.model === 'string' ? event.data.model : null,
        lastShadowedTokens: shadowed,
      }
    }
    case 'compaction/end':
      return event.data.error === undefined ? state : { ...state, failed: state.failed + 1 }
    case 'compaction/prune':
      return {
        ...state,
        prunes: state.prunes + 1,
        prunedTokens: state.prunedTokens + shadowPrice(event.data.shadowedTokenCount),
      }
    default:
      return state
  }
}

/**
 * The `compactionStats` unit definition.
 *
 * `view` returns the state itself: every state the fold produces is already
 * whole-log plain JSON, and `apply` only changes the reference when a
 * compaction fact changed — so the drive's `Object.is` gate publishes exactly
 * the events the user can see.
 */
const compactionStatsProjectionDefinition = {
  key: 'compactionStats',
  stateVersion: 1,
  stateSchema: compactionStatsSchema,
  init: () => emptyCompactionStats(),
  apply: foldCompactionStats,
  wire: {
    viewSchema: compactionStatsSchema,
    view: (state: CompactionStats) => state,
  },
}

/**
 * Register the unit; the registration is an effect on this plugin's fiber, so
 * unloading removes the key from every projection carrier.
 * @param ctx - registrant context carrying the projection registry.
 */
export function apply(ctx: Context): void {
  // The registry only ever calls `parse()`, so the zero-dependency validator
  // fills the declared schema seat without pulling zod into the profile.
  ctx.sessionProjections.register(compactionStatsProjectionDefinition as never)
}
