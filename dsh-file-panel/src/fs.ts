/**
 * Bounded filesystem operations for the file panel: one-directory listings,
 * capped UTF-8 text reads, and atomic text writes. Every path is validated
 * through paths.ts and joined under the workspace root with a containment
 * re-check (defense in depth), every filesystem await races the caller's
 * AbortSignal, and every failure maps to a stable {@link FsError} code.
 */
import { mkdir, open, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import type { Dirent, Stats } from 'node:fs'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { randomBytes } from 'node:crypto'
import { normalizeRelative, requireRelativePath } from './paths.ts'
import type { DirEntry, ListResult, ReadResult, WriteResult } from './contract.ts'

/** Stable machine-readable codes for failed operations. */
export type FsErrorCode =
  | 'escape'
  | 'not-found'
  | 'not-file'
  | 'is-directory'
  | 'binary'
  | 'too-large'
  | 'io'

/** A failed filesystem operation; `code` drives client-side copy. */
export class FsError extends Error {
  readonly code: FsErrorCode

  constructor(code: FsErrorCode, message: string) {
    super(message)
    this.name = 'FsError'
    this.code = code
  }
}

/** The thrown value as an Error (wire/abort reasons may be anything). */
function asError(reason: unknown): Error {
  /* v8 ignore next -- the non-Error arm needs a non-Error fs rejection; node:fs rejects with Errors. */
  return reason instanceof Error ? reason : new Error(String(reason))
}

/** Message text of an unknown thrown value. */
function messageOf(error: unknown): string {
  /* v8 ignore next -- node:fs rejects with Error instances; the String arm only satisfies the unknown narrowing. */
  return error instanceof Error ? error.message : String(error)
}

/** Await `operation`, rejecting with the signal's reason the moment it aborts. */
function raceAbort<T>(operation: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (signal === undefined) return operation
  return new Promise<T>((resolve, reject) => {
    /* v8 ignore start -- requires a filesystem await to stall exactly while abort lands; pre-aborted callers exit before raceAbort. */
    const onAbort = (): void => {
      operation.catch(() => {
        // Abandoned operation: its rejection is already accounted for by the
        // abort reason carrying the outcome to the caller.
      })
      reject(asError(signal.reason))
    }
    if (signal.aborted) {
      onAbort()
      return
    }
    /* v8 ignore stop */
    signal.addEventListener('abort', onAbort, { once: true })
    operation.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (reason: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(asError(reason))
      },
    )
  })
}

/**
 * Resolve a canonical relative path under the workspace root with a
 * containment re-check: the joined target must still sit inside `root`.
 * @param root - the workspace root.
 * @param rel - canonical relative path ('' = root).
 * @returns the absolute target path.
 */
export function resolveInside(root: string, rel: string): string {
  const canonical = normalizeRelative(rel)
  const target = join(root, ...canonical.split('/').filter(Boolean))
  const check = relative(root, target)
  if (check === '' || check.startsWith('..') || isAbsolute(check)) {
    throw new FsError('escape', `file-panel: resolved path escapes the workspace: "${rel}"`)
  }
  return target
}

/** Rank a dirent for the dirs-first, name-second listing order. */
function kindRank(dirent: Dirent): number {
  return dirent.isDirectory() ? 0 : 1
}

/** Compare two dirents: directories first, then locale-aware names. */
function compareDirents(a: Dirent, b: Dirent): number {
  const rank = kindRank(a) - kindRank(b)
  return rank !== 0 ? rank : a.name.localeCompare(b.name)
}

/** Stat `path`, mapping failures to null (a listing row can tolerate races). */
async function statOrNull(path: string, signal: AbortSignal | undefined): Promise<Stats | null> {
  try {
    return await raceAbort(stat(path), signal)
  } catch {
    return null
  }
}

/** Map a node:fs rejection to an FsError with a stable code. */
function mapFsError(action: string, target: string, error: unknown): FsError {
  const code = asError(error)
  if ((code as NodeJS.ErrnoException).code === 'ENOENT') {
    return new FsError('not-found', `file-panel: ${action} not found: "${target}"`)
  }
  if ((code as NodeJS.ErrnoException).code === 'EISDIR') {
    return new FsError('is-directory', `file-panel: ${action} is a directory: "${target}"`)
  }
  return new FsError('io', `file-panel: cannot ${action} "${target}": ${messageOf(error)}`)
}

/** Options for one bounded directory listing. */
export interface ListOptions {
  /** Hard cap on returned entries. */
  readonly maxEntries: number
  readonly signal?: AbortSignal
}

/**
 * List one directory under the workspace root (bounded, dirs-first, sorted).
 * Symlinked and special entries are skipped so the panel never leaves the
 * workspace through a link and never renders unreadable node types.
 * @param root - the workspace root.
 * @param rel - canonical relative directory path ('' = root).
 * @param options - cap and caller lifetime.
 * @returns the bounded entry list and the honest truncation flag.
 */
