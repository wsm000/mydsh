/**
 * Workspace-relative path validation for the file panel wire. Pure functions
 * (no fs, no platform module): normalization collapses backslashes, dot
 * segments and duplicate separators into one canonical forward-slash form,
 * so the host can join the result safely under the workspace root. Escape
 * attempts (absolute paths, `..` segments, NUL bytes) throw {@link PathError}
 * with a stable code the client can map to localized copy.
 */

/** Stable machine-readable codes for rejected paths. */
export type PathErrorCode = 'nul' | 'absolute' | 'escape' | 'empty'

/** A rejected workspace-relative path; `code` drives client-side copy. */
export class PathError extends Error {
  readonly code: PathErrorCode

  constructor(code: PathErrorCode, message: string) {
    super(message)
    this.name = 'PathError'
    this.code = code
  }
}

/**
 * Normalize a user-supplied relative path into canonical forward-slash form.
 * The empty string stays empty (the workspace root); anything else must not
 * be absolute and must not contain `..` segments. Segment content is kept
 * verbatim (file names may contain spaces), so validation is about structure.
 * @param input - raw wire value.
 * @returns the canonical relative path ('' = root).
 */
export function normalizeRelative(input: string): string {
  if (input.includes('\0')) throw new PathError('nul', 'file-panel: NUL byte in path')
  const trimmed = input.trim()
  if (trimmed === '') return ''
  if (/^[A-Za-z]:/.test(trimmed) || trimmed.startsWith('/')) {
    throw new PathError('absolute', `file-panel: absolute path rejected: "${trimmed}"`)
  }
  const segments: string[] = []
  for (const segment of trimmed.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') throw new PathError('escape', `file-panel: path escapes the workspace: "${trimmed}"`)
    segments.push(segment)
  }
  return segments.join('/')
}

/**
 * Normalize and require a non-empty relative path (a file target).
 * @param input - raw wire value.
 * @returns the canonical relative path.
 */
export function requireRelativePath(input: string): string {
  const rel = normalizeRelative(input)
  if (rel === '') throw new PathError('empty', 'file-panel: empty path')
  return rel
}
