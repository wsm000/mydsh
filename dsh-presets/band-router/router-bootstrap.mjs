/**
 * router-bootstrap — Band Router: task-aware reasoning-mode routing plugin.
 *
 * Reads the session's first user message, classifies the task, and on the
 * first model request injects the matching persona and a first-turn CORE
 * tool set (narrow tool surface = first-request anchoring). After the first
 * durable tool/call the full preset catalog is exposed and nothing is
 * touched again. The mode derives from durable session events, so
 * resume/reload keeps it.
 *
 * Three bands (measured, see router-core.mjs): spec (plan-first, fixes),
 * react (doer, builds), weak (internal routing — the model classifies each
 * task itself). Weak sessions additionally receive one fixed NEAR-FIELD
 * guide appended after every real user message (depth-adaptive: simple →
 * fast-convergence, complex → deep-exploration). Static texts only, so the
 * prompt prefix stays cache-stable.
 *
 * The agent can read and tune its own routing: dev_router_status,
 * dev_router_mode (band names / 0-100 / 0.0-1.0 / auto), dev_mode_subagent
 * (run a task in a DIFFERENT mode inside a fresh isolated LLM context —
 * mid-session persona switches would invalidate the whole prefix cache, so
 * isolation is the only reliable way to change modes).
 *
 * ZERO external imports on purpose: preset rows resolve bare specifiers
 * from the user home, where @deepseek-ai/* is not installed. The tools
 * inline a minimal schema compiler instead of importing defineTool.
 */

import {
  applyPersona, bandFor, clamp01, coreFor, extractText, isComplexTask, modelFamily,
  parseMode, personaFor, sessionMode, testinessFor,
} from './router-core.mjs'
import { MODE_WEAK, bandOf } from './router-core.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'router-bootstrap'

/** Prompt assembly, the tools registry, and the LLM route must exist. */
export const inject = ['systemPrompt', 'tools', 'llm']

// ── persisted overrides (design delta: overrides survive reload/restart) ──
const OVERRIDES_FILE = join(dirname(fileURLToPath(import.meta.url)), 'overrides.json')
const OVERRIDES_MAX = 50 // prune oldest sessions; last-write-wins on races

function loadOverrides() {
  try {
    const raw = JSON.parse(readFileSync(OVERRIDES_FILE, 'utf8'))
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {} // missing / corrupt → start empty; never crash the mount
  }
}

/** Minimal spec → JSON Schema compiler (subset of defineTool's work). */
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