export async function listDirectory(
  root: string,
  rel: string,
  options: ListOptions,
): Promise<ListResult> {
  const target = resolveInside(root, rel)
  let dirents: Dirent[]
  try {
    dirents = await raceAbort(readdir(target, { withFileTypes: true }), options.signal)
  } catch (error: unknown) {
    options.signal?.throwIfAborted()
    throw mapFsError('list', target, error)
  }
  const visible = dirents
    .filter((dirent) => dirent.isFile() || dirent.isDirectory())
    .sort(compareDirents)
  const truncated = visible.length > options.maxEntries
  const rows = truncated ? visible.slice(0, options.maxEntries) : visible
  const entries: DirEntry[] = await Promise.all(rows.map(async (dirent) => {
    const child = join(target, dirent.name)
    const info = await statOrNull(child, options.signal)
    return {
      name: dirent.name,
      kind: dirent.isDirectory() ? 'dir' as const : 'file' as const,
      size: dirent.isFile() && info !== null ? info.size : null,
      mtime: info !== null ? info.mtimeMs : 0,
    }
  }))
  return { entries, truncated }
}

/** Options for one bounded text read. */
export interface ReadOptions {
  /** Hard cap on bytes read (larger files report truncated). */
  readonly maxBytes: number
  readonly signal?: AbortSignal
}

/**
 * Read a UTF-8 text file prefix under the workspace root (bounded). Binary
 * files (any NUL byte in the read window) are rejected with code `binary`.
 * @param root - the workspace root.
 * @param rel - canonical relative file path.
 * @param options - cap and caller lifetime.
 * @returns the decoded prefix plus the on-disk size and truncation flag.
 */
export async function readTextFile(
  root: string,
  rel: string,
  options: ReadOptions,
): Promise<ReadResult> {
  const target = resolveInside(root, requireRelativePath(rel))
  let info: Stats
  try {
    info = await raceAbort(stat(target), options.signal)
  } catch (error: unknown) {
    options.signal?.throwIfAborted()
    throw mapFsError('read', target, error)
  }
  if (!info.isFile()) throw new FsError('not-file', `file-panel: not a file: "${target}"`)
  const length = Math.min(info.size, options.maxBytes)
  const buffer = Buffer.alloc(length)
  if (length > 0) {
    const handle = await raceAbort(open(target, 'r'), options.signal)
    try {
      await raceAbort(handle.read(buffer, 0, length, 0), options.signal)
    } finally {
      await handle.close()
    }
  }
  if (buffer.includes(0)) throw new FsError('binary', `file-panel: binary file: "${target}"`)
  return {
    content: buffer.toString('utf8'),
    size: info.size,
    truncated: info.size > options.maxBytes,
  }
}

/** Options for one atomic text write. */
export interface WriteOptions {
  /** Hard cap on accepted bytes. */
  readonly maxBytes: number
  /** Whether missing parent directories are created. */
  readonly createDirs: boolean
  readonly signal?: AbortSignal
}

/**
 * Write a UTF-8 text file under the workspace root, atomically (temp file +
 * rename). Missing parents are created when `createDirs` is set; writing over
 * an existing directory is rejected.
 * @param root - the workspace root.
 * @param rel - canonical relative file path.
 * @param content - the UTF-8 text to persist.
 * @param options - cap, parent policy, and caller lifetime.
 * @returns the bytes written.
 */
export async function writeTextFile(
  root: string,
  rel: string,
  content: string,
  options: WriteOptions,
): Promise<WriteResult> {
  const target = resolveInside(root, requireRelativePath(rel))
  const bytes = Buffer.from(content, 'utf8')
  if (bytes.length > options.maxBytes) {
    throw new FsError('too-large', `file-panel: write exceeds ${options.maxBytes} bytes`)
  }
  let existing: Stats | null
  try {
    existing = await statOrNull(target, options.signal)
  } catch {
    existing = null
  }
  if (existing !== null && existing.isDirectory()) {
    throw new FsError('is-directory', `file-panel: target is a directory: "${target}"`)
  }
  const parent = dirname(target)
  if (options.createDirs) {
    try {
      await raceAbort(mkdir(parent, { recursive: true }), options.signal)
    } catch (error: unknown) {
      options.signal?.throwIfAborted()
      throw mapFsError('create', parent, error)
    }
  }
  const tmp = join(parent, `.dsh-file-panel-${randomBytes(6).toString('hex')}.tmp`)
  try {
    await raceAbort(writeFile(tmp, bytes, { flag: 'wx' }), options.signal)
    await raceAbort(rename(tmp, target), options.signal)
  } catch (error: unknown) {
    options.signal?.throwIfAborted()
    // Best-effort cleanup of the abandoned temp file (never touch `target`).
    try {
      await unlink(tmp)
    } catch {
      /* v8 ignore next -- cleanup failure has no consumer. */
      void 0
    }
    throw mapFsError('write', target, error)
  }
  return { size: bytes.length }
}
