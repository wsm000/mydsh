/**
 * dsh-file-panel host plugin: mounts the `filePanel` Typert Remote service
 * (bounded workspace directory listings, UTF-8 text reads, and atomic text
 * writes for the browser's file panel), registers its strict Typert manifest,
 * and registers the settings enable switch. Every path is validated against
 * the addressed agent's workspace root; file content crosses the wire only on
 * explicit user actions in the panel. The client half ships in the same
 * package (`./client`); the web server serves it under
 * /plugins/dsh-file-panel/client.js.
 */
import type { Context } from '@deepseek-ai/cordis';
/** Cordis plugin name (the Loader entry and client bundle id). */
export declare const name = "dsh-file-panel";
/** Services required before load: the Typert registry, the settings provider, and the agent registry. */
export declare const inject: string[];
/** Host plugin configuration, validated at load by the Loader. */
export interface Config {
    /** Hard cap on bytes read from one file; larger files report `truncated`. */
    maxReadBytes: number;
    /** Hard cap on bytes accepted by one write. */
    maxWriteBytes: number;
    /** Hard cap on entries returned by one directory listing. */
    maxListEntries: number;
    /** Whether writes create missing parent directories. */
    createDirs: boolean;
}
/**
 * Configuration schema: deployment-varying bounds stay tunable from
 * the profile patch. The inferred schema type keeps the callable form accepting
 * partial input, so `Config({})` yields the defaults (what the Loader does
 * for Loader compositions).
 */
export declare const Config: any;
/**
 * Mount the filePanel service.
 * @param ctx - host cordis context.
 * @param config - validated plugin configuration (schema defaults applied).
 */
export declare function apply(ctx: Context, config?: Config): void;
