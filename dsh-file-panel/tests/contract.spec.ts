/**
 * Wire contract tests: the strict descriptor set stays complete and the
 * result codecs accept the shapes the host emits.
 */
import { describe, expect, it } from 'vitest'
import {
  FILE_PANEL_INVOCATIONS,
  listResultSchema,
  readResultSchema,
  writeResultSchema,
} from '../src/contract.ts'

describe('FILE_PANEL_INVOCATIONS', () => {
  it('declares the three endpoints with the agent lookup first', () => {
    expect(FILE_PANEL_INVOCATIONS.map(invocation => invocation.id)).toEqual([
      'dsh-file-panel#filePanel/list',
      'dsh-file-panel#filePanel/read',
      'dsh-file-panel#filePanel/write',
    ])
    for (const invocation of FILE_PANEL_INVOCATIONS) {
      expect(invocation.service).toBe('filePanel')
      expect(invocation.namespace).toBe('filePanel')
      expect(invocation.invocation).toEqual({ kind: 'direct' })
      expect(invocation.cancellation).toEqual({ parameter: 'signal' })
      const lookup = invocation.parameters[0]
      expect(lookup).toMatchObject({
        name: 'agent',
        wire: 'agentId',
        source: 'lookup',
        lookup: 'agent',
        codec: { mode: 'strict', typeSymbol: '@deepseek-ai/dsh-session/types#SessionId' },
      })
    }
  })

  it('declares the business parameters as strict JSON codecs', () => {
    const list = FILE_PANEL_INVOCATIONS[0]!
    expect(list.parameters[1]).toMatchObject({ name: 'dir', wire: 'dir', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-file-panel#Dir' } })
    const read = FILE_PANEL_INVOCATIONS[1]!
    expect(read.parameters[1]).toMatchObject({ name: 'path', wire: 'path', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-file-panel#Path' } })
    const write = FILE_PANEL_INVOCATIONS[2]!
    expect(write.parameters[1]).toMatchObject({ name: 'path', wire: 'path', source: 'json' })
    expect(write.parameters[2]).toMatchObject({ name: 'content', wire: 'content', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-file-panel#Content' } })
  })
})

describe('result codecs', () => {
  it('parses a directory listing result', () => {
    const parsed = listResultSchema.parse({
      entries: [
        { name: 'a.txt', kind: 'file', size: 3, mtime: 123 },
        { name: 'sub', kind: 'dir', size: null, mtime: 456 },
      ],
      truncated: true,
    })
    expect(parsed.entries.length).toBe(2)
    expect(parsed.entries[1]?.kind).toBe('dir')
    expect(parsed.truncated).toBe(true)
  })

  it('rejects a malformed listing result', () => {
    expect(() => listResultSchema.parse({ entries: [{ name: '', kind: 'x' }], truncated: false })).toThrow()
  })

  it('parses read and write results', () => {
    expect(readResultSchema.parse({ content: 'hi', size: 5, truncated: true })).toMatchObject({ content: 'hi', truncated: true })
    expect(writeResultSchema.parse({ size: 2 })).toEqual({ size: 2 })
  })
})
