/**
 * The `file-panel` settings namespace: the durable enable switch every
 * deployment can turn off from the Web settings page. Registered with the
 * settings provider at plugin load; the runtime reads the owner scope's live
 * value on every call, so a toggle takes effect without a restart.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace, type SettingsScope } from '@deepseek-ai/dsh-settings'
import type { FilePanelSettings } from './contract.ts'

/** The branded namespace name (the Web allowlist must list the same string). */
export const FILE_PANEL_NAMESPACE = settingsNamespace('file-panel')

/** Schemastery schema of the `file-panel` namespace section. */
export const FilePanelSettingsSchema: z<FilePanelSettings> = z.object({
  enabled: z.boolean().default(true),
})

/**
 * Register the namespace with the settings provider and return its owner scope.
 * @param ctx - the plugin context carrying the settings provider.
 * @returns the owner scope backing the runtime's live enable check.
 */
export function registerFilePanelSettings(ctx: Context): SettingsScope<FilePanelSettings> {
  return ctx.settings.register(FILE_PANEL_NAMESPACE, FilePanelSettingsSchema, { applies: 'live' })
}
