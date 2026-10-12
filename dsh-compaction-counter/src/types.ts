/**
 * dsh-compaction-counter — shared, client-safe vocabulary.
 *
 * One projection key carries whole-session compaction accounting: how many
 * times the durable log compacted the context, how much that replaced, and
 * which route wrote the newest summary. Both halves import this module
 * type-only where they only need the types, so the browser bundle stays free
 * of host code.
 *
 * @module dsh-compaction-counter/types
 */
import type {} from '@deepseek-ai/dsh-session-projection/types'

/**
 * Whole-session compaction accounting, folded from the durable log.
 *
 * Every field is plain JSON (the projection-cache precondition) and every
 * figure counts the complete log, so paging and compaction itself cannot
 * change it.
 */
export interface CompactionStats {
  /** Successful summarizing compactions: one per committed `compaction/summary`. */
  count: number
  /** Subset of {@link count} an explicit command initiated (`/compact`). */
  manual: number
  /** Attempts that closed with an error (`compaction/end` carrying `error`). */
  failed: number
  /** Estimated tokens replaced by every successful summary. */
  shadowedTokens: number
  /** Model-free tool-result prune replacements (`compaction/prune`). */
  prunes: number
  /** Estimated tokens replaced by those prunes. */
  prunedTokens: number
  /** Wall time of the newest successful compaction, or null before the first. */
  lastTime: number | null
  /** Provider that wrote the newest summary, or null before the first. */
  lastProvider: string | null
  /** Model that wrote the newest summary, or null before the first. */
  lastModel: string | null
  /** Estimated tokens the newest summary replaced, or null before the first. */
  lastShadowedTokens: number | null
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Client-visible compaction accounting for one Session. */
    compactionStats: CompactionStats
  }
  interface SessionProjectionStateMap {
    /** Fold state for {@link CompactionStats}; the view is the same plain-JSON shape. */
    compactionStats: CompactionStats
  }
}

/** The zeroed state for an empty log. */
export function emptyCompactionStats(): CompactionStats {
  return {
    count: 0,
    manual: 0,
    failed: 0,
    shadowedTokens: 0,
    prunes: 0,
    prunedTokens: 0,
    lastTime: null,
    lastProvider: null,
    lastModel: null,
    lastShadowedTokens: null,
  }
}

/** Non-negative integer (a counter). */
function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

/** Non-negative finite number (an estimated token figure). */
function isTokens(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/** A token figure or null. */
function isNullableTokens(value: unknown): value is number | null {
  return value === null || isTokens(value)
}

/** A string or null. */
function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

/**
 * Zero-dependency validator for {@link CompactionStats}, used as both the
 * state schema and the wire view schema.
 *
 * The projection registry only ever calls `parse()`, so a duck-typed schema
 * keeps this package free of a zod dependency while still rejecting a
 * persisted checkpoint row the current fold did not write. Invalid input
 * throws, which is exactly what the registry's cache path expects.
 */
export const compactionStatsSchema: { parse(value: unknown): CompactionStats } = {
  parse(value: unknown): CompactionStats {
    if (typeof value !== 'object' || value === null) {
      throw new Error('compactionStats: expected an object')
    }
    const stats = value as Record<string, unknown>
    const valid =
      isCount(stats.count) &&
      isCount(stats.manual) &&
      isCount(stats.failed) &&
      isCount(stats.prunes) &&
      isTokens(stats.shadowedTokens) &&
      isTokens(stats.prunedTokens) &&
      isNullableTokens(stats.lastTime) &&
      isNullableTokens(stats.lastShadowedTokens) &&
      isNullableString(stats.lastProvider) &&
      isNullableString(stats.lastModel)
    if (!valid) throw new Error('compactionStats: invalid field')
    return value as CompactionStats
  },
}