export function apply(ctx, config) {
  const overrides = loadOverrides() // session id -> explicit mode (number 0..1 | 'weak')
  const agents = new Map() // session id -> Agent (live handle, in-process only)
  let saveTimer = null

  const persist = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        mkdirSync(dirname(OVERRIDES_FILE), { recursive: true })
        writeFileSync(OVERRIDES_FILE, JSON.stringify(overrides, null, 2), 'utf8')
      } catch { /* read-only install: overrides stay in-memory for the process */ }
    }, 400)
  }

  const modeFor = (sessionId) => {
    const key = String(sessionId)
    return Object.prototype.hasOwnProperty.call(overrides, key)
      ? overrides[key]
      : null
  }

  const setOverride = (sessionId, mode) => {
    const key = String(sessionId)
    if (mode === 'auto') delete overrides[key]
    else {
      overrides[key] = mode === MODE_WEAK ? MODE_WEAK : clamp01(mode)
      const keys = Object.keys(overrides)
      if (keys.length > OVERRIDES_MAX) delete overrides[keys[0]]
    }
    persist()
  }

  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    const agent = context.agent
    if (agent === undefined) return assembled
    const session = agent.session
    agents.set(session.id, agent)

    const mode = modeFor(session.id) ?? sessionMode(session)
    const modelId = agent.options?.model
    const persona = personaFor(mode, modelId)

    // The persona stays constant for the whole session (mode is fixed); only
    // the tool surface changes once, after the first durable tool/call.
    const sections = applyPersona(assembled.sections, persona)

    if (session.events.some((event) => event.type === 'tool/call')) {
      return { ...assembled, sections, contexts: [] } // promoted: full catalog
    }

    const core = new Set(coreFor(mode))
    const available = new Set(assembled.tools.map((tool) => tool.name))
    const shell = available.has('pwsh') ? 'pwsh' : available.has('bash') ? 'bash' : null
    if (shell === null) {
      throw new Error(`${name}: no platform shell in catalog`)
    }
    core.add(shell)

    return {
      ...assembled,
      sections,
      contexts: [],
      tools: assembled.tools.filter((tool) => core.has(tool.name)),
    }
  })

  // ── near-field routing guidance for weak mode (P14/P16/P17/P19/P20) ─────
  // Every REAL user message in a weak-mode session gets ONE fixed guide
  // appended to the inbox right after it (near field, cache-neutral).
  // Depth-adaptive: SIMPLE tasks → fast-convergence guide; COMPLEX tasks →
  // deep-exploration guide (architecture/edge-cases first, information-
  // driven stop signal). The persona carries no hard converge anchor.
  const GUIDE_SIMPLE =
    '\nRouter: classify this task (build or fix) now and adopt the matching style — build: direct production; fix: inspect-first. Commit to a direction and act; do not re-check the environment.'
  const GUIDE_DEEP =
    '\nRouter: classify this task (build or fix) now and adopt the matching style — build: direct production; fix: inspect-first. Think deeply about the architecture, edge cases, and integration points before acting. Do not spend reasoning on the environment or tooling. Produce when your information is complete. End each reasoning block with a decision or an information need.'

  ctx.on('session/event', (session, event) => {
    if (event.type !== 'user/message') return
    const data = event.data ?? {}
    if (data.source?.kind !== 'user') return // only real user messages
    const agent = ctx.get('agent')
    const target = agent !== undefined && agent.session === session
      ? agent
      : [...agents.values()].find((a) => a.session === session)
    if (target === undefined || target.inbox === undefined) return
    const mode = modeFor(session.id) ?? sessionMode(session)
    if (bandOf(mode) !== 'weak') return // strong modes need no guidance
    const text = extractText(data)
    if (!text.trim()) return
    const guide = isComplexTask(text) ? GUIDE_DEEP : GUIDE_SIMPLE
    try {
      target.inbox.append('next-step', {
        id: `band-guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        source: { kind: 'plugin', plugin: 'router-bootstrap' },
        content: [{ type: 'text', text: guide }],
      })
    } catch { /* duplicate/ordering races: skip */ }
  })

  // ── router visibility & tuning (agent self-optimization) ────────────────
  const registerTool = (tool) => {
    ctx.effect(() => ctx.tools.register({
      ...tool,
      parameters: toJsonSchema(tool.parameters),
    }))
  }

  const fmtMode = (mode) => (typeof mode === 'string' ? mode : mode.toFixed(2))

  registerTool({
    name: 'dev_router_status',
    description: 'Show this session\'s reasoning-mode routing: mode, band, persona, model family, first-turn core tools, test-suppression, and whether an override is active.',
    parameters: {},
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    execute() {
      const session = currentSession()
      if (session === undefined) return 'no agent session'
      const mode = modeFor(session.id) ?? sessionMode(session)
      const modelId = currentAgent()?.options?.model
      return [
        `mode=${fmtMode(mode)} (band=${bandFor(mode)})`,
        `model=${modelId ?? '?'} (family=${familyLabel(modelId)})`,
        `persona=${personaFor(mode, modelId).replace(/\n/g, ' / ')}`,
        `core=[${coreFor(mode).join(', ')}]`,
        `testiness=${testinessFor(mode)}`,
        `override=${modeFor(session.id) !== null ? 'yes' : 'no'}`,
      ].join('\n')
    },
  })

  registerTool({
    name: 'dev_router_mode',
    description: 'Set this session\'s reasoning mode: spec (plan-first) / weak (internal routing, model decides per task) / mixed (transition, trap) / react (doer). Accepts band names, 0-100, or 0.0-1.0; use auto to return to task classification. The next request applies it. The override persists across reloads.',
    parameters: {
      mode: {
        type: 'string',
        required: true,
        description: 'band name (spec / weak / mixed / react), a 0-100 number, a 0.0-1.0 number, or auto to clear the override',
      },
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    execute(args) {
      const parsed = parseMode(args.mode)
      if (parsed === null) return `invalid mode "${args.mode}": use spec/weak/mixed/react, 0-100, 0.0-1.0, or auto`
      const session = currentSession()
      if (session === undefined) return 'no agent session'
      setOverride(session.id, parsed)
      const current = modeFor(session.id) ?? sessionMode(session)
      return `mode=${fmtMode(current)} (band=${bandFor(current)}) — next request applies`
    },
  })

  // ── mode-isolated subagent: run a task in a DIFFERENT reasoning mode,
  //    without touching this session's trajectory (P6 showed tail personas
  //    are ineffective; DSH's native subagent inherits this persona, so the
  //    only working isolation is a fresh LLM call with its own system). ──
  registerTool({
    name: 'dev_mode_subagent',
    description: 'Run one task in a DIFFERENT reasoning mode than this session, in a fresh isolated context (own system prompt). The current session trajectory is untouched. Mode: spec (plan-first) / weak (internal routing) / react (doer) / balanced. Returns the subagent\'s answer text.',
    parameters: {
      mode: { type: 'string', required: true, description: 'spec / weak / react / balanced (or 0-100)' },
      task: { type: 'string', required: true, description: 'the task to hand to the mode-isolated subagent' },
      maxTokens: { type: 'number', description: 'output cap (default 1024)' },
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) {
      const parsed = parseMode(args.mode)
      if (parsed === null || parsed === 'auto') return `invalid mode "${args.mode}"`
      const session = currentSession()
      const agent = session === undefined ? undefined : [...agents.values()].find((a) => a.session === session)
      if (agent === undefined || agent.options === undefined) return 'no agent route available'
      const { provider, model } = agent.options
      if (!provider || !model) return 'agent route missing provider/model'

      const persona = personaFor(parsed, model)
      const maxTokens = Number(args.maxTokens || 1024)
      let text = ''
      let reasoningChars = 0
      try {
        const stream = ctx.llm.stream({
          provider,
          model,
          system: persona,
          messages: [{ role: 'user', content: [{ type: 'text', text: String(args.task) }] }],
          maxTokens,
        })
        for await (const chunk of stream) {
          if (chunk.type === 'text-delta') text += chunk.text
          else if (chunk.type === 'reasoning-delta') reasoningChars += chunk.text.length
        }
      } catch (error) {
        return `subagent error: ${error && error.message ? error.message : String(error)}`
      }
      const head = text.slice(0, 3000)
      return `[mode-subagent ${bandFor(parsed)} | reasoning ${reasoningChars} chars]\n${head}${text.length > 3000 ? '\n…(truncated)' : ''}`
    },
  })

  function familyLabel(modelId) {
    return modelFamily(modelId)
  }

  function currentSession() {
    const agent = ctx.get('agent')
    if (agent !== undefined && agent.session !== undefined) return agent.session
    const last = [...agents.values()].at(-1)
    return last?.session
  }

  function currentAgent() {
    const session = currentSession()
    return session === undefined ? undefined : [...agents.values()].find((a) => a.session === session)
  }
}
