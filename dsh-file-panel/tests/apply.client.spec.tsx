// @vitest-environment jsdom
/**
 * Client composition test: the browser plugin mounts the filePanel Remote
 * contribution, registers the header-actions slot entry, and binds one api
 * face per session over a stub client context.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { apply } from '../src/client/index.ts'
import { NS } from '../src/client/locales.ts'
import { fmt, zh } from '../src/client/locales.ts'

const t = (key: keyof typeof zh, params?: Record<string, string>): string => fmt(zh[key] ?? key, params)

interface CapturedSlot {
  name: string
  factory: () => {
    name: string
    id: string
    locale: string
    inject: (sessionId: string) => unknown
  }
}

describe('dsh-file-panel client composition', () => {
  let captured: CapturedSlot | undefined

  afterEach(() => {
    captured = undefined
    document.head.querySelectorAll('style').forEach((style) => { style.remove() })
  })

  function stubContext(face: {
    list: ReturnType<typeof vi.fn>
    read: ReturnType<typeof vi.fn>
    write: ReturnType<typeof vi.fn>
  }): ClientContext {
    return {
      effect: (fn: () => unknown) => { void fn(); return () => {} },
      locale: {
        register: vi.fn(),
        bind: vi.fn(() => t),
      },
      remote: {
        $mount: vi.fn(async () => () => {}),
      },
      reflect: {
        get: () => face,
      },
      settingsScope: {
        bind: () => ({ getSnapshot: () => ({ value: { enabled: true } }) }),
      },
      slots: {
        inject: vi.fn((name: string, factory: () => unknown) => {
          captured = { name, factory: factory as CapturedSlot['factory'] }
        }),
      },
    } as unknown as ClientContext
  }

  it('mounts the remote and registers the header-actions slot entry', async () => {
    const face = {
      list: vi.fn(async () => ({ ok: true, value: { entries: [], truncated: false } })),
      read: vi.fn(async () => ({ ok: true, value: { content: '', size: 0, truncated: false } })),
      write: vi.fn(async () => ({ ok: true, value: { size: 0 } })),
    }
    const ctx = stubContext(face)
    apply(ctx)
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    expect(ctx.locale.register).toHaveBeenCalledWith(NS, expect.objectContaining({ zh: expect.any(Object), en: expect.any(Object) }))
    expect(ctx.remote.$mount).toHaveBeenCalledWith(expect.objectContaining({ package: 'dsh-file-panel' }))
    expect(captured?.name).toBe('conversation.session.header.actions')
    const entry = captured?.factory()
    expect(entry?.name).toBe('conversation.session.header.actions')
    expect(entry?.id).toBe('file-panel')
    expect(entry?.locale).toBe(NS)
  })

  it('injects a per-session api face bound to the mounted namespace', async () => {
    const face = {
      list: vi.fn(async () => ({ ok: true, value: { entries: [], truncated: false } })),
      read: vi.fn(async () => ({ ok: true, value: { content: 'x', size: 1, truncated: false } })),
      write: vi.fn(async () => ({ ok: true, value: { size: 1 } })),
    }
    const ctx = stubContext(face)
    apply(ctx)
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    const injected = captured?.factory().inject('session-9') as {
      sessionId: string
      enabled: boolean
      api: { list(dir: string): Promise<unknown>; read(path: string): Promise<unknown>; write(path: string, content: string): Promise<unknown> }
    }
    expect(injected.sessionId).toBe('session-9')
    expect(injected.enabled).toBe(true)
    await injected.api.list('docs')
    expect(face.list).toHaveBeenCalledWith('session-9', 'docs', expect.anything())
    await injected.api.read('a.txt')
    expect(face.read).toHaveBeenCalledWith('session-9', 'a.txt', expect.anything())
    await injected.api.write('a.txt', 'hi')
    expect(face.write).toHaveBeenCalledWith('session-9', 'a.txt', 'hi', expect.anything())
  })

  it('rejects failed envelopes with the gateway error text', async () => {
    const face = {
      list: vi.fn(async () => ({ ok: false, error: { code: 'escape', message: 'path escapes', details: {} } })),
      read: vi.fn(async () => ({ ok: true, value: { content: '', size: 0, truncated: false } })),
      write: vi.fn(async () => ({ ok: true, value: { size: 0 } })),
    }
    const ctx = stubContext(face)
    apply(ctx)
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    const injected = captured?.factory().inject('session-9') as { api: { list(dir: string): Promise<unknown> } }
    await expect(injected.api.list('')).rejects.toThrow(/escape: path escapes/)
  })
})
