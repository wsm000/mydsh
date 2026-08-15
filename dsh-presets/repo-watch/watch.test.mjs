/**
 * watch.test.mjs — unit tests for the Repo Watch decision core.
 * Run: node --test watch.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DAY_MS, DEFAULT_REPO, buildFetchUrls, diffSnapshots, formatEntry, nextCheckAt,
  parseIssue, parseRelease, parseRepo, shouldCheckNow, snapshotFrom,
} from './watch-core.mjs'

const T0 = 1755000000000

// ── URLs ────────────────────────────────────────────────────────────────────

test('buildFetchUrls: three endpoints for the tracked repo', () => {
  const urls = buildFetchUrls(DEFAULT_REPO)
  // the repo id is used verbatim — GitHub 404s on %2F here
  assert.equal(urls.repo, 'https://api.github.com/repos/yjh051108/dsh-routing-suite')
  assert.match(urls.issues, /\/issues\?state=all&per_page=5/)
  assert.match(urls.releases, /\/releases\?per_page=3/)
})

// ── parsing ─────────────────────────────────────────────────────────────────

test('parseRepo: extracts the tracked fields', () => {
  const r = parseRepo({
    full_name: 'yjh051108/dsh-routing-suite',
    description: 'kit',
    stargazers_count: 133,
    open_issues_count: 3,
    pushed_at: '2026-08-14T23:56:41Z',
    html_url: 'https://github.com/yjh051108/dsh-routing-suite',
  })
  assert.equal(r.stars, 133)
  assert.equal(r.openIssues, 3)
  assert.equal(r.pushedAt, '2026-08-14T23:56:41Z')
  assert.equal(parseRepo(null), null)
})

test('parseIssue: drops pull requests, keeps issues', () => {
  const issue = parseIssue({ number: 4, state: 'open', title: 'bug', created_at: '2026-08-15', html_url: 'u' })
  assert.equal(issue.number, 4)
  assert.equal(parseIssue({ number: 5, pull_request: {} }), null)
  assert.equal(parseIssue(null), null)
})

test('parseRelease: extracts tag and date', () => {
  const rel = parseRelease({ tag_name: 'v0.1.1', published_at: '2026-08-15T00:00:00Z', html_url: 'u' })
  assert.equal(rel.tag, 'v0.1.1')
  assert.equal(parseRelease(null), null)
})

// ── diffing ─────────────────────────────────────────────────────────────────

function sampleSnapshot(over = {}) {
  return snapshotFrom(
    T0,
    { fullName: 'r', description: 'd', stars: 100, openIssues: 2, pushedAt: '2026-08-01T00:00:00Z', url: 'u' },
    [
      { number: 1, state: 'open', title: 'old issue', createdAt: 'a', url: 'u1' },
    ],
    [{ tag: 'v0.1.0', publishedAt: 'a', url: 'ur' }],
  )
}

test('diffSnapshots: no change → changed=false', () => {
  const a = sampleSnapshot()
  const b = sampleSnapshot()
  const diff = diffSnapshots(a, b)
  assert.equal(diff.changed, false)
  assert.equal(diff.starDelta, 0)
  assert.deepEqual(diff.newIssues, [])
})

test('diffSnapshots: stars, issues, releases and pushed_at all detected', () => {
  const prev = sampleSnapshot()
  const next = sampleSnapshot()
  next.repo.stars = 105
  next.repo.openIssues = 4
  next.repo.pushedAt = '2026-08-15T00:00:00Z'
  next.issues = [
    { number: 1, state: 'closed', title: 'old issue', createdAt: 'a', url: 'u1' },
    { number: 2, state: 'open', title: 'fresh bug', createdAt: 'b', url: 'u2' },
  ]
  next.releases = [{ tag: 'v0.1.0', publishedAt: 'a', url: 'ur' }, { tag: 'v0.2.0', publishedAt: 'c', url: 'ur2' }]

  const diff = diffSnapshots(prev, next)
  assert.equal(diff.changed, true)
  assert.equal(diff.starDelta, 5)
  assert.equal(diff.issueDelta, 2)
  assert.equal(diff.pushedAtChanged, true)
  assert.equal(diff.newIssues.length, 1)
  assert.equal(diff.newIssues[0].number, 2)
  assert.equal(diff.closedIssues.length, 1)
  assert.equal(diff.closedIssues[0].number, 1)
  assert.equal(diff.newReleases.length, 1)
  assert.equal(diff.newReleases[0].tag, 'v0.2.0')
})

test('diffSnapshots: first ever check is always a change', () => {
  const next = sampleSnapshot()
  const diff = diffSnapshots(null, next)
  assert.equal(diff.changed, true)
  assert.equal(diff.newIssues.length, 1)
  assert.equal(diff.newReleases.length, 1)
})

// ── log entries ─────────────────────────────────────────────────────────────

test('formatEntry: renders a readable markdown entry', () => {
  const next = sampleSnapshot()
  const diff = diffSnapshots(null, next)
  const text = formatEntry(T0, diff, next.repo)
  assert.match(text, /^## .*巡检/m)
  assert.match(text, /stars: 100/)
  assert.match(text, /新 issue \[#1\]/)
  assert.match(text, /新 release: \[v0\.1\.0\]/)
})

test('formatEntry: unchanged state says so', () => {
  const a = sampleSnapshot()
  const text = formatEntry(T0, diffSnapshots(a, a), a.repo)
  assert.match(text, /无变化/)
})

// ── scheduling / catch-up ───────────────────────────────────────────────────

test('shouldCheckNow: missing history or overdue interval triggers', () => {
  assert.equal(shouldCheckNow(null, 3 * DAY_MS, T0), true)
  assert.equal(shouldCheckNow(T0 - 4 * DAY_MS, 3 * DAY_MS, T0), true)
  assert.equal(shouldCheckNow(T0 - 2 * DAY_MS, 3 * DAY_MS, T0), false)
  assert.equal(shouldCheckNow(T0, 3 * DAY_MS, T0), false)
})

test('nextCheckAt: due now when overdue, else last + interval', () => {
  assert.equal(nextCheckAt(T0 - 4 * DAY_MS, 3 * DAY_MS, T0), T0)
  assert.equal(nextCheckAt(T0 - 1 * DAY_MS, 3 * DAY_MS, T0), T0 + 2 * DAY_MS)
  assert.equal(nextCheckAt(null, 3 * DAY_MS, T0), T0)
})
