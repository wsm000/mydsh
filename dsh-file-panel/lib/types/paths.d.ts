/**
 * Workspace-relative path validation for the file panel wire. Pure functions
 * (no fs, no platform module): normalization collapses backslashes, dot
 * segments and duplicate separators into one canonical forward-slash form,
 * so the host can join the result safely under the workspace root. Escape
 * attempts (absolute paths, `..` segments, NUL bytes) throw {@link PathError}
 * with a stable code the client can map to localized copy.
 */
/** Stable machine-readable codes for rejected paths. */
export type PathErrorCode = 'nul' | 'absolute' | 'escape' | 'empty';
/** A rejected workspace-relative path; `code` drives client-side copy. */
export declare class PathError extends Error {
    readonly code: PathErrorCode;
    constructor(code: PathErrorCode, message: string);
}
/**
 * Normalize a user-supplied relative path into canonical forward-slash form.
 * The empty string stays empty (the workspace root); anything else must not
 * be absolute and must not contain `..` segments. Segment content is kept
 * verbatim (file names may contain spaces), so validation is about structure.
 * @param input - raw wire value.
 * @returns the canonical relative path ('' = root).
 */
export declare function normalizeRelative(input: string): string;
/**
 * Normalize and require a non-empty relative path (a file target).
 * @param input - raw wire value.
 * @returns the canonical relative path.
 */
export declare function requireRelativePath(input: string): string;
