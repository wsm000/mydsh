/**
 * The directory browser view of the file panel: breadcrumb navigation, the
 * bounded entry list (dirs first, then name), and the toolbar (new file,
 * refresh). Presentational: all state lives in the panel container; every
 * row click maps to a callback prop.
 */
import type { DirEntry } from '../contract.ts';
import type { FilePanelKey } from './locales.ts';
/** A translation function bound to the panel namespace. */
export type PanelT = (key: FilePanelKey, params?: Record<string, string>) => string;
/** Browser view injected props (the panel container provides them). */
export interface BrowserInjected {
    /** Canonical relative directory being shown ('' = workspace root). */
    readonly dir: string;
    readonly entries: readonly DirEntry[];
    readonly loading: boolean;
    /** Localized error text (null when fine). */
    readonly error: string | null;
    /** True when the listing was truncated by the entry cap. */
    readonly truncated: boolean;
    readonly onEnterDir: (name: string) => void;
    readonly onOpenFile: (name: string) => void;
    /** Jump to an ancestor directory (breadcrumb navigation). */
    readonly onJump: (dir: string) => void;
    readonly onUp: () => void;
    readonly onNewFile: () => void;
    readonly onRefresh: () => void;
    readonly t: PanelT;
}
/**
 * The browser view.
 * @param props - injected callbacks and state.
 */
export declare function Browser(props: BrowserInjected): React.JSX.Element;
