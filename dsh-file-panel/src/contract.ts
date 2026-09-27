/**
 * The filePanel wire contract, shared verbatim by the host manifest
 * (`ctx.typert.register` in typert.ts) and the client contribution
 * (`ctx.remote.$mount` in client/remote.ts). Three endpoints: directory
 * listing, bounded UTF-8 text reads, and bounded atomic text writes. Path
 * safety (no absolute paths, no `..` escapes, no NUL) is enforced host-side
 * in paths.ts — the wire codecs only guarantee the JSON shapes.
 */
import { z } from 'zod'
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'

/** One entry of a directory listing (files carry size, directories do not). */
export interface DirEntry {
  readonly name: string
  readonly kind: 'file' | 'dir'
  /** Byte length; null for directories. */
  readonly size: number | null
  /** Last modification time, epoch milliseconds. */
  readonly mtime: number
}

/** One bounded directory listing result. */
export interface ListResult {
  readonly entries: readonly DirEntry[]
  /** True when the directory held more entries than the configured cap. */
  readonly truncated: boolean
}

/** One bounded UTF-8 text read result. */
export interface ReadResult {
  readonly content: string
  /** Full byte length of the file on disk. */
  readonly size: number
  /** True when the file was larger than the read cap (content is the prefix). */
  readonly truncated: boolean
}

/** One atomic text write result. */
export interface WriteResult {
  /** Bytes written. */
  readonly size: number
}

/** The `file-panel` settings namespace's durable shape (host and client share it). */
export interface FilePanelSettings {
  /** Whether the file panel surface is enabled; false refuses every endpoint. */
  readonly enabled: boolean
}

/** Wire codec: one session identity (branded string on the wire). */
export const sessionIdSchema = z.string().min(1)

/** Wire codec: a workspace-relative path ('' means the workspace root). */
export const relativePathSchema = z.string()

/** Wire codec: one directory listing entry. */
export const dirEntrySchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['file', 'dir']),
  size: z.number().nullable(),
  mtime: z.number(),
}).readonly()

/** Wire codec: a directory listing result. */
export const listResultSchema = z.object({
  entries: z.array(dirEntrySchema),
  truncated: z.boolean(),
}).readonly()

/** Wire codec: a bounded text read result. */
export const readResultSchema = z.object({
  content: z.string(),
  size: z.number(),
  truncated: z.boolean(),
}).readonly()

/** Wire codec: a text write result. */
export const writeResultSchema = z.object({
  size: z.number(),
}).readonly()

/** The agent lookup parameter shared by every invocation. */
const agentParameter = {
  name: 'agent',
  wire: 'agentId',
  source: 'lookup',
  lookup: 'agent',
  // The type symbol must equal the agent lookup provider's wire identity
  // exactly — the gateway's strict path rejects a mismatched symbol.
  codec: { mode: 'strict', typeSymbol: '@deepseek-ai/dsh-session/types#SessionId', schema: sessionIdSchema },
} as const

/** The filePanel Remote namespace's strict invocation descriptors. */
export const FILE_PANEL_INVOCATIONS: readonly InvocationDescriptor[] = [
  {
    id: 'dsh-file-panel#filePanel/list',
    service: 'filePanel',
    namespace: 'filePanel',
    method: 'list',
    invocation: { kind: 'direct' },
    parameters: [
      agentParameter,
      { name: 'dir', wire: 'dir', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-file-panel#Dir', schema: relativePathSchema } },
    ],
    cancellation: { parameter: 'signal' },
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-file-panel#ListResult',
      schema: listResultSchema,
    },
  },
  {
    id: 'dsh-file-panel#filePanel/read',
    service: 'filePanel',
    namespace: 'filePanel',
    method: 'read',
    invocation: { kind: 'direct' },
    parameters: [
      agentParameter,
      { name: 'path', wire: 'path', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-file-panel#Path', schema: relativePathSchema } },
    ],
    cancellation: { parameter: 'signal' },
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-file-panel#ReadResult',
      schema: readResultSchema,
    },
  },
  {
    id: 'dsh-file-panel#filePanel/write',
    service: 'filePanel',
    namespace: 'filePanel',
    method: 'write',
    invocation: { kind: 'direct' },
    parameters: [
      agentParameter,
      { name: 'path', wire: 'path', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-file-panel#Path', schema: relativePathSchema } },
      { name: 'content', wire: 'content', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-file-panel#Content', schema: z.string() } },
    ],
    cancellation: { parameter: 'signal' },
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-file-panel#WriteResult',
      schema: writeResultSchema,
    },
  },
]
