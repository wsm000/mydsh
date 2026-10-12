/**
 * List DSH session logs that contain `compaction/*` events.
 *
 * Usage: node tools/find-compaction-logs.mjs <sessionsRoot>
 * Example: node tools/find-compaction-logs.mjs "C:\\Users\\86150\\.dsh\\sessions"
 *
 * Prints `<compaction event count>\t<path>` per log, most-compacted first, which
 * is the input list for tests/replay-log.mjs (the fold cross-check).
 */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { readSessionText } from '../tests/zstd.mjs'

const root = process.argv[2]
if (!root) {
  console.error('usage: node tools/find-compaction-logs.mjs <sessionsRoot>')
  process.exit(2)
}

const found = []
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (entry.name.endsWith('.jsonl.zstd') || entry.name.endsWith('.jsonl')) {
      try {
        const text = readSessionText(full)
        if (text.includes('"type":"compaction/')) {
          found.push({ full, n: (text.match(/"type":"compaction\//g) ?? []).length, mtime: statSync(full).mtimeMs })
        }
      } catch {
        /* unreadable or torn log */
      }
    }
  }
}

walk(root)
found.sort((a, b) => b.n - a.n || b.mtime - a.mtime)
for (const { n, full } of found) console.log(`${n}\t${full}`)
console.log(`logs with compaction events: ${found.length}`)
