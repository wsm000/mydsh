/**
 * router-core — Band Router: task-aware reasoning-mode routing logic.
 *
 * ZERO dependencies, unit-testable. This is the pure decision core; the
 * Cordis wiring lives in router-bootstrap.mjs.
 *
 * ── THE METHOD (measured on DeepSeek V4 Pro / V4 Flash, P1–P23 of the
 *    dsh-router-standard research repo; see README.md for attribution) ──
 *
 * Model behavior along the react↔spec persona axis is NOT a continuum: it
 * collapses into a few stable regions separated by phase transitions.
 * "Continuous" tuning is an illusion at the model layer. This router
 * therefore quantizes to the stable bands:
 *
 *   spec [0, 0.19]      → stable plan-collective (We trajectories)
 *   transition [0.2, .49] → unstable We/The/Let mix — a TRAP, never picked
 *   react [0.5, 1.0]    → stable doer (11 mode values behave alike)
 *
 * A fourth band, weak, is the only measured internal-routing window: with a
 * model-specific weak persona the model classifies each task itself
 * (Pro → spec sentence + classify instruction; Flash → neutral + classify +
 * recall/anti-runaway anchors). Everything else must be routed from OUTSIDE —
 * this preset is the automated external router.
 *
 * ── Band Router's own design decisions (documented deltas vs upstream) ──
 *
 * 1. MARGIN GATING: upstream routed react/spec on a bare count comparison
 *    (react > spec → react). Band Router requires |margin| >= 2 to commit to
 *    a strong band; smaller margins (including any mixed-evidence text) fall
 *    to weak. A single counter-token ("create a script to FIX the crash")
 *    no longer flips the band.
 * 2. FAMILY DETECTION: isFlashModel() generalizes to a light/pro family
 *    bucket (only flash/pro were measured; unknown ids use the pro persona —
 *    the safe default).
 * 3. COMPLEXITY DENSITY: isComplexTask() adds requirement-density signals
 *    (multiple clauses / question marks) beside length and architecture
 *    keywords, so short but multi-requirement tasks get the deep guide.
 * 4. Near-field guides use Band Router's own wording (same measured
 *    principles: classify first, deep-think for complex, decision closure).
 *
 * Persona TEXTS follow the measured optima of the upstream research repo
 * (MIT) — changing the words would throw away the measured property.
 */

export const MODE_SPEC = 0
export const MODE_MIXED = 0.3
export const MODE_REACT = 1
export const MODE_WEAK = 'weak'

/** Measured optimum for the spec band: the minimal RL-aligned sentence. */
const SPEC_PERSONA = 'You are a helpful software engineer assistant.'

/** Transition band — only reachable by explicit opt-in (mixed/balanced). */
const MIXED_PERSONA =
  'You are a helpful software engineer assistant.\n'
  + 'Work directly: prefer writing or editing code over describing plans. '
  + 'Verify your changes by reading and running them.'

/** Measured optimum for the react band: hands-on doer, no ceremony. */
const REACT_PERSONA =
  'You are a hands-on software engineer who delivers working output fast.\n'
  + 'Work directly: write or edit code, then verify it by reading and running. '
  + 'Keep the loop tight — produce, verify, fix — and do not build test '
  + 'harnesses, scaffolding, or ceremony the user did not ask for. '
  + 'Finish with a usable deliverable and a short summary.'

/**
 * Weak-band personas — model-specific measured optima (P11/P24):
 *   pro:   spec sentence + classify instruction (w6c, +4.67, P24) — few-shot
 *          variants and recall/converge anchors HURT Pro
 *   light: neutral + classify + recall/anti-runaway anchors (w7, +5.67, P11;
 *          anchors lift single-task completion to 100%, P23)
 */
const WEAK_PRO =
  'You are a helpful software engineer assistant.\n'
  + 'Before acting, decide the task type (build or fix) and adopt the matching '
  + 'style: build → hands-on production; fix → inspect-and-plan.'

const WEAK_LIGHT =
  'You are a helpful assistant.\n'
  + 'Before acting, decide the task type (build or fix) and adopt the matching '
  + 'style: build → hands-on production; fix → inspect-and-plan.\n'
  + 'Before acting, briefly review what you have already done in this session '
  + 'and continue from where you left off; do not repeat completed steps. Do '
  + 'not run environment checks (echo, whoami, uname, node --version, date) or '
  + 'exhaustive grep/glob scans.'

/**
 * Complexity heuristic: long / architecturally-worded / requirement-dense
 * tasks are COMPLEX and get the deep-exploration guide; everything else gets
 * the fast-convergence guide. Static text either way → cache-safe.
 */
const COMPLEX_RE = /(重构|架构|全面|详细|设计|系统|优化|分析|survey|overview|architecture|refactor|comprehensive|detailed|design|system|optimize|analyze)/i

export function isComplexTask(text) {
  if (typeof text !== 'string' || !text.trim()) return false
  if (text.length > 120) return true
  if (COMPLEX_RE.test(text)) return true
  // Requirement-density signals: multiple clauses (；;\n。) or questions.
  const clauses = (text.match(/[。；;\n]/g) || []).length
  const questions = (text.match(/[?？]/g) || []).length
  return clauses >= 2 || questions >= 2
}

