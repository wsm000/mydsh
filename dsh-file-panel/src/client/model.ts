/**
 * Pure display helpers for the file panel browser: canonical relative-path
 * algebra and human-readable size/time formatting. No DOM, no fs — unit
 * tested in a plain node environment.
 */

/** The parent of a canonical relative path ('' = the workspace root). */
export function parentOf(rel: string): string {
  const index = rel.lastIndexOf('/')
  return index === -1 ? '' : rel.slice(0, index)
}

/** Join a canonical relative directory and one entry name. */
export function joinRel(dir: string, name: string): string {
  return dir === '' ? name : `${dir}/${name}`
}

/** The final name segment of a canonical relative path. */
export function fileNameOf(rel: string): string {
  const index = rel.lastIndexOf('/')
  return index === -1 ? rel : rel.slice(index + 1)
}

/** The path segments of a canonical relative path ([] for the root). */
export function segmentsOf(rel: string): readonly string[] {
  return rel === '' ? [] : rel.split('/')
}

/**
 * Format a byte count for the listing meta column.
 * @param bytes - byte length (null for directories).
 * @returns a compact human-readable size, or a dash for null.
 */
export function formatSize(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB'] as const
  let value = bytes
  let unit = -1
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${units[unit]}`
}

/**
 * Format an epoch-ms timestamp for the listing meta column.
 * @param mtime - epoch milliseconds (0 = unknown).
 * @returns a short local date-time string, or a dash for unknown.
 */
export function formatTime(mtime: number): string {
  if (mtime === 0) return '—'
  return new Date(mtime).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format a byte count for truncation notices.
 * @param bytes - the byte count.
 * @returns a compact human-readable size.
 */
export function formatLimit(bytes: number): string {
  return formatSize(bytes)
}
