/**
 * The hand-written host Typert manifest for the filePanel Remote. Registered
 * through `ctx.typert.register` in the plugin body, it claims the wire
 * endpoints through the strict registry — the same path generated `./typert`
 * artifacts use — so the Host Gateway resolves and invokes `filePanel/list`,
 * `filePanel/read` and `filePanel/write` without consulting the `@Remote`
 * marker table. That marker independence matters in the harness's
 * source-launch development environment, where the tsx-loaded gateway and a
 * profile-loaded plugin bundle can hold separate copies of the decorator
 * module state.
 */
import type { TypertContribution } from '@deepseek-ai/dsh-typert-registry/types'
import { FILE_PANEL_INVOCATIONS } from './contract.ts'

/** The filePanel namespace's host manifest (strict codecs shared with the client). */
export const TYPERT_MANIFEST: TypertContribution = {
  package: 'dsh-file-panel',
  face: 'host',
  schemas: [],
  model: {
    services: [
      {
        key: 'filePanel',
        exportName: 'FilePanelRuntime',
        description: 'Workspace file browser and text editor endpoints.',
        tags: [],
        members: [
          {
            kind: 'method',
            name: 'list',
            signature: 'list(agent: Agent, dir: string, signal: AbortSignal): Promise<ListResult>',
          },
          {
            kind: 'method',
            name: 'read',
            signature: 'read(agent: Agent, path: string, signal: AbortSignal): Promise<ReadResult>',
          },
          {
            kind: 'method',
            name: 'write',
            signature: 'write(agent: Agent, path: string, content: string, signal: AbortSignal): Promise<WriteResult>',
          },
        ],
        types: [],
      },
    ],
    events: [],
    objects: [],
  },
  invocations: FILE_PANEL_INVOCATIONS,
}
