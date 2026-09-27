/**
 * The client-side Typert Remote contribution for the dsh-file-panel host
 * service: mounts the shared strict descriptors into `ctx.remote.filePanel`.
 * The descriptors and codecs come from the shared contract module, so the
 * browser bundle and the host manifest stay on one wire definition.
 */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { ListResult, ReadResult, WriteResult } from '../contract.ts';
export type { DirEntry, ListResult, ReadResult, WriteResult } from '../contract.ts';
/** The filePanel Remote namespace's client contribution. */
export declare const FILE_PANEL_REMOTE: TypertRemoteContribution;
declare module '@deepseek-ai/dsh-typert-protocol' {
    /** The `filePanel` namespace face mounted under `ctx.remote.filePanel`. */
    interface TypertRemoteNamespace$66696c6550616e656c {
        list: (agentId: SessionId, dir: string, signal?: AbortSignal) => Promise<RemoteResult<ListResult>>;
        read: (agentId: SessionId, path: string, signal?: AbortSignal) => Promise<RemoteResult<ReadResult>>;
        write: (agentId: SessionId, path: string, content: string, signal?: AbortSignal) => Promise<RemoteResult<WriteResult>>;
    }
    interface TypertRemoteMap {
        'filePanel/list': (agentId: SessionId, dir: string, signal?: AbortSignal) => Promise<RemoteResult<ListResult>>;
        'filePanel/read': (agentId: SessionId, path: string, signal?: AbortSignal) => Promise<RemoteResult<ReadResult>>;
        'filePanel/write': (agentId: SessionId, path: string, content: string, signal?: AbortSignal) => Promise<RemoteResult<WriteResult>>;
    }
    interface TypertRemoteNamespaceMap {
        filePanel: TypertRemoteNamespace$66696c6550616e656c;
    }
}
