import type { ListResult, ReadResult, WriteResult } from '../contract.ts';
import { type PanelT } from './Browser.tsx';
/** The remote face the panel needs (bound to one session by the client entry). */
export interface FilePanelApi {
    readonly list: (dir: string, signal?: AbortSignal) => Promise<ListResult>;
    readonly read: (path: string, signal?: AbortSignal) => Promise<ReadResult>;
    readonly write: (path: string, content: string, signal?: AbortSignal) => Promise<WriteResult>;
}
/** Panel action injected props (the header slot provides sessionId and t). */
export interface FilePanelActionInjected {
    readonly sessionId: string;
    readonly t: PanelT;
    readonly api: FilePanelApi;
    /** Whether the panel surface is enabled; false hides the trigger entirely. */
    readonly enabled: boolean;
}
/**
 * The session-header file panel action.
 * @param props - session identity, bound copy, and the remote api.
 */
export declare function FilePanelAction(props: FilePanelActionInjected): React.JSX.Element;
