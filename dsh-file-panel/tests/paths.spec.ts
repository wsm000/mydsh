/**
 * Path-safety unit tests: the canonicalization and rejection rules that keep
 * every wire path inside the workspace root.
 */
import { describe, expect, it } from 'vitest'
import { normalizeRelative, requireRelativePath, PathError } from '../src/paths.ts'

describe('normalizeRelative', () => {
  it('keeps the empty string as the workspace root', () => {
    expect(normalizeRelative('')).toBe('')
    expect(normalizeRelative('   ')).toBe('')
    expect(normalizeRelative('./')).toBe('')
  })

  it('collapses backslashes, dot segments, and duplicate separators', () => {
    expect(normalizeRelative('docs\\note.md')).toBe('docs/note.md')
    expect(normalizeRelative('./docs//note.md')).toBe('docs/note.md')
    expect(normalizeRelative('a/./b/')).toBe('a/b')
  })

  it('preserves segment content verbatim (spaces are legal in names)', () => {
    expect(normalizeRelative('my file.txt')).toBe('my file.txt')
    expect(normalizeRelative('a b/c d.md')).toBe('a b/c d.md')
  })

  it('rejects NUL bytes', () => {
    expect(() => normalizeRelative('a\0b')).toThrowError(PathError)
    expect(() => normalizeRelative('a\0b')).toThrowError(/NUL/)
  })

  it('rejects absolute paths (forward slash and drive letters)', () => {
    for (const input of ['/etc/passwd', '/abs', 'C:/x', 'c:\\x', 'D:/y/z']) {
      expect(() => normalizeRelative(input)).toThrowError(PathError)
      expect(() => normalizeRelative(input)).toThrowError(/absolute/)
    }
  })

  it('rejects parent traversal anywhere in the path', () => {
    for (const input of ['..', '../x', 'a/../b', 'a/..', '.../x', 'a/../..']) {
      expect(() => normalizeRelative(input)).toThrowError(PathError)
      expect(() => normalizeRelative(input)).toThrowError(/escape/)
    }
  })

  it('rejects only the structural segments, not dotted names', () => {
    expect(normalizeRelative('.env')).toBe('.env')
    expect(normalizeRelative('a/.hidden')).toBe('a/.hidden')
  })
})

describe('requireRelativePath', () => {
  it('requires a non-empty target', () => {
    expect(() => requireRelativePath('')).toThrowError(PathError)
    expect(() => requireRelativePath('  ')).toThrowError(/empty/)
  })

  it('returns the canonical form of a valid target', () => {
    expect(requireRelativePath('docs\\note.md')).toBe('docs/note.md')
  })
})
