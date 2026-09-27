/**
 * Filesystem seam tests: bounded listings, capped text reads, atomic writes,
 * and the path-containment defense over real node:fs fixture trees.
 */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FsError, listDirectory, readTextFile, resolveInside, writeTextFile } from '../src/fs.ts'
import { PathError } from '../src/paths.ts'

let root = ''

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'dsh-file-panel-fs-'))
  await mkdir(join(root, 'sub'))
  await writeFile(join(root, 'a.txt'), 'hello world')
  await writeFile(join(root, 'sub', 'b.txt'), 'nested')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const signal = (): AbortSignal => new AbortController().signal

describe('listDirectory', () => {
  it('lists the root with directories first, then names, with sizes and mtimes', async () => {
    const result = await listDirectory(root, '', { maxEntries: 10, signal: signal() })
    expect(result.truncated).toBe(false)
    expect(result.entries.map((entry) => `${entry.kind}:${entry.name}`)).toEqual(['dir:sub', 'file:a.txt'])
    const file = result.entries.find((entry) => entry.name === 'a.txt')
    expect(file?.size).toBe(11)
    expect(typeof file?.mtime).toBe('number')
    const dir = result.entries.find((entry) => entry.name === 'sub')
    expect(dir?.size).toBeNull()
  })

  it('lists a nested directory through its relative path', async () => {
    const result = await listDirectory(root, 'sub', { maxEntries: 10, signal: signal() })
    expect(result.entries.map((entry) => entry.name)).toEqual(['b.txt'])
  })

  it('truncates honestly at the entry cap', async () => {
    const result = await listDirectory(root, '', { maxEntries: 1, signal: signal() })
    expect(result.truncated).toBe(true)
    expect(result.entries.length).toBe(1)
  })

  it('rejects escape and absolute paths before touching the filesystem', async () => {
    await expect(listDirectory(root, '../outside', { maxEntries: 10, signal: signal() })).rejects.toBeInstanceOf(PathError)
    await expect(listDirectory(root, 'C:/outside', { maxEntries: 10, signal: signal() })).rejects.toBeInstanceOf(PathError)
    await expect(listDirectory(root, '/outside', { maxEntries: 10, signal: signal() })).rejects.toBeInstanceOf(PathError)
  })

  it('reports a missing directory as not-found', async () => {
    await expect(listDirectory(root, 'missing', { maxEntries: 10, signal: signal() })).rejects.toMatchObject({ code: 'not-found' })
  })
})

describe('readTextFile', () => {
  it('reads a UTF-8 text file with its full size', async () => {
    const result = await readTextFile(root, 'a.txt', { maxBytes: 1024, signal: signal() })
    expect(result.content).toBe('hello world')
    expect(result.size).toBe(11)
    expect(result.truncated).toBe(false)
  })

  it('reads nested files and truncates past the cap with an honest flag', async () => {
    const result = await readTextFile(root, 'sub/b.txt', { maxBytes: 3, signal: signal() })
    expect(result.content).toBe('nes')
    expect(result.size).toBe(6)
    expect(result.truncated).toBe(true)
  })

  it('reads an empty file', async () => {
    await writeFile(join(root, 'empty.txt'), '')
    const result = await readTextFile(root, 'empty.txt', { maxBytes: 1024, signal: signal() })
    expect(result.content).toBe('')
    expect(result.size).toBe(0)
    expect(result.truncated).toBe(false)
  })

  it('rejects binary content with a stable code', async () => {
    await writeFile(join(root, 'bin.dat'), Buffer.from([0x68, 0x00, 0x69]))
    await expect(readTextFile(root, 'bin.dat', { maxBytes: 1024, signal: signal() })).rejects.toMatchObject({ code: 'binary' })
  })

  it('rejects directories and missing files', async () => {
    await expect(readTextFile(root, 'sub', { maxBytes: 1024, signal: signal() })).rejects.toMatchObject({ code: 'not-file' })
    await expect(readTextFile(root, 'nope.txt', { maxBytes: 1024, signal: signal() })).rejects.toMatchObject({ code: 'not-found' })
  })

  it('rejects empty and escaping targets', async () => {
    await expect(readTextFile(root, '', { maxBytes: 1024, signal: signal() })).rejects.toBeInstanceOf(PathError)
    await expect(readTextFile(root, '..', { maxBytes: 1024, signal: signal() })).rejects.toBeInstanceOf(PathError)
  })
})

describe('writeTextFile', () => {
  it('creates a new file atomically (round-trip through read)', async () => {
    const result = await writeTextFile(root, 'new.txt', 'fresh', { maxBytes: 1024, createDirs: true, signal: signal() })
    expect(result.size).toBe(5)
    expect(await readFile(join(root, 'new.txt'), 'utf8')).toBe('fresh')
    // No temp files left behind by the atomic write.
    expect((await readdir(root)).filter((name) => name.includes('.dsh-file-panel-'))).toEqual([])
  })

  it('creates missing parent directories when allowed', async () => {
    await writeTextFile(root, 'deep/nested/file.md', 'x', { maxBytes: 1024, createDirs: true, signal: signal() })
    expect(await readFile(join(root, 'deep', 'nested', 'file.md'), 'utf8')).toBe('x')
  })

  it('overwrites an existing file', async () => {
    await writeTextFile(root, 'a.txt', 'changed', { maxBytes: 1024, createDirs: true, signal: signal() })
    expect(await readFile(join(root, 'a.txt'), 'utf8')).toBe('changed')
  })

  it('rejects writes over the byte cap', async () => {
    await expect(writeTextFile(root, 'big.txt', 'hello', { maxBytes: 3, createDirs: true, signal: signal() }))
      .rejects.toMatchObject({ code: 'too-large' })
  })

  it('rejects writing into an existing directory', async () => {
    await expect(writeTextFile(root, 'sub', 'x', { maxBytes: 1024, createDirs: true, signal: signal() }))
      .rejects.toMatchObject({ code: 'is-directory' })
  })

  it('fails cleanly when parents are missing and creation is disabled', async () => {
    await expect(writeTextFile(root, 'missing-dir/f.txt', 'x', { maxBytes: 1024, createDirs: false, signal: signal() }))
      .rejects.toBeInstanceOf(FsError)
  })

  it('rejects escape and empty targets', async () => {
    await expect(writeTextFile(root, '../escape.txt', 'x', { maxBytes: 1024, createDirs: true, signal: signal() }))
      .rejects.toBeInstanceOf(PathError)
    await expect(writeTextFile(root, '', 'x', { maxBytes: 1024, createDirs: true, signal: signal() }))
      .rejects.toBeInstanceOf(PathError)
  })
})

describe('resolveInside', () => {
  it('re-resolves canonical paths under the root with a containment check', () => {
    expect(resolveInside(root, 'a/b.txt')).toBe(join(root, 'a', 'b.txt'))
    expect(resolveInside(root, '')).toBe(root)
    expect(() => resolveInside(root, '..')).toThrowError(PathError)
    expect(() => resolveInside(root, '/x')).toThrowError(PathError)
  })
})
