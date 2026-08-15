/**
 * watchdog — Repo Watch daemon plugin.
 *
 * Polls the tracked GitHub repository on a fixed interval (default 3 days),
 * snapshots its public state, diffs against the previous snapshot, and
 * appends a markdown entry to watch-log.md when anything changed. State
 * (last check, next check, last snapshot) persists in watch-state.json next
 * to this preset, so restart catch-up works: a mount that finds the last
 * check overdue runs one immediately.
 *
 * Timing: the standing preset mount owns this daemon. It starts when the
 * first session joins the preset (mount) and survives session close until
 * the process ends — so one "Repo Watch" session created per process keeps
 * the schedule alive. After a process restart the daemon catches up on the
 * next mount instead of losing the missed checks.
 *
 * Zero external imports on purpose (preset rows resolve from the user home,
 * where @deepseek-ai/* is not installed). Network access is plain global
 * fetch (Node >= 18); the GitHub REST API is public and anonymous-friendly
 * at this cadence. All state/log writes fail soft: a read-only install
 * keeps the daemon in memory and logs nothing.
 *
 * Agent-visible tools: watch_status (state + log tail) and watch_now
 * (force an immediate check).
 */

import {
  DEFAULT_REPO, DAY_MS, buildFetchUrls, diffSnapshots, formatEntry, nextCheckAt,
  parseIssue, parseRelease, parseRepo, shouldCheckNow, snapshotFrom,
} from './watch-core.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'watchdog'

/** The timer service (host plane, mounted by dsh-base) and the tools
 *  registry must exist. */
export const inject = ['timer', 'tools']

const PRESET_DIR = dirname(fileURLToPath(import.meta.url))
const STATE_FILE = join(PRESET_DIR, 'watch-state.json')
const LOG_FILE = join(PRESET_DIR, 'watch-log.md')
const LOG_MAX_LINES = 200 // cap: newest entries win
const FETCH_TIMEOUT_MS = 15000
const CHECK_URLS = (repo, base) => buildFetchUrls(repo, base)

// ── state (fail soft) ───────────────────────────────────────────────────────

function loadState() {
  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
    if (raw && typeof raw === 'object') return raw
  } catch { /* missing/corrupt → start fresh */ }
  return { lastCheckAt: null, nextCheckAt: null, snapshot: null }
}

function saveState(state) {
  try {
    mkdirSync(PRESET_DIR, { recursive: true })
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8')
  } catch { /* read-only install: keep in memory */ }
}

function appendLog(text) {
  try {
    let existing = ''
    try { existing = readFileSync(LOG_FILE, 'utf8') } catch { /* first entry */ }
    const lines = (existing.split('\n').filter((l) => l.trim().length > 0))
    lines.push(text)
    writeFileSync(LOG_FILE, lines.slice(-LOG_MAX_LINES).join('\n') + '\n', 'utf8')
  } catch { /* read-only install: nothing persisted */ }
}

function logTail(n = 40) {
  try {
    return readFileSync(LOG_FILE, 'utf8').split('\n').filter((l) => l.trim()).slice(-n).join('\n')
  } catch {
    return '(no watch log yet — the first check runs on mount)'
  }
}

/** Minimal spec → JSON Schema compiler (same subset as router-bootstrap). */
function toJsonSchema(spec) {
  const properties = {}
  const required = []
  for (const [key, meta] of Object.entries(spec || {})) {
    const prop = { type: meta.type }
    if (Array.isArray(meta.enum)) prop.enum = meta.enum
    if (meta.description) prop.description = meta.description
    properties[key] = prop
    if (meta.required) required.push(key)
  }
  return { type: 'object', properties, required, additionalProperties: false }
}

