/**
 * The filePanel wire contract, shared verbatim by the host manifest
 * (`ctx.typert.register` in typert.ts) and the client contribution
 * (`ctx.remote.$mount` in client/remote.ts). Three endpoints: directory
 * listing, bounded UTF-8 text reads, and bounded atomic text writes. Path
 * safety (no absolute paths, no `..` escapes, no NUL) is enforced host-side
 * in paths.ts — the wire codecs only guarantee the JSON shapes.
 */
import { z } from 'zod';
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol';
/** One entry of a directory listing (files carry size, directories do not). */
export interface DirEntry {
    readonly name: string;
    readonly kind: 'file' | 'dir';
    /** Byte length; null for directories. */
    readonly size: number | null;
    /** Last modification time, epoch milliseconds. */
    readonly mtime: number;
}
/** One bounded directory listing result. */
export interface ListResult {
    readonly entries: readonly DirEntry[];
    /** True when the directory held more entries than the configured cap. */
    readonly truncated: boolean;
}
/** One bounded UTF-8 text read result. */
export interface ReadResult {
    readonly content: string;
    /** Full byte length of the file on disk. */
    readonly size: number;
    /** True when the file was larger than the read cap (content is the prefix). */
    readonly truncated: boolean;
}
/** One atomic text write result. */
export interface WriteResult {
    /** Bytes written. */
    readonly size: number;
}
/** The `file-panel` settings namespace's durable shape (host and client share it). */
export interface FilePanelSettings {
    /** Whether the file panel surface is enabled; false refuses every endpoint. */
    readonly enabled: boolean;
}
/** Wire codec: one session identity (branded string on the wire). */
export declare const sessionIdSchema: z.ZodString;
/** Wire codec: a workspace-relative path ('' means the workspace root). */
export declare const relativePathSchema: z.ZodString;
/** Wire codec: one directory listing entry. */
export declare const dirEntrySchema: z.ZodReadonly<z.ZodObject<{
    name: z.ZodString;
    kind: z.ZodEnum<{
        file: "file";
        dir: "dir";
    }>;
    size: z.ZodNullable<z.ZodNumber>;
    mtime: z.ZodNumber;
}, z.core.$strip>>;
/** Wire codec: a directory listing result. */
export declare const listResultSchema: z.ZodReadonly<z.ZodObject<{
    entries: z.ZodArray<z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        kind: z.ZodEnum<{
            file: "file";
            dir: "dir";
        }>;
        size: z.ZodNullable<z.ZodNumber>;
        mtime: z.ZodNumber;
    }, z.core.$strip>>>;
    truncated: z.ZodBoolean;
}, z.core.$strip>>;
/** Wire codec: a bounded text read result. */
export declare const readResultSchema: z.ZodReadonly<z.ZodObject<{
    content: z.ZodString;
    size: z.ZodNumber;
    truncated: z.ZodBoolean;
}, z.core.$strip>>;
/** Wire codec: a text write result. */
export declare const writeResultSchema: z.ZodReadonly<z.ZodObject<{
    size: z.ZodNumber;
}, z.core.$strip>>;
/** The filePanel Remote namespace's strict invocation descriptors. */
export declare const FILE_PANEL_INVOCATIONS: readonly InvocationDescriptor[];
