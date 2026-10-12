/**
 * Unit tests for the compaction-count fold and its validator.
 *
 * The fold is the whole product: a wrong count here is a wrong number in the
 * GUI. Every case drives the built host bundle (`lib/index.js`) with synthetic
 * committed events shaped exactly like the real log rows extracted from
 * `.dsh/sessions` (see tests/replay-log.mjs for the real-log cross-check).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compactionStatsSchema, emptyCompactionStats, foldCompactionStats } from '../lib/index.js'

/** One `compaction/summary` row, shaped like the durable log. */
function summary(overrides = {}) {
  return {
    type: 'compaction/summary',
    seq: 1,
    time: 1_700_000_000_000,
    data: {
      compactionId: 'c1',
      summary: [{ type: 'text', text: 'handoff' }],
      shadowedRange: { start: 1, end: 2 },
      shadowedSeqs: [1, 2],
      shadowedTokenCount: 23_257,
      provider: 'ninjj',
      model: 'gpt-6-astra',
      ...overrides,
    },
  }
}

test('empty state is zeroed and reference-detached', () => {
  const a = emptyCompactionStats()
  const b = emptyCompactionStats()
  assert.notEqual(a, b)
  assert.deepEqual(a, {
    count: 0, manual: 0, failed: 0, shadowedTokens: 0, prunes: 0, prunedTokens: 0,
    lastTime: null, lastProvider: null, lastModel: null, lastShadowedTokens: null,
  })
})

test('a summary counts once, records the shadow price and the writing route', () => {
  const next = foldCompactionStats(emptyCompactionStats(), summary())
  assert.equal(next.count, 1)
  assert.equal(next.manual, 0)
  assert.equal(next.shadowedTokens, 23_257)
  assert.equal(next.lastShadowedTokens, 23_257)
  assert.equal(next.lastTime, 1_700_000_000_000)
  assert.equal(next.lastProvider, 'ninjj')
  assert.equal(next.lastModel, 'gpt-6-astra')
})

test('sourceCommandId marks the manual /compact path', () => {
  const next = foldCompactionStats(emptyCompactionStats(), summary({ sourceCommandId: 'cmd-1' }))
  assert.equal(next.count, 1)
  assert.equal(next.manual, 1)
})

test('a failed attempt is counted separately and never as a compaction', () => {
  const start = foldCompactionStats(emptyCompactionStats(), { type: 'compaction/start', seq: 1, time: 10, data: { compactionId: 'c', turn: 1 } })
  assert.equal(start.count, 0)
  const ended = foldCompactionStats(start, { type: 'compaction/end', seq: 2, time: 20, data: { compactionId: 'c', turn: 1, error: '524 timeout' } })
  assert.equal(ended.failed, 1)
  assert.equal(ended.count, 0)
})

test('a successful end is a no-op and keeps the state reference', () => {
  const before = foldCompactionStats(emptyCompactionStats(), summary())
  const after = foldCompactionStats(before, { type: 'compaction/end', seq: 3, time: 30, data: { compactionId: 'c1', turn: 7 } })
  assert.equal(after, before)
})

test('prunes are counted on their own scale', () => {
  const next = foldCompactionStats(emptyCompactionStats(), { type: 'compaction/prune', seq: 1, time: 5, data: { shadowedRange: { start: 1, end: 2 }, shadowedSeqs: [1], shadowedTokenCount: 8679 } })
  assert.equal(next.prunes, 1)
  assert.equal(next.prunedTokens, 8679)
  assert.equal(next.count, 0)
})

test('an unrelated event never changes the reference', () => {
  const state = foldCompactionStats(emptyCompactionStats(), summary())
  for (const event of [
    { type: 'step/start', seq: 2, time: 2, data: { turn: 1, step: 1 } },
    { type: 'turn/end', seq: 3, time: 3, data: { turn: 1 } },
    { type: 'user/message', seq: 4, time: 4, data: {} },
  ]) {
    assert.equal(foldCompactionStats(state, event), state, `${event.type} must be a no-op`)
  }
})

test('a malformed shadow price contributes zero instead of poisoning the total', () => {
  const next = foldCompactionStats(emptyCompactionStats(), summary({ shadowedTokenCount: 'not-a-number' }))
  assert.equal(next.count, 1)
  assert.equal(next.shadowedTokens, 0)
  assert.equal(next.lastShadowedTokens, 0)
})

test('several compactions accumulate', () => {
  let state = emptyCompactionStats()
  state = foldCompactionStats(state, summary({ shadowedTokenCount: 1000 }))
  state = foldCompactionStats(state, summary({ shadowedTokenCount: 2000, sourceCommandId: 'cmd' }))
  state = foldCompactionStats(state, { type: 'compaction/prune', seq: 9, time: 9, data: { shadowedTokenCount: 500 } })
  assert.equal(state.count, 2)
  assert.equal(state.manual, 1)
  assert.equal(state.shadowedTokens, 3000)
  assert.equal(state.prunes, 1)
  assert.equal(state.prunedTokens, 500)
  assert.equal(state.lastShadowedTokens, 2000)
})

test('the validator accepts a folded state and rejects damaged shapes', () => {
  const state = foldCompactionStats(emptyCompactionStats(), summary())
  assert.equal(compactionStatsSchema.parse(state), state)
  for (const bad of [
    null,
    'state',
    { ...state, count: -1 },
    { ...state, count: 1.5 },
    { ...state, shadowedTokens: Number.NaN },
    { ...state, lastModel: 7 },
  ]) {
    assert.throws(() => compactionStatsSchema.parse(bad), /compactionStats/)
  }
})
