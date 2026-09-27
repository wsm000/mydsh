/**
 * Type-only declarations for dsh-file-panel: resolved configuration shape.
 * This module has no runtime code; coverage tooling excludes it.
 */

/** Resolved host plugin configuration (schema defaults applied). */
export interface ResolvedConfig {
  /** Hard cap on bytes read from one file; larger files report `truncated`. */
  readonly maxReadBytes: number
  /** Hard cap on bytes accepted by one write. */
  readonly maxWriteBytes: number
  /** Hard cap on entries returned by one directory listing. */
  readonly maxListEntries: number
  /** Whether writes create missing parent directories. */
  readonly createDirs: boolean
}
