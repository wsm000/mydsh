/**
 * dsh-file-panel client plugin: the browser half of the workspace file
 * panel. Mounts the filePanel Remote namespace and registers a
 * session-header action whose popover hosts the browse / read / edit
 * state machine. All wire traffic stays bounded (entry caps, read caps,
 * write caps) and workspace-contained (the host validates every path).
 */
// Type-only: the ctx.remote merge and the forwarded Host-event face.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { SessionId } from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: the conversation SlotMap merges for the header-actions seat.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: the ctx.locale Context merge.
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the ctx.settingsScope Context merge and the scope contract.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { FilePanelSettings, ListResult, ReadResult, WriteResult } from '../contract.ts'
import { FILE_PANEL_REMOTE } from './remote.ts'
import { NS, en, zh } from './locales.ts'
import { adoptStyles } from './styles.ts'
import { FilePanelAction, type FilePanelActionInjected, type FilePanelApi } from './Panel.tsx'

/** Required services: Remote face, slots, locale, settings scope. */
export const inject = ['remote', 'slots', 'locale', 'settingsScope']

/** The mounted filePanel namespace service's callable face. */
interface FilePanelNamespaceFace {
  list(agentId: SessionId, dir: string, signal?: AbortSignal): Promise<{ ok: true; value: ListResult } | { ok: false; error: { code: string; message: string; details: object } }>
  read(agentId: SessionId, path: string, signal?: AbortSignal): Promise<{ ok: true; value: ReadResult } | { ok: false; error: { code: string; message: string; details: object } }>
  write(agentId: SessionId, path: string, content: string, signal?: AbortSignal): Promise<{ ok: true; value: WriteResult } | { ok: false; error: { code: string; message: string; details: object } }>
}

/** Unwrap a RemoteResult envelope, rejecting with the gateway error text. */
function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  return result.value
}

/**
 * Compose the file panel surface.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-file-panel: dictionaries')

  // The mounted namespace handle resolves through the service store
  // (`ctx.reflect.get`), not through `ctx.remote.filePanel`: the generated-style
  // dotted read walks the cordis fiber chain, which stops at the Loader's
  // runtime-less internal forks between a plugin entry and the root fiber —
  // the namespace service mounted under the gateway entry is unreachable
  // that way (the store path resolves it by isolation label instead).
  let face: FilePanelNamespaceFace | undefined
  ctx.effect(async () => {
    const dispose = await ctx.remote.$mount(FILE_PANEL_REMOTE)
    face = (ctx.reflect as unknown as { get(name: string): unknown }).get('remote.filePanel') as FilePanelNamespaceFace | undefined
    if (face === undefined) {
      throw new Error('dsh-file-panel: the filePanel Remote namespace did not mount')
    }
    return () => {
      face = undefined
      void dispose()
    }
  }, 'dsh-file-panel: remote')

  const scope = ctx.settingsScope.bind<FilePanelSettings>({ namespace: 'file-panel' })

  // One api face per session, resolved lazily so a reconnect that rebuilt
  // the host picks up the fresh namespace service.
  const apiFor = (sessionId: SessionId): FilePanelApi => {
    const current = face
    if (current === undefined) throw new Error('dsh-file-panel: the filePanel Remote is not mounted')
    return {
      list: (dir: string, signal?: AbortSignal) => current.list(sessionId, dir, signal).then(unwrap),
      read: (path: string, signal?: AbortSignal) => current.read(sessionId, path, signal).then(unwrap),
      write: (path: string, content: string, signal?: AbortSignal) => current.write(sessionId, path, content, signal).then(unwrap),
    }
  }

  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'file-panel',
    order: 30,
    locale: NS,
    inject: (sessionId: SessionId): FilePanelActionInjected => ({
      sessionId: String(sessionId),
      t: ctx.locale.bind(NS),
      api: apiFor(sessionId),
      enabled: scope.getSnapshot().value?.enabled ?? true,
    }),
  }, FilePanelAction))
}
