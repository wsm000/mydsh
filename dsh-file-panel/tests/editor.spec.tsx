// @vitest-environment jsdom
/**
 * Read/editor view tests: preview content, truncation and binary notices,
 * new-file naming, save/cancel wiring.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Editor, type EditorInjected, ReadView, type ReadViewInjected } from '../src/client/Editor.tsx'
import { fmt, zh } from '../src/client/locales.ts'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

afterEach(() => {
  act(() => { root.unmount() })
  container.remove()
})

function render(node: React.ReactNode): void {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => { root.render(node) })
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

const t = (key: keyof typeof zh, params?: Record<string, string>): string => fmt(zh[key] ?? key, params)

describe('ReadView', () => {
  it('renders content with the path title and wires edit/back', () => {
    const onEdit = vi.fn()
    const onBack = vi.fn()
    render(<ReadView path="a.txt" content="hello" size={5} truncated={false} error={null} onEdit={onEdit} onBack={onBack} t={t} />)
    expect(container.textContent).toContain('查看 a.txt')
    expect(container.textContent).toContain('hello')
    const buttons = container.querySelectorAll('.dsh_filePanel_button')
    click(buttons[0]!)
    expect(onBack).toHaveBeenCalled()
    click(buttons[1]!)
    expect(onEdit).toHaveBeenCalled()
  })

  it('shows the truncation notice when truncated', () => {
    render(<ReadView path="big.txt" content="prefix" size={9000} truncated error={null} onEdit={() => {}} onBack={() => {}} t={t} />)
    expect(container.textContent).toContain('已截断显示')
  })

  it('shows the read error instead of content', () => {
    render(<ReadView path="bin.dat" content="" size={0} truncated={false} error="读取失败：binary" onEdit={() => {}} onBack={() => {}} t={t} />)
    expect(container.textContent).toContain('读取失败：binary')
    expect(container.querySelector('.dsh_filePanel_readContent')).toBeNull()
  })
})

describe('Editor', () => {
  it('edits an existing file: title, draft content, save with the fixed path', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(<Editor path="a.txt" isNew={false} initial="draft" busy={false} error={null} onSave={onSave} onCancel={onCancel} t={t} />)
    expect(container.textContent).toContain('编辑 a.txt')
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea.value).toBe('draft')
    type(textarea, 'updated draft')
    const buttons = container.querySelectorAll('.dsh_filePanel_button')
    click(buttons[1]!)
    expect(onSave).toHaveBeenCalledWith('a.txt', 'updated draft')
    click(buttons[0]!)
    expect(onCancel).toHaveBeenCalled()
  })

  it('creates a new file: name field required, then saves with the name', () => {
    const onSave = vi.fn()
    render(<Editor path="" isNew initial="" busy={false} error={null} onSave={onSave} onCancel={() => {}} t={t} />)
    const input = container.querySelector('input') as HTMLInputElement
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement
    // Saving with an empty name is refused.
    const buttons = container.querySelectorAll('.dsh_filePanel_button')
    click(buttons[1]!)
    expect(onSave).not.toHaveBeenCalled()
    expect(container.textContent).toContain('请先填写文件名')
    type(input, 'docs/new.md')
    type(textarea, 'content')
    click(buttons[1]!)
    expect(onSave).toHaveBeenCalledWith('docs/new.md', 'content')
  })

  it('disables actions and shows progress while busy', () => {
    render(<Editor path="a.txt" isNew={false} initial="" busy error="保存失败：boom" onSave={() => {}} onCancel={() => {}} t={t} />)
    expect(container.textContent).toContain('保存中')
    expect(container.textContent).toContain('boom')
    const buttons = container.querySelectorAll('.dsh_filePanel_button')
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true)
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(true)
  })
})
