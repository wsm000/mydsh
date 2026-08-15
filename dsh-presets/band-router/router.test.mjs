/**
 * router.test.mjs — unit tests for the Band Router decision core.
 * Run: node --test router.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MODE_MIXED, MODE_REACT, MODE_SPEC, MODE_WEAK,
  applyPersona, bandFor, bandOf, classifyTask, clamp01, coreFor, extractText,
  isComplexTask, isFlashModel, modelFamily, parseMode, personaFor,
  sessionMode, testinessFor,
} from './router-core.mjs'

// ── classification ──────────────────────────────────────────────────────────

test('classifyTask: strong react evidence commits to react', () => {
  assert.equal(classifyTask('帮我从头开发一个网站并上线'), MODE_REACT)
  assert.equal(classifyTask('write a new project from scratch'), MODE_REACT)
})

test('classifyTask: strong spec evidence commits to spec', () => {
  assert.equal(classifyTask('修复这个崩溃并排查原因'), MODE_SPEC)
  assert.equal(classifyTask('debug and fix the broken build'), MODE_SPEC)
})

test('classifyTask: ambiguous tasks fall to weak (internal routing)', () => {
  assert.equal(classifyTask('帮我看看这个'), MODE_WEAK) // no evidence
  assert.equal(classifyTask('修复这个 bug 然后写个测试'), MODE_WEAK) // 1v1 tie
  assert.equal(classifyTask(''), MODE_WEAK)
  assert.equal(classifyTask(undefined), MODE_WEAK)
})

test('classifyTask: margin gating — single counter token does not flip the band', () => {
  // 2×react vs 1×spec → margin 1 → weak (upstream would have picked react)
  assert.equal(classifyTask('创建两个新脚本，顺便修复一个小问题'), MODE_WEAK)
  // 2×spec vs 1×react → margin -1 → weak
  assert.equal(classifyTask('修复主流程，排查辅助逻辑，再写一个工具'), MODE_WEAK)
  // 3×react vs 1×spec → margin 2 → react
  assert.equal(classifyTask('开发新网站、实现注册登录、搭建后台，再修复一个旧bug'), MODE_REACT)
})

// ── behavior bands ──────────────────────────────────────────────────────────

test('bandOf: quantizes to the three measured regions', () => {
  assert.equal(bandOf(0), 'spec')
  assert.equal(bandOf(0.15), 'spec')
  assert.equal(bandOf(0.2), 'transition')
  assert.equal(bandOf(0.3), 'transition')
  assert.equal(bandOf(0.49), 'transition')
  assert.equal(bandOf(0.5), 'react')
  assert.equal(bandOf(1), 'react')
  assert.equal(bandOf(MODE_WEAK), 'weak')
  assert.equal(bandOf('weak'), 'weak')
})

test('bandFor: transition is reported as mixed', () => {
  assert.equal(bandFor(0.3), 'mixed')
  assert.equal(bandFor(0), 'spec')
  assert.equal(bandFor(1), 'react')
  assert.equal(bandFor('weak'), 'weak')
})

test('clamp01: clamps and coerces', () => {
  assert.equal(clamp01(-1), 0)
  assert.equal(clamp01(2), 1)
  assert.equal(clamp01(0.7), 0.7)
  assert.equal(clamp01('nope'), 0)
})

// ── personas & model family ─────────────────────────────────────────────────

test('personaFor: each band gets its measured persona', () => {
  const spec = personaFor(MODE_SPEC, 'deepseek-v4-pro')
  const react = personaFor(MODE_REACT, 'deepseek-v4-pro')
  const mixed = personaFor(MODE_MIXED, 'deepseek-v4-pro')
  assert.match(spec, /helpful software engineer/)
  assert.match(react, /hands-on/)
  assert.match(mixed, /Work directly/)
  assert.notEqual(spec, react)
})

test('personaFor weak: family-specific optima (pro vs light)', () => {
  const pro = personaFor(MODE_WEAK, 'deepseek-v4-pro')
  const flash = personaFor(MODE_WEAK, 'deepseek-v4-flash')
  assert.match(pro, /helpful software engineer/)
  assert.match(flash, /helpful assistant/)
  assert.notEqual(pro, flash)
  // unknown family defaults to the pro persona (safe default)
  assert.equal(personaFor(MODE_WEAK, 'some-other-model'), pro)
})

test('modelFamily: buckets measured and unmeasured ids', () => {
  assert.equal(modelFamily('deepseek-v4-flash'), 'light')
  assert.equal(modelFamily('deepseek-v4-pro'), 'pro')
  assert.equal(modelFamily('deepseek-reasoner'), 'pro')
  assert.equal(modelFamily(undefined), 'unknown')
  assert.equal(modelFamily(''), 'unknown')
})

test('isFlashModel: legacy alias', () => {
  assert.equal(isFlashModel('deepseek-v4-flash'), true)
  assert.equal(isFlashModel('deepseek-v4-pro'), false)
})

// ── complexity heuristic ────────────────────────────────────────────────────

test('isComplexTask: length / keywords / requirement density', () => {
  assert.equal(isComplexTask('short task'), false)
  assert.equal(isComplexTask('x'.repeat(121)), true)
  assert.equal(isComplexTask('请设计一个系统架构'), true) // keyword
  assert.equal(isComplexTask('帮我优化这个模块的架构'), true)
  assert.equal(isComplexTask('写个脚本；再做个定时任务；还要加日志'), true) // 2 clauses
  assert.equal(isComplexTask('能解释一下吗？顺便给个例子？'), true) // 2 questions
  assert.equal(isComplexTask(''), false)
  assert.equal(isComplexTask(undefined), false)
})

// ── core tool sets ──────────────────────────────────────────────────────────

test('coreFor: read-first for spec, write-first for react and weak', () => {
  assert.deepEqual(coreFor(MODE_SPEC), ['read', 'edit', 'glob', 'grep'])
  assert.deepEqual(coreFor(MODE_REACT), ['read', 'write', 'edit'])
  assert.deepEqual(coreFor(MODE_WEAK), ['read', 'write', 'edit'])
  assert.deepEqual(coreFor(MODE_MIXED), ['read', 'edit', 'write', 'glob', 'grep'])
})

test('testinessFor: informational strengths', () => {
  assert.equal(testinessFor(MODE_REACT), 'suppressed')
  assert.equal(testinessFor(MODE_SPEC), 'normal')
  assert.equal(testinessFor(MODE_WEAK), 'light')
})

// ── mode parsing ────────────────────────────────────────────────────────────

test('parseMode: band names, numbers, auto, invalid', () => {
  assert.equal(parseMode('spec'), MODE_SPEC)
  assert.equal(parseMode('react'), MODE_REACT)
  assert.equal(parseMode('weak'), MODE_WEAK)
  assert.equal(parseMode('mixed'), MODE_MIXED)
  assert.equal(parseMode('balanced'), MODE_MIXED)
  assert.equal(parseMode('auto'), 'auto')
  assert.equal(parseMode(50), 0.5) // 0-100 scale
  assert.equal(parseMode('80'), 0.8)
  assert.equal(parseMode('0.7'), 0.7) // 0.0-1.0 scale
  assert.equal(parseMode('garbage'), null)
  assert.equal(parseMode(undefined), null)
})

// ── persona section surgery ─────────────────────────────────────────────────

test('applyPersona: replaces persona, keeps plan section, order 0', () => {
  const sections = [
    { name: 'persona', text: 'old', order: 5 },
    { name: 'plan-mode', text: 'PLAN RULES', order: 2 },
    { name: 'tools', text: 'catalog', order: 1 },
  ]
  const out = applyPersona(sections, 'NEW PERSONA')
  const names = out.map((s) => s.name)
  assert.ok(!names.includes('persona'), 'original persona removed')
  assert.ok(names.includes('router-persona'), 'router persona added')
  assert.ok(names.includes('plan-mode'), 'plan section survives')
  assert.ok(names.includes('tools'), 'other sections survive')
  const router = out.find((s) => s.name === 'router-persona')
  assert.equal(router.text, 'NEW PERSONA')
  assert.equal(router.order, 0)
})

// ── session-derived mode ────────────────────────────────────────────────────

test('sessionMode: derives from the first user message (resume-safe)', () => {
  const session = {
    events: [
      { type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: '修复这个报错' }] } },
    ],
  }
  assert.equal(sessionMode(session), MODE_SPEC)
  assert.equal(sessionMode({ events: [] }), MODE_WEAK)
  assert.equal(sessionMode(undefined), MODE_WEAK)
})

test('extractText: flattens content blocks', () => {
  assert.equal(extractText({ content: ['a', { text: 'b' }, { text: 'c' }] }), 'a b c')
  assert.equal(extractText(null), '')
  assert.equal(extractText({}), '')
})
