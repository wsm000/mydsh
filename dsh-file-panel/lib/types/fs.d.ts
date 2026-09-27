import type { ListResult, ReadResult, WriteResult } from './contract.ts';
/** Stable machine-readable codes for failed operations. */
export type FsErrorCode = 'escape' | 'not-found' | 'not-file' | 'is-directory' | 'binary' | 'too-large' | 'io';
/** A failed filesystem operation; `code` drives client-side copy. */
export declare class FsError extends Error {
    readonly code: FsErrorCode;
    constructor(code: FsErrorCode, message: string);
}
/**
 * Resolve a canonical relative path under the workspace root with a
 * containment re-check: the joined target must still sit inside `root`.
 * @param root - the workspace root.
 * @param rel - canonical relative path ('' = root).
 * @returns the absolute target path.
 */
export declare function resolveInside(root: string, rel: string): string;
/** Options for one bounded directory listing. */
export interface ListOptions {
    /** Hard cap on returned entries. */
    readonly maxEntries: number;
    readonly signal?: AbortSignal;
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
export declare function listDirectory(root: string, rel: string, options: ListOptions): Promise<ListResult>;
/** Options for one bounded text read. */
export interface ReadOptions {
    /** Hard cap on bytes read (larger files report truncated). */
    readonly maxBytes: number;
    readonly signal?: AbortSignal;
}
/**
 * Read a UTF-8 text file prefix under the workspace root (bounded). Binary
 * files (any NUL byte in the read window) are rejected with code `binary`.
 * @param root - the workspace root.
 * @param rel - canonical relative file path.
 * @param options - cap and caller lifetime.
 * @returns the decoded prefix plus the on-disk size and truncation flag.
 */
export declare function readTextFile(root: string, rel: string, options: ReadOptions): Promise<ReadResult>;
/** Options for one atomic text write. */
export interface WriteOptions {
    /** Hard cap on accepted bytes. */
    readonly maxBytes: number;
    /** Whether missing parent directories are created. */
    readonly createDirs: boolean;
    readonly signal?: AbortSignal;
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
export declare function writeTextFile(root: string, rel: string, content: string, options: WriteOptions): Promise<WriteResult>;
