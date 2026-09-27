/**
 * The dsh-file-panel host Remote service (`ctx.filePanel`, wire namespace
 * `filePanel`). Registered as a TypertRemoteService so the Host Gateway's
 * source-mode discovery exports its @Remote methods to the Web client under
 * `/api/filePanel/<method>` with zero generated artifacts: every method takes
 * the resolved live Agent (the `agent` Typert lookup) and operates on that
 * session's workspace root only.
 */
import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ListResult, ReadResult, WriteResult } from './contract.ts';
import type { ResolvedConfig } from './types.ts';
/** File-panel workspace service: browse, read, and edit workspace text files. */
export declare class FilePanelRuntime extends TypertRemoteService {
    private readonly config;
    private readonly isEnabled;
    /**
     * Register the service under the `filePanel` key (the wire namespace).
     * @param ctx - owning cordis context.
     * @param config - resolved plugin configuration.
     * @param isEnabled - live settings read; false refuses every endpoint.
     */
    constructor(ctx: Context, config: ResolvedConfig, isEnabled: () => boolean);
    /** The addressed agent's workspace root (session header cwd). */
    private workspaceOf;
    /** Refuse every endpoint while the settings switch is off. */
    private requireEnabled;
    /**
     * List one workspace directory (bounded, dirs-first, sorted).
     * @param agent - the live agent resolved from the `agentId` wire field.
     * @param dir - workspace-relative directory path ('' = root).
     * @param signal - caller lifetime; the readdir races it.
     */
    list(agent: Agent, dir: string, signal: AbortSignal): Promise<ListResult>;
    /**
     * Read a workspace text file prefix (bounded, binary-rejecting).
     * @param agent - the live agent resolved from the `agentId` wire field.
     * @param path - workspace-relative file path.
     * @param signal - caller lifetime; the reads race it.
     */
    read(agent: Agent, path: string, signal: AbortSignal): Promise<ReadResult>;
    /**
     * Write a workspace text file (atomic, bounded, parent-creating).
     * @param agent - the live agent resolved from the `agentId` wire field.
     * @param path - workspace-relative file path.
     * @param content - the UTF-8 text to persist.
     * @param signal - caller lifetime; the writes race it.
     */
    write(agent: Agent, path: string, content: string, signal: AbortSignal): Promise<WriteResult>;
}
