/**
 * dsh-file-panel host plugin: mounts the `filePanel` Typert Remote service
 * (bounded workspace directory listings, UTF-8 text reads, and atomic text
 * writes for the browser's file panel), registers its strict Typert manifest,
 * and registers the settings enable switch. Every path is validated against
 * the addressed agent's workspace root; file content crosses the wire only on
 * explicit user actions in the panel. The client half ships in the same
 * package (`./client`); the web server serves it under
 * /plugins/dsh-file-panel/client.js.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
// Type-only: brings the `ctx.typert` Context merge into this program.
import type {} from '@deepseek-ai/dsh-typert-registry'
// Type-only: brings the `ctx.settings` and `ctx.agents` Context merges in.
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-agent'
import { FilePanelRuntime } from './runtime.ts'
import { TYPERT_MANIFEST } from './typert.ts'
import { registerFilePanelSettings } from './settings.ts'
import type { ResolvedConfig } from './types.ts'

/** Cordis plugin name (the Loader entry and client bundle id). */
export const name = 'dsh-file-panel'

/** Services required before load: the Typert registry, the settings provider, and the agent registry. */
export const inject = ['typert', 'settings', 'agents']

/** Host plugin configuration, validated at load by the Loader. */
export interface Config {
  /** Hard cap on bytes read from one file; larger files report `truncated`. */
  maxReadBytes: number
  /** Hard cap on bytes accepted by one write. */
  maxWriteBytes: number
  /** Hard cap on entries returned by one directory listing. */
  maxListEntries: number
  /** Whether writes create missing parent directories. */
  createDirs: boolean
}

/**
 * Configuration schema: deployment-varying bounds stay tunable from
 * the profile patch. The inferred schema type keeps the callable form accepting
 * partial input, so `Config({})` yields the defaults (what the Loader does
 * for Loader compositions).
 */
export const Config = z.object({
  maxReadBytes: z.natural().min(1).default(1024 * 1024),
  maxWriteBytes: z.natural().min(1).default(4 * 1024 * 1024),
  maxListEntries: z.natural().min(1).default(1000),
  createDirs: z.boolean().default(true),
})

/**
 * Mount the filePanel service.
 * @param ctx - host cordis context.
 * @param config - validated plugin configuration (schema defaults applied).
 */
export function apply(ctx: Context, config?: Config): void {
  const resolved: ResolvedConfig = Config(config ?? {})
  // The durable enable switch: the runtime reads its live value per call, so
  // toggling it in the Web settings takes effect immediately.
  const settings = registerFilePanelSettings(ctx)
  const isEnabled = (): boolean => settings.get().enabled
  new FilePanelRuntime(ctx, resolved, isEnabled)
  // Strict endpoint registration: the gateway resolves filePanel/* from
  // this manifest, independent of decorator marker state.
  ctx.effect(() => {
    const dispose = ctx.typert.register(TYPERT_MANIFEST)
    return () => { void dispose() }
  }, 'dsh-file-panel: typert manifest')
}
