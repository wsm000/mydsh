/**
 * Settings registration test: the namespace name and schema defaults.
 */
import { describe, expect, it, vi } from 'vitest'
import { FILE_PANEL_NAMESPACE, FilePanelSettingsSchema, registerFilePanelSettings } from '../src/settings.ts'

describe('registerFilePanelSettings', () => {
  it('registers the branded namespace with the live-applies option', () => {
    const register = vi.fn(() => ({ get: () => ({ enabled: true }) }))
    const ctx = { settings: { register } } as never
    const scope = registerFilePanelSettings(ctx)
    expect(register).toHaveBeenCalledWith(FILE_PANEL_NAMESPACE, FilePanelSettingsSchema, { applies: 'live' })
    expect(scope.get().enabled).toBe(true)
  })

  it('defaults the enable switch to true', () => {
    const parsed = FilePanelSettingsSchema({}) as { enabled: boolean }
    expect(parsed.enabled).toBe(true)
    expect(FilePanelSettingsSchema({ enabled: false }).enabled).toBe(false)
  })
})