export function apply(ctx, config = {}) {
  const repo = config.repo || DEFAULT_REPO
  const intervalMs = (Number(config.intervalDays) || 3) * DAY_MS
  const token = typeof config.token === 'string' && config.token ? config.token : null

  let state = loadState()
  let inFlight = false
  let lastError = null

  const headers = {
    'User-Agent': 'dsh-repo-watch/0.1',
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const getJson = async (url) => {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} (${url})`)
    }
    return res.json()
  }

  /** One check cycle: fetch → snapshot → diff → log → persist. */
  const runCheck = async (reason) => {
    if (inFlight) return
    inFlight = true
    const now = Date.now()
    try {
      const urls = CHECK_URLS(repo)
      const [repoData, issuesData, releasesData] = await Promise.all([
        getJson(urls.repo),
        getJson(urls.issues).catch(() => []), // issues/releases are best-effort
        getJson(urls.releases).catch(() => []),
      ])
      const snapshot = snapshotFrom(
        now,
        parseRepo(repoData),
        (issuesData || []).map(parseIssue),
        (releasesData || []).map(parseRelease),
      )
      const diff = diffSnapshots(state.snapshot, snapshot)
      if (diff.changed || state.snapshot === null) {
        appendLog(formatEntry(now, diff, snapshot.repo))
      }
      lastError = null
      state = {
        lastCheckAt: now,
        nextCheckAt: nextCheckAt(now, intervalMs, now),
        snapshot,
        lastDiff: diff.changed ? diff : null,
        lastReason: reason,
      }
    } catch (error) {
      lastError = `${error && error.message ? error.message : String(error)}`
      appendLog(`## ${new Date(now).toISOString()} — 检查失败: ${lastError}（将在下个周期重试）`)
      state = { ...state, lastCheckAt: now, nextCheckAt: nextCheckAt(now, intervalMs, now), lastError }
    } finally {
      inFlight = false
    }
    saveState(state)
  }

  // ── schedule: catch-up on mount, then fixed interval ─────────────────────
  const dueNow = shouldCheckNow(state.lastCheckAt, intervalMs)
  ctx.timer.interval(() => runCheck('interval'), intervalMs)
  if (dueNow) {
    ctx.timer.timeout(() => runCheck('catch-up after mount'), 5000)
  }

  // ── agent-visible tools ───────────────────────────────────────────────────
  const registerTool = (tool) => {
    ctx.effect(() => ctx.tools.register({
      ...tool,
      parameters: toJsonSchema(tool.parameters),
    }))
  }

  registerTool({
    name: 'watch_status',
    description: `Show the repo-watch daemon status: tracked repository (${repo}), last check, next check, last error, and the tail of the watch log.`,
    parameters: {
      lines: { type: 'number', description: 'log tail lines (default 40)' },
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    execute(args) {
      const due = shouldCheckNow(state.lastCheckAt, intervalMs)
      return [
        `repo=${repo} (every ${Number(config.intervalDays) || 3} days)`,
        `lastCheck=${state.lastCheckAt ? new Date(state.lastCheckAt).toISOString() : '(never)'}`,
        `nextCheck=${state.nextCheckAt ? new Date(state.nextCheckAt).toISOString() : '(due now)'}`,
        due ? 'status=due (check pending)' : 'status=scheduled',
        `lastError=${lastError ?? state.lastError ?? '(none)'}`,
        '',
        '── log tail ──',
        logTail(Number(args?.lines) || 40),
      ].join('\n')
    },
  })

  registerTool({
    name: 'watch_now',
    description: 'Force an immediate repo-watch check (fetch the tracked GitHub repository now, diff, and append to the watch log).',
    parameters: {},
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute() {
      if (inFlight) return 'a check is already running — wait a moment'
      await runCheck('manual')
      const diff = state.lastDiff
      return [
        `check done at ${new Date(state.lastCheckAt).toISOString()}`,
        diff ? `changed=${JSON.stringify({
          stars: diff.starDelta, issues: diff.issueDelta,
          newIssues: diff.newIssues.length, newReleases: diff.newReleases.length,
        })}` : 'changed=false (no new activity)',
        `next=${new Date(state.nextCheckAt).toISOString()}`,
        state.lastError ? `lastError=${state.lastError}` : '',
      ].filter(Boolean).join('\n')
    },
  })
}
