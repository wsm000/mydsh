/**
 * watch-core — Repo Watch: pure snapshot/diff/log logic for the repo watch
 * daemon. ZERO dependencies, unit-testable. The Cordis wiring lives in
 * watchdog.mjs.
 *
 * The daemon polls the tracked GitHub repository on a fixed interval
 * (default 3 days), snapshots its public state (stars / open issues /
 * pushed_at / recent issues / recent releases), diffs against the previous
 * snapshot, and appends a markdown entry to a watch log when anything
 * changed. This module contains every pure decision: what to fetch, how to
 * parse, how to diff, how to render a log entry, and when the next check is
 * due (with catch-up semantics after downtime).
 */

export const GITHUB_API = 'https://api.github.com'

/** Default target: the plugin researched earlier this session. */
export const DEFAULT_REPO = 'yjh051108/dsh-routing-suite'

/** Endpoints fetched on every check. The repo id is used verbatim: GitHub's
 *  /repos/{owner}/{repo} path accepts the plain slash and 404s on %2F. */
export function buildFetchUrls(repo, base = GITHUB_API) {
  return {
    repo: `${base}/repos/${repo}`,
    issues: `${base}/repos/${repo}/issues?state=all&per_page=5&sort=created&direction=desc`,
    releases: `${base}/repos/${repo}/releases?per_page=3`,
  }
}

/** Parse one repo metadata payload into the snapshot's repo record. */
export function parseRepo(data) {
  if (!data || typeof data !== 'object') return null
  return {
    fullName: data.full_name ?? null,
    description: data.description ?? null,
    stars: Number(data.stargazers_count ?? 0),
    openIssues: Number(data.open_issues_count ?? 0),
    pushedAt: data.pushed_at ?? null,
    url: data.html_url ?? null,
  }
}

/** Parse one issue payload (PRs are issues with pull_request; keep them out). */
export function parseIssue(issue) {
  if (!issue || typeof issue !== 'object') return null
  if (issue.pull_request) return null // PRs are not issues on the API
  return {
    number: Number(issue.number ?? 0),
    state: issue.state ?? 'unknown',
    title: String(issue.title ?? '').slice(0, 120),
    createdAt: issue.created_at ?? null,
    url: issue.html_url ?? null,
  }
}

/** Parse one release payload. */
export function parseRelease(rel) {
  if (!rel || typeof rel !== 'object') return null
  return {
    tag: String(rel.tag_name ?? '').slice(0, 80),
    publishedAt: rel.published_at ?? rel.created_at ?? null,
    url: rel.html_url ?? null,
  }
}

/** Build a full snapshot record from parsed pieces. */
export function snapshotFrom(checkedAt, repo, issues, releases) {
  return {
    checkedAt,
    repo,
    issues: (issues || []).filter(Boolean),
    releases: (releases || []).filter(Boolean),
  }
}

/**
 * Diff a previous snapshot against the new one. Returns a report object;
 * `changed` is true iff anything worth logging differs. Purely structural —
 * no timestamps are compared, so a re-check after downtime that finds the
 * same state logs nothing.
 */
export function diffSnapshots(prev, next) {
  const prevRepo = prev?.repo ?? {}
  const nextRepo = next?.repo ?? {}
  const prevIssueIds = new Set((prev?.issues ?? []).map((i) => i.number))
  const nextIssueIds = new Set((next?.issues ?? []).map((i) => i.number))
  const prevReleaseTags = new Set((prev?.releases ?? []).map((r) => r.tag))
  const nextReleaseTags = new Set((next?.releases ?? []).map((r) => r.tag))

  const newIssues = (next?.issues ?? []).filter((i) => !prevIssueIds.has(i.number))
  const closedIssues = (prev?.issues ?? []).filter(
    (i) => nextIssueIds.has(i.number)
      && i.state !== 'closed'
      && (next?.issues ?? []).find((n) => n.number === i.number)?.state === 'closed',
  )
  const newReleases = (next?.releases ?? []).filter((r) => !prevReleaseTags.has(r.tag))

  const starDelta = (nextRepo.stars ?? 0) - (prevRepo.stars ?? 0)
  const issueDelta = (nextRepo.openIssues ?? 0) - (prevRepo.openIssues ?? 0)
  const pushedAtChanged = prevRepo.pushedAt != null
    && nextRepo.pushedAt != null
    && prevRepo.pushedAt !== nextRepo.pushedAt

  return {
    starDelta,
    issueDelta,
    pushedAtChanged,
    newIssues,
    closedIssues,
    newReleases,
    changed: starDelta !== 0 || issueDelta !== 0 || pushedAtChanged
      || newIssues.length > 0 || closedIssues.length > 0 || newReleases.length > 0,
  }
}

/** Render one log entry (markdown). Pure. */
export function formatEntry(now, diff, repo) {
  const lines = []
  lines.push(`## ${new Date(now).toISOString()} — 巡检`)
  if (repo?.fullName) lines.push(`- 仓库: [${repo.fullName}](${repo.url ?? GITHUB_API})`)
  if (repo?.description) lines.push(`- 描述: ${repo.description}`)
  if (repo) {
    lines.push(`- stars: ${repo.stars}${diff.starDelta ? ` (${sign(diff.starDelta)})` : ''}`
      + ` · open issues: ${repo.openIssues}${diff.issueDelta ? ` (${sign(diff.issueDelta)})` : ''}`
      + ` · 最近推送: ${repo.pushedAt ?? '?'}`)
  }
  if (diff.pushedAtChanged) lines.push('- 推送变化: 仓库有新提交')
  for (const issue of diff.newIssues) {
    lines.push(`- 新 issue [#${issue.number}](${issue.url ?? '#'}) [${issue.state}]: ${issue.title}`)
  }
  for (const issue of diff.closedIssues) {
    lines.push(`- issue #${issue.number} 已关闭: ${issue.title}`)
  }
  for (const rel of diff.newReleases) {
    lines.push(`- 新 release: [${rel.tag}](${rel.url ?? '#'}) (${rel.publishedAt ?? '?'})`)
  }
  if (!diff.changed) lines.push('- 无变化')
  return lines.join('\n')
}

function sign(n) {
  return n > 0 ? `+${n}` : String(n)
}

/** Whether a check is due now (missing history or interval elapsed). */
export function shouldCheckNow(lastCheckAt, intervalMs, now = Date.now()) {
  if (lastCheckAt == null) return true
  return now - Number(lastCheckAt) >= intervalMs
}

/** When the next check is due; overdue means now (immediate catch-up). */
export function nextCheckAt(lastCheckAt, intervalMs, now = Date.now()) {
  if (lastCheckAt == null) return now
  const due = Number(lastCheckAt) + intervalMs
  return due <= now ? now : due
}

export const DAY_MS = 24 * 60 * 60 * 1000
