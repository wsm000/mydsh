// @vitest-environment jsdom
/**
 * The settings section presentation: one labeled enable checkbox reflecting
 * the scope value, and the write routing to the scope on toggle.
 */
import { describe, expect, it, vi } from 'vitest'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import type { ReactElement } from 'react'
import { AtFileSection, type AtFileSectionProps } from '../src/client/SettingsSection.tsx'
import { fmt, zh } from '../src/client/locales.ts'

globalThis.IS_REACT_ACT_ENVIRONMENT = false

const t = (key: string, params?: Record<string, string>): string => fmt(zh[key] ?? key, params)

function props(over: { enabled?: boolean; setEnabled?: (enabled: boolean) => Promise<void> } = {}): AtFileSectionProps {
  const stub = {
    useScope: (selector: (snapshot: { value?: { enabled?: boolean } }) => boolean) =>
      selector(over.enabled === undefined ? {} : { value: { enabled: over.enabled } }),
    setEnabled: over.setEnabled ?? (async () => {}),
    t,
  }
  return stub as unknown as AtFileSectionProps
}

function mount(element: ReactElement): { root: Root; container: HTMLDivElement } {
  const container = document.createElement('div')
  const root = createRoot(container)
  flushSync(() => { root.render(element) })
  return { root, container }
}

describe('AtFileSection', () => {
  it('renders one labeled checkbox reflecting the scope value', () => {
    const { root, container } = mount(<AtFileSection {...props({ enabled: true })} />)
    expect(container.textContent).toContain(zh['settings.enabled'])
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
    root.unmount()
  })

  it('defaults the checkbox to checked before the first settings read', () => {
    const { root, container } = mount(<AtFileSection {...props({ enabled: undefined })} />)
    expect((container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(true)
    root.unmount()
  })

  it('writes the flipped value through the scope on change', () => {
    const setEnabled = vi.fn(async () => {})
    const { root, container } = mount(<AtFileSection {...props({ enabled: true, setEnabled })} />)
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement
    checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(setEnabled).toHaveBeenCalledWith(false)
    root.unmount()
  })
})
