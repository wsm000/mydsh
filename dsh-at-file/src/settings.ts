/**
 * The `at-file` settings namespace: the durable enable switch every
 * deployment can turn off from the Web settings page. Registered with the
 * settings provider at plugin load; the runtime reads the owner scope's live
 * value on every call, so a toggle takes effect without a restart.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace, type SettingsScope } from '@deepseek-ai/dsh-settings'
import type { AtFileSettings } from './contract.ts'

/** The branded namespace name (the Web allowlist must list the same string). */
export const AT_FILE_NAMESPACE = settingsNamespace('at-file')

/** Schemastery schema of the `at-file` namespace section. */
export const AtFileSettingsSchema: z<AtFileSettings> = z.object({
  enabled: z.boolean().default(true),
})

/**
 * Register the namespace with the settings provider and return its owner scope.
 * @param ctx - the plugin context carrying the settings provider.
 * @returns the owner scope backing the runtime's live enable check.
 */
export function registerAtFileSettings(ctx: Context): SettingsScope<AtFileSettings> {
  return ctx.settings.register(AT_FILE_NAMESPACE, AtFileSettingsSchema, { applies: 'live' })
}