/**
 * Model family: only Flash was measured as threshold-like (0–0.5 spec side,
 * jumps at 0.75+); Pro is the phase-collapsed reference. Other ids are
 * bucketed by name heuristics and default to the pro persona (safe default).
 */
export function modelFamily(modelId) {
  if (typeof modelId !== 'string' || !modelId) return 'unknown'
  const id = modelId.toLowerCase()
  if (/(flash|mini|nano|light|lite|turbo)/.test(id)) return 'light'
  if (/(pro|max|reasoner|think)/.test(id)) return 'pro'
  return 'unknown'
}

/** Legacy alias kept for upstream compatibility. */
export function isFlashModel(modelId) {
  return modelFamily(modelId) === 'light'
}

/** Quantize a mode to one of the four measured behavior bands. */
export function bandOf(mode) {
  if (mode === MODE_WEAK) return 'weak'
  const m = clamp01(mode)
  if (m < 0.2) return 'spec' // measured stable spec region (0..0.15)
  if (m < 0.5) return 'transition' // measured unstable band — avoid
  return 'react' // measured stable react region (0.5..1 behave alike)
}

/** Persona for a mode; weak picks the model-family internal-routing text. */
export function personaFor(mode, modelId) {
  switch (bandOf(mode)) {
    case 'spec': return SPEC_PERSONA
    case 'transition': return MIXED_PERSONA
    case 'weak': return modelFamily(modelId) === 'light' ? WEAK_LIGHT : WEAK_PRO
    default: return REACT_PERSONA
  }
}

/** First-turn core tools (the shell is added dynamically by the plugin). */
export function coreFor(mode) {
  switch (bandOf(mode)) {
    case 'spec': return ['read', 'edit', 'glob', 'grep'] // read-first
    case 'transition': return ['read', 'edit', 'write', 'glob', 'grep'] // union
    default: return ['read', 'write', 'edit'] // write-first (weak too)
  }
}

/** Human-readable band name for a mode value. */
export function bandFor(mode) {
  const b = bandOf(mode)
  return b === 'transition' ? 'mixed' : b
}

/** Test-suppression strength for a mode (informational only). */
export function testinessFor(mode) {
  switch (bandOf(mode)) {
    case 'react': return 'suppressed'
    case 'spec': return 'normal'
    default: return 'light'
  }
}

/**
 * Task evidence families. Kept deliberately small — the measured claim is
 * only about the three bands; more families would be unfalsified tuning.
 */
const REACT_RE = /(开发|创建|写一个|写个|生成|从零|做一个|做一|游戏|网页|网站|构建|新项目|搭建|实现|做出|上线|落地|脚本|工具|应用|build|create|develop|generate|implement|make a|new project|write a|write an|scaffold|migrate)/gi
const SPEC_RE = /(修复|修一下|调试|重构|维护|排查|报错|出错|崩溃|优化|审查|review|fix|debug|refactor|maintain|repair|broken|break|为什么|异常|故障|升级|兼容|analyze|analyse|investigate|explain)/gi

function countHits(regex, text) {
  return [...text.matchAll(regex)].length
}

/**
 * Classify a task text into a mode. MARGIN GATING: commit to a strong band
 * only with |react − spec| >= 2; everything else — ties, single counter
 * tokens, unmatched text — returns 'weak' (internal routing, P11 optimum).
 */
export function classifyTask(text) {
  if (typeof text !== 'string' || !text.trim()) return MODE_WEAK
  const react = countHits(REACT_RE, text)
  const spec = countHits(SPEC_RE, text)
  const margin = react - spec
  if (margin >= 2) return MODE_REACT
  if (margin <= -2) return MODE_SPEC
  return MODE_WEAK
}

/** Per-session mode derived from durable events (resume/reload-safe). */
export function sessionMode(session) {
  const events = session?.snapshotEvents?.()
  if (!Array.isArray(events)) return MODE_WEAK
  const userMsg = events.find((e) => e.type === 'user/message')
  return classifyTask(extractText(userMsg?.data))
}

export function extractText(data) {
  if (!data) return ''
  const content = Array.isArray(data.content) ? data.content : []
  return content.map((c) => (typeof c === 'string' ? c : (c.text ?? ''))).join(' ')
}

export function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0))
}

/**
 * Replace ONLY the persona section of an assembled section list. Everything
 * else survives — above all the plan-mode section, which is toggled per plan
 * state and carries the plan-boundary instructions (plan boundaries must not
 * reset the router's persona focus).
 */
export function applyPersona(sections, personaText) {
  const rest = (sections || []).filter(
    (section) => section.name !== 'persona' && !/persona/i.test(section.name),
  )
  return [...rest, { name: 'router-persona', text: personaText, order: 0 }]
}

/**
 * Parse a user/agent-supplied mode token: band name, 0-100 number,
 * 0.0-1.0 number, or 'auto' to clear an override. Returns null when invalid.
 */
export function parseMode(token) {
  if (token === undefined || token === null) return null
  const t = String(token).trim().toLowerCase()
  if (t === 'auto') return 'auto'
  if (t === 'weak' || t === 'router') return MODE_WEAK
  if (t === 'spec' || t === 'spec-lean') return MODE_SPEC
  if (t === 'balanced' || t === 'mixed') return MODE_MIXED // transition-band center
  if (t === 'react' || t === 'react-lean') return MODE_REACT
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  if (t.includes('.')) return clamp01(n)
  return clamp01(n / 100)
}
