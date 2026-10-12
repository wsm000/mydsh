/**
 * Verification tool: is the plugin mounted in a *running* host?
 *
 * Usage: node tools/read-projection-cache.mjs [storagesDir]
 * Default: C:\Users\86150\.dsh\storages
 *
 * A mounted unit's client-visible wire view is persisted into the session
 * projection cache. Finding `compactionStats` rows here — with `ver` equal to
 * the unit's `stateVersion` — proves the running host actually loaded the
 * plugin (no restart needed to confirm), and shows the live folded values per
 * session.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const storagesDir = process.argv[2] ?? 'C:\\Users\\86150\\.dsh\\storages'
const sessionsDir = join(storagesDir, 'session_projcache', 'sessions')

let files = []
try {
  files = readdirSync(sessionsDir).filter((name) => name.endsWith('.json'))
} catch (error) {
  console.error(`no projection cache at ${sessionsDir}: ${error.message}`)
  process.exit(1)
}

let found = 0
for (const name of files) {
  let doc
  try {
    doc = JSON.parse(readFileSync(join(sessionsDir, name), 'utf8'))
  } catch {
    continue
  }
  const hits = []
  const walk = (node, path) => {
    if (node === null || typeof node !== 'object' || hits.length >= 3) return
    for (const [key, value] of Object.entries(node)) {
      if (key === 'compactionStats' && value && typeof value === 'object' && 'val' in value) hits.push([`${path}.${key}`, value])
      else walk(value, `${path}.${key}`)
    }
  }
  walk(doc, '$')
  if (hits.length === 0) continue
  found++
  const session = name.replace(/^session-/, '').replace(/\.json$/, '')
  for (const [path, row] of hits) {
    const v = row.val
    console.log(`${session} @${path} ver=${row.ver} seq=${row.seq}`)
    console.log(`  count=${v.count} manual=${v.manual} failed=${v.failed} prunes=${v.prunes}` +
      ` shadowedTokens=${v.shadowedTokens} prunedTokens=${v.prunedTokens}` +
      ` last=${v.lastModel ?? 'none'}${v.lastTime === null ? '' : ` @${new Date(v.lastTime).toISOString()}`}`)
  }
}
console.log(found === 0
  ? 'no compactionStats rows: the host has not mounted the plugin (or nothing was persisted yet)'
  : `sessions carrying live compactionStats rows: ${found}`)
