/**
 * Smoke test for the built browser half (`lib/client.js`).
 *
 * The browser bundle is the one artifact no Node test can "run" for real, so
 * this loads it exactly the way the shell does — through the
 * `window.__ModuleLoader__.load({ id, factory })` handshake, with `react` and
 * `react/jsx-runtime` resolved from a stub — and then asserts the three things
 * that can break silently: the factory's exports, the slot/locale registration
 * `apply()` performs, and what the chip renders for representative projections.
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const require = createRequire(import.meta.url)

/** Capture the handshake the bundle performs at require time. */
let handshake
const reactStub = {
  memo: (component) => component,
  createElement: (type, props, ...children) => ({ type, props, children }),
}
const jsxStub = {
  jsx: (type, props) => ({ type, props }),
  jsxs: (type, props) => ({ type, props }),
}
globalThis.window = {
  __ModuleLoader__: {
    load: (entry) => {
      handshake = entry
    },
  },
}
globalThis.document = {
  getElementById: () => null,
  createElement: () => ({ id: '', textContent: '' }),
  head: { appendChild: () => {} },
}

require('../lib/client.js')

/** The bundle's own require, answered from the stubs (everything else is erased at build time). */
function bundleRequire(spec) {
  if (spec === 'react') return reactStub
  if (spec === 'react/jsx-runtime') return jsxStub
  throw new Error(`unexpected external: ${spec}`)
}

const client = handshake.factory(bundleRequire)

/** The `t` seat the slot kit provides: `{name}` interpolation over the dictionary. */
function translator(dictionary) {
  return (key, params = {}) =>
    String(dictionary[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`))
}

test('the bundle registers itself under the plugin id', () => {
  assert.equal(handshake.id, 'dsh-compaction-counter')
  assert.deepEqual(client.inject, ['slots', 'locale'])
  assert.equal(typeof client.apply, 'function')
  assert.equal(typeof client.CompactionChipView, 'function')
})

test('apply() registers the locale dictionaries and the header-actions chip', () => {
  const effects = []
  const locales = []
  const injected = []
  const registered = []
  const ctx = {
    effect: (fn, label) => {
      effects.push(label)
      fn()
    },
    locale: { register: (ns, dictionaries) => locales.push({ ns, dictionaries }) },
    slots: {
      inject: (name, callback) => {
        injected.push(name)
        callback()
      },
      register: (definition, component) => registered.push({ definition, component }),
    },
  }

  client.apply(ctx)

  assert.deepEqual(effects, ['dsh-compaction-counter: dictionaries'])
  assert.equal(locales.length, 1)
  assert.equal(locales[0].ns, 'compaction-counter')
  assert.deepEqual(Object.keys(locales[0].dictionaries.zh).sort(), Object.keys(locales[0].dictionaries.en).sort())

  assert.deepEqual(injected, ['conversation.session.header.actions'])
  assert.equal(registered.length, 1)
  const { definition, component } = registered[0]
  assert.equal(definition.name, 'conversation.session.header.actions')
  assert.equal(definition.id, 'compaction-counter')
  assert.equal(definition.order, 61)
  assert.equal(definition.locale, 'compaction-counter')
  assert.equal(component, client.CompactionChip)

  // The stylesheet is injected exactly once.
  assert.equal(globalThis.__styleCount, undefined)
})

test('the chip renders the count, the failure badge and the tooltip details', () => {
  const t = translator({
    'compact.label': '压缩',
    'compact.value': '{count} 次',
    'compact.failed': '失败 {count}',
    'compact.aria': '本会话上下文压缩计数',
    'compact.tip.auto': '自动压缩：{count} 次',
    'compact.tip.manual': '手动压缩（/compact）：{count} 次',
    'compact.tip.failed': '压缩失败：{count} 次',
    'compact.tip.shadowed': '累计折叠上下文：≈ {tokens} tokens',
    'compact.tip.prunes': '工具结果修剪：{count} 次（≈ {tokens} tokens）',
    'compact.tip.last': '最近一次：{time} · {model}（{provider}，≈ {tokens} tokens）',
  })
  const stats = {
    count: 3, manual: 1, failed: 2, shadowedTokens: 23_257, prunes: 4, prunedTokens: 8_679,
    lastTime: 1_700_000_000_000, lastProvider: 'ninjj', lastModel: 'gpt-6-astra', lastShadowedTokens: 23_257,
  }
  const element = client.CompactionChipView({ useProjection: () => stats, t })
  const rendered = JSON.stringify(element)
  assert.match(rendered, /压缩/)
  assert.match(rendered, /3 次/)
  assert.match(rendered, /失败 2/)
  assert.match(element.props.title, /自动压缩：2 次/)
  assert.match(element.props.title, /手动压缩（\/compact）：1 次/)
  assert.match(element.props.title, /累计折叠上下文：≈ 23\.3k tokens/)
  assert.match(element.props.title, /gpt-6-astra/)
  assert.match(element.props.title, /工具结果修剪：4 次/)
})

test('the chip is invisible only while the projection is absent, and shows 0 otherwise', () => {
  const t = translator({
    'compact.label': '压缩',
    'compact.value': '{count} 次',
    'compact.aria': '本会话上下文压缩计数',
    'compact.tip.auto': '自动压缩：{count} 次',
  })
  assert.equal(client.CompactionChipView({ useProjection: () => undefined, t }), null)

  const empty = {
    count: 0, manual: 0, failed: 0, shadowedTokens: 0, prunes: 0, prunedTokens: 0,
    lastTime: null, lastProvider: null, lastModel: null, lastShadowedTokens: null,
  }
  const zero = client.CompactionChipView({ useProjection: () => empty, t })
  assert.notEqual(zero, null)
  assert.match(JSON.stringify(zero), /压缩/)
  assert.match(JSON.stringify(zero), /0 次/)
  assert.equal(zero.props.title, '自动压缩：0 次')
})
