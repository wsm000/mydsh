// @vitest-environment jsdom
/**
 * Browser view tests: entry rows, state notes, breadcrumbs, and callbacks.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DirEntry } from '../src/contract.ts'
import { Browser, type BrowserInjected } from '../src/client/Browser.tsx'
import { fmt, zh } from '../src/client/locales.ts'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

afterEach(() => {
  act(() => { root.unmount() })
  container.remove()
})

function render(props: BrowserInjected): void {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => { root.render(<Browser {...props} />) })
}

function click(el: Element): void {
  act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
}

function textOf(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim()
}

const t = (key: keyof typeof zh, params?: Record<string, string>): string => fmt(zh[key] ?? key, params)

const fileEntry = (name: string, size = 11, mtime = 1000): DirEntry => ({ name, kind: 'file', size, mtime })
const dirEntry = (name: string): DirEntry => ({ name, kind: 'dir', size: null, mtime: 2000 })

function baseProps(overrides?: Partial<BrowserInjected>): BrowserInjected {
  return {
    dir: '',
    entries: [dirEntry('sub'), fileEntry('a.txt')],
    loading: false,
    error: null,
    truncated: false,
    onEnterDir: vi.fn(),
    onOpenFile: vi.fn(),
    onJump: vi.fn(),
    onUp: vi.fn(),
    onNewFile: vi.fn(),
    onRefresh: vi.fn(),
    t,
    ...overrides,
  }
}

describe('Browser', () => {
  it('renders directories first with names and meta, and maps clicks', () => {
    const props = baseProps()
    render(props)
    const rows = container.querySelectorAll('.dsh_filePanel_row')
    expect(rows.length).toBe(2)
    expect(textOf(rows[0]!)).toContain('sub')
    expect(textOf(rows[1]!)).toContain('a.txt')
    expect(textOf(rows[1]!)).toContain('11 B')
    click(rows[0]!)
    expect(props.onEnterDir).toHaveBeenCalledWith('sub')
    click(rows[1]!)
    expect(props.onOpenFile).toHaveBeenCalledWith('a.txt')
  })

  it('shows the empty note for an empty directory', () => {
    render(baseProps({ entries: [] }))
    expect(container.textContent).toContain('空目录')
  })

  it('shows the loading note while loading', () => {
    render(baseProps({ loading: true, entries: [] }))
    expect(container.textContent).toContain('加载中')
  })

  it('shows the error note instead of rows', () => {
    render(baseProps({ error: '出错了：boom' }))
    expect(container.textContent).toContain('boom')
    expect(container.querySelectorAll('.dsh_filePanel_row').length).toBe(0)
  })

  it('shows the truncation note when truncated', () => {
    render(baseProps({ truncated: true, entries: [fileEntry('a.txt')] }))
    expect(container.textContent).toContain('仅显示前 1 项')
  })

  it('navigates via breadcrumbs and toolbar buttons', () => {
    const props = baseProps({ dir: 'a/b' })
    render(props)
    const crumbs = container.querySelectorAll('.dsh_filePanel_crumb')
    // ←, root, a, b
    click(crumbs[0]!)
    expect(props.onUp).toHaveBeenCalled()
    click(crumbs[1]!)
    expect(props.onJump).toHaveBeenCalledWith('')
    click(crumbs[2]!)
    expect(props.onJump).toHaveBeenCalledWith('a')
    // The last crumb is disabled (current directory).
    expect((crumbs[3] as HTMLButtonElement).disabled).toBe(true)
    const buttons = container.querySelectorAll('.dsh_filePanel_button')
    click(buttons[0]!)
    expect(props.onNewFile).toHaveBeenCalled()
    click(buttons[1]!)
    expect(props.onRefresh).toHaveBeenCalled()
  })
})
