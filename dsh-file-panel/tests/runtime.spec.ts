/**
 * Host composition behavior: the plugin module boots over a real cordis
 * Context, registers the filePanel service with the Gateway-visible binding,
 * and its list/read/write @Remotes answer over fixture workspaces. This is
 * the REAL-composition evidence for the host half — the filesystem seam is
 * real, the Agent and settings provider are structural stubs.
 */
import { Context, symbols } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as plugin from '../src/index.ts'
import type { FilePanelRuntime } from '../src/runtime.ts'

/** One structural Agent stub: only the session header the service reads. */
function agentWith(cwd: string | undefined): Agent {
  return { session: { header: { cwd } }, ctx: new Context() } as unknown as Agent
}

/** The unproxied service original (cordis caller-tracking may wrap instances). */
function originalOf(service: object): object {
  const original = Reflect.get(service, symbols.original) as object | undefined
  return original ?? service
}

/** A settings provider stub whose `enabled` value is switchable per test. */
function settingsProvider(enabled: () => boolean) {
  return {
    register: () => ({
      get: () => ({ enabled: enabled() }),
      watch: () => () => {},
      update: async () => {},
      replace: async () => {},
    }),
  }
}

/** Mount the function-plugin module on a fresh context (harness test pattern). */
async function mount(ctx: Context, config?: plugin.Config, enabled: () => boolean = () => true) {
  const registryFiber = ctx.plugin(TypertRegistry)
  await registryFiber
  ctx.provide('settings', settingsProvider(enabled))
  ctx.provide('agents', { roots: () => [] })
  const fiber = ctx.plugin({ inject: plugin.inject, apply: plugin.apply }, config)
  await fiber
  return fiber
}

describe('dsh-file-panel host composition', () => {
  it('boots the plugin and registers the filePanel service under its own key', async () => {
    const ctx = new Context()
    const fiber = await mount(ctx)
    const runtime = ctx.get('filePanel') as FilePanelRuntime | undefined
    expect(runtime).toBeDefined()
    // The Gateway source-mode binding the wire dispatch relies on.
    expect(Reflect.get(originalOf(runtime as FilePanelRuntime), 'typertRemote').namespace).toBe('filePanel')
    await fiber.dispose()
  })

  it('registers the strict Typert manifest for all three endpoints', async () => {
    const ctx = new Context()
    const fiber = await mount(ctx)
    const registry = ctx.get('typert') as TypertRegistry
    expect(registry.local.get('filePanel/list')).toMatchObject({ service: 'filePanel', method: 'list' })
    expect(registry.local.get('filePanel/read')).toMatchObject({ service: 'filePanel', method: 'read' })
    expect(registry.local.get('filePanel/write')).toMatchObject({ service: 'filePanel', method: 'write' })
    await fiber.dispose()
    expect(registry.local.get('filePanel/list')).toBeUndefined()
  })

  it('exports exactly the three Remote methods', async () => {
    const ctx = new Context()
    const fiber = await mount(ctx)
    const runtime = ctx.get('filePanel') as FilePanelRuntime
    expect(remoteMethods(originalOf(runtime)).map(marker => marker.method)).toEqual(['list', 'read', 'write'])
    await fiber.dispose()
  })

  it('disposes the service with its fiber', async () => {
    const ctx = new Context()
    const fiber = await mount(ctx)
    expect(ctx.get('filePanel')).toBeDefined()
    await fiber.dispose()
    expect(ctx.get('filePanel')).toBeUndefined()
  })

  it('list reads the addressed workspace directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-file-panel-runtime-'))
    await mkdir(join(root, 'nested'))
    await writeFile(join(root, 'a.ts'), 'a\n')
    await writeFile(join(root, 'nested', 'b.ts'), 'b\n')
    const ctx = new Context()
    const fiber = await mount(ctx)
    try {
      const runtime = ctx.get('filePanel') as FilePanelRuntime
      const result = await runtime.list(agentWith(root), '', new AbortController().signal)
      expect(result.entries.map(entry => `${entry.kind}:${entry.name}`)).toEqual(['dir:nested', 'file:a.ts'])
      const nested = await runtime.list(agentWith(root), 'nested', new AbortController().signal)
      expect(nested.entries.map(entry => `${entry.kind}:${entry.name}`)).toEqual(['file:b.ts'])
    } finally {
      await fiber.dispose()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('read and write round-trip through the workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-file-panel-runtime-'))
    const ctx = new Context()
    const fiber = await mount(ctx)
    try {
      const runtime = ctx.get('filePanel') as FilePanelRuntime
      const written = await runtime.write(agentWith(root), 'docs/note.md', 'hello', new AbortController().signal)
      expect(written.size).toBe(5)
      const read = await runtime.read(agentWith(root), 'docs/note.md', new AbortController().signal)
      expect(read.content).toBe('hello')
      expect(read.size).toBe(5)
      expect(read.truncated).toBe(false)
    } finally {
      await fiber.dispose()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('refuses a session without a workspace', async () => {
    const ctx = new Context()
    const fiber = await mount(ctx)
    try {
      const runtime = ctx.get('filePanel') as FilePanelRuntime
      await expect(runtime.list(agentWith(undefined), '', new AbortController().signal))
        .rejects.toThrow(/no workspace directory/)
    } finally {
      await fiber.dispose()
    }
  })

  it('refuses every endpoint while the settings switch is off', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-file-panel-runtime-'))
    const ctx = new Context()
    const fiber = await mount(ctx, undefined, () => false)
    try {
      const runtime = ctx.get('filePanel') as FilePanelRuntime
      await expect(runtime.list(agentWith(root), '', new AbortController().signal))
        .rejects.toThrow(/disabled in Settings/)
      await expect(runtime.read(agentWith(root), 'a.txt', new AbortController().signal))
        .rejects.toThrow(/disabled in Settings/)
      await expect(runtime.write(agentWith(root), 'a.txt', 'x', new AbortController().signal))
        .rejects.toThrow(/disabled in Settings/)
    } finally {
      await fiber.dispose()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('validates configuration through the exported schema', () => {
    expect(plugin.Config({})).toEqual({
      maxReadBytes: 1024 * 1024,
      maxWriteBytes: 4 * 1024 * 1024,
      maxListEntries: 1000,
      createDirs: true,
    })
    expect(plugin.Config({ maxListEntries: 5 }).maxListEntries).toBe(5)
    expect(plugin.Config({ createDirs: false }).createDirs).toBe(false)
    expect(() => plugin.Config({ maxListEntries: 0 })).toThrow()
    expect(() => plugin.Config({ maxReadBytes: -1 })).toThrow()
  })
})
