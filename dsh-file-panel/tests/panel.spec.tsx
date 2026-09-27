// @vitest-environment jsdom
/**
 * Panel container tests: the full browse / read / edit / new-file state
 * machine over a stub api, plus popover dismissal and error surfaces.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DirEntry, ListResult, ReadResult, WriteResult } from '../src/contract.ts'
import { FilePanelAction, type FilePanelActionInjected, type FilePanelApi } from '../src/client/Panel.tsx'
import { fmt, zh } from '../src/client/locales.ts'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

afterEach(() => {
  act(() => { root.unmount() })
  container.remove()
})

function render(props: FilePanelActionInjected): void {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => { root.render(<FilePanelAction {...props} />) })
}

function click(el: Element): void {
  act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
}

function type(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  act(() => {
    el.value = value
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

/** Flush pending microtasks (remote promises, effect loads). */
async function flush(): Promise<void> {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0) }) })
}

const t = (key: keyof typeof zh, params?: Record<string, string>): string => fmt(zh[key] ?? key, params)

const fileEntry = (name: string): DirEntry => ({ name, kind: 'file', size: 11, mtime: 1000 })
const dirEntry = (name: string): DirEntry => ({ name, kind: 'dir', size: null, mtime: 2000 })

function stubApi(overrides?: Partial<FilePanelApi>): FilePanelApi & { list: ReturnType<typeof vi.fn>; read: ReturnType<typeof vi.fn>; write: ReturnType<typeof vi.fn> } {
  const api = {
    list: vi.fn(async (dir: string): Promise<ListResult> => ({
      entries: dir === '' ? [dirEntry('sub'), fileEntry('a.txt')] : [fileEntry('b.txt')],
      truncated: false,
    })),
    read: vi.fn(async (): Promise<ReadResult> => ({ content: 'hello file', size: 10, truncated: false })),
    write: vi.fn(async (): Promise<WriteResult> => ({ size: 5 })),
    ...overrides,
  }
  return api as never
}

function propsFor(api: FilePanelApi, enabled = true): FilePanelActionInjected {
  return { sessionId: 'session-1', t, api, enabled }
}

describe('FilePanelAction', () => {
  it('renders nothing while disabled', () => {
    render(propsFor(stubApi(), false))
    expect(container.querySelector('.dsh_filePanel_trigger')).toBeNull()
  })

  it('opens the popover and lists the workspace root', async () => {
    const api = stubApi()
    render(propsFor(api))
    click(container.querySelector('.dsh_filePanel_trigger')!)
    await flush()
    expect(api.list).toHaveBeenCalledWith('')
    expect(container.textContent).toContain('a.txt')
    expect(container.textContent).toContain('sub')
  })

  it('enters directories and jumps through breadcrumbs', async () => {
    const api = stubApi()
    render(propsFor(api))
    click(container.querySelector('.dsh_filePanel_trigger')!)
    await flush()
    const rows = container.querySelectorAll('.dsh_filePanel_row')
    click(rows[0]!) // sub
    await flush()
    expect(api.list).toHaveBeenLastCalledWith('sub')
    expect(container.textContent).toContain('b.txt')
    // Breadcrumb root jumps back.
    const crumbs = container.querySelectorAll('.dsh_filePanel_crumb')
    click(crumbs[1]!) // root
    await flush()
    expect(api.list).toHaveBeenLastCalledWith('')
  })

  it('reads a file into the read view and edits it back to disk', async () => {
    const api = stubApi()
    render(propsFor(api))
    click(container.querySelector('.dsh_filePanel_trigger')!)
    await flush()
    const rows = container.querySelectorAll('.dsh_filePanel_row')
    click(rows[1]!) // a.txt
    await flush()
    expect(api.read).toHaveBeenCalledWith('a.txt')
    expect(container.textContent).toContain('hello file')
    // Edit, change, save.
    const buttons = container.querySelectorAll('.dsh_filePanel_button')
    click(buttons[1]!) // 编辑
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement
    type(textarea, 'changed content')
    const editorButtons = container.querySelectorAll('.dsh_filePanel_button')
    click(editorButtons[1]!) // 保存
    await flush()
    expect(api.write).toHaveBeenCalledWith('a.txt', 'changed content')
    // Back to the (refreshed) browse view.
    expect(container.textContent).toContain('a.txt')
  })

  it('creates a new file from the toolbar', async () => {
    const api = stubApi()
    render(propsFor(api))
    click(container.querySelector('.dsh_filePanel_trigger')!)
    await flush()
    const toolbar = container.querySelectorAll('.dsh_filePanel_button')
    click(toolbar[0]!) // 新建文件
    const input = container.querySelector('input') as HTMLInputElement
    type(input, 'docs/new.md')
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement
    type(textarea, 'fresh')
    const buttons = container.querySelectorAll('.dsh_filePanel_button')
    click(buttons[1]!) // 保存
    await flush()
    expect(api.write).toHaveBeenCalledWith('docs/new.md', 'fresh')
  })

  it('surfaces read failures with localized copy', async () => {
    const api = stubApi({ read: vi.fn(async () => { throw new Error('binary') }) })
    render(propsFor(api))
    click(container.querySelector('.dsh_filePanel_trigger')!)
    await flush()
    const rows = container.querySelectorAll('.dsh_filePanel_row')
    click(rows[1]!)
    await flush()
    expect(container.textContent).toContain('读取失败：binary')
  })

  it('surfaces gateway error envelopes and keeps the editor open on save failure', async () => {
    const api = stubApi({
      write: vi.fn(async () => { throw { result: { error: { message: 'too-large' } } } }),
    })
    render(propsFor(api))
    click(container.querySelector('.dsh_filePanel_trigger')!)
    await flush()
    const rows = container.querySelectorAll('.dsh_filePanel_row')
    click(rows[1]!)
    await flush()
    const buttons = container.querySelectorAll('.dsh_filePanel_button')
    click(buttons[1]!) // 编辑
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement
    type(textarea, 'x')
    const editorButtons = container.querySelectorAll('.dsh_filePanel_button')
    click(editorButtons[1]!) // 保存
    await flush()
    expect(container.textContent).toContain('保存失败：too-large')
    expect(container.querySelector('textarea')).not.toBeNull()
  })

  it('closes on Escape and on outside pointerdown', async () => {
    const api = stubApi()
    render(propsFor(api))
    click(container.querySelector('.dsh_filePanel_trigger')!)
    await flush()
    expect(container.querySelector('.dsh_filePanel_popover')).not.toBeNull()
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(container.querySelector('.dsh_filePanel_popover')).toBeNull()
    click(container.querySelector('.dsh_filePanel_trigger')!)
    await flush()
    expect(container.querySelector('.dsh_filePanel_popover')).not.toBeNull()
    act(() => { document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })) })
    expect(container.querySelector('.dsh_filePanel_popover')).toBeNull()
  })

  it('closes through the close button', async () => {
    const api = stubApi()
    render(propsFor(api))
    click(container.querySelector('.dsh_filePanel_trigger')!)
    await flush()
    click(container.querySelector('.dsh_filePanel_iconButton')!)
    expect(container.querySelector('.dsh_filePanel_popover')).toBeNull()
  })
})
