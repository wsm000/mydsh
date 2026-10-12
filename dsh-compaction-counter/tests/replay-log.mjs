/**
 * Cross-check the fold against real DSH session logs.
 *
 * Usage: node tests/replay-log.mjs <session.jsonl.zstd | session.jsonl> [...]
 *
 * For every log it folds the events through the built plugin (`lib/index.js`)
 * and recomputes the same figures with a deliberately naive independent scan,
 * then prints both and fails on any disagreement. This is the guard that the
 * shipped fold and "what the log actually says" cannot drift apart.
 */
import { emptyCompactionStats, foldCompactionStats } from '../lib/index.js'
import { readSessionEvents } from './zstd.mjs'

/**
 * Naive, independent recount of the same log: no shared state object, no
 * shared helpers with the plugin.
 * @param events - parsed session events.
 * @returns the expected figures.
 */
function naiveCount(events) {
  const summaries = events.filter((e) => e.type === 'compaction/summary')
  const ends = events.filter((e) => e.type === 'compaction/end')
  const prunes = events.filter((e) => e.type === 'compaction/prune')
  const num = (value) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0)
  const last = summaries.at(-1)
  return {
    count: summaries.length,
    manual: summaries.filter((e) => e.data?.sourceCommandId !== undefined).length,
    failed: ends.filter((e) => e.data?.error !== undefined).length,
    shadowedTokens: summaries.reduce((total, e) => total + num(e.data?.shadowedTokenCount), 0),
    prunes: prunes.length,
    prunedTokens: prunes.reduce((total, e) => total + num(e.data?.shadowedTokenCount), 0),
    lastTime: last === undefined ? null : last.time,
    lastProvider: last === undefined ? null : (typeof last.data?.provider === 'string' ? last.data.provider : null),
    lastModel: last === undefined ? null : (typeof last.data?.model === 'string' ? last.data.model : null),
    lastShadowedTokens: last === undefined ? null : num(last.data?.shadowedTokenCount),
  }
}

let failures = 0
for (const file of process.argv.slice(2)) {
  const events = readSessionEvents(file)
  let folded = emptyCompactionStats()
  for (const event of events) folded = foldCompactionStats(folded, event)
  const expected = naiveCount(events)
  const ok = JSON.stringify(folded) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${file}`)
  console.log(`  events=${events.length} compaction/*=${events.filter((e) => String(e.type).startsWith('compaction/')).length}`)
  console.log(`  folded  = ${JSON.stringify(folded)}`)
  if (!ok) console.log(`  expected= ${JSON.stringify(expected)}`)
}

if (failures > 0) {
  console.error(`\n${failures} log(s) disagreed`)
  process.exit(1)
}
console.log('\nall logs agree')
