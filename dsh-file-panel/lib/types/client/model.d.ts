/**
 * Pure display helpers for the file panel browser: canonical relative-path
 * algebra and human-readable size/time formatting. No DOM, no fs — unit
 * tested in a plain node environment.
 */
/** The parent of a canonical relative path ('' = the workspace root). */
export declare function parentOf(rel: string): string;
/** Join a canonical relative directory and one entry name. */
export declare function joinRel(dir: string, name: string): string;
/** The final name segment of a canonical relative path. */
export declare function fileNameOf(rel: string): string;
/** The path segments of a canonical relative path ([] for the root). */
export declare function segmentsOf(rel: string): readonly string[];
/**
 * Format a byte count for the listing meta column.
 * @param bytes - byte length (null for directories).
 * @returns a compact human-readable size, or a dash for null.
 */
export declare function formatSize(bytes: number | null): string;
/**
 * Format an epoch-ms timestamp for the listing meta column.
 * @param mtime - epoch milliseconds (0 = unknown).
 * @returns a short local date-time string, or a dash for unknown.
 */
export declare function formatTime(mtime: number): string;
/**
 * Format a byte count for truncation notices.
 * @param bytes - the byte count.
 * @returns a compact human-readable size.
 */
export declare function formatLimit(bytes: number): string;
