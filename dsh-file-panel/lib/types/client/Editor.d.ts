import type { PanelT } from './Browser.tsx';
/** Read view injected props. */
export interface ReadViewInjected {
    /** Canonical relative file path. */
    readonly path: string;
    readonly content: string;
    /** Full on-disk byte length. */
    readonly size: number;
    readonly truncated: boolean;
    readonly error: string | null;
    readonly onEdit: () => void;
    readonly onBack: () => void;
    readonly t: PanelT;
}
/**
 * The read-only preview view.
 * @param props - injected content and callbacks.
 */
export declare function ReadView(props: ReadViewInjected): React.JSX.Element;
/** Editor view injected props. */
export interface EditorInjected {
    /** Canonical relative path being edited ('' in new-file mode). */
    readonly path: string;
    readonly isNew: boolean;
    /** The current draft content ('' for new files). */
    readonly initial: string;
    readonly busy: boolean;
    /** Localized error text (null when fine). */
    readonly error: string | null;
    readonly onSave: (path: string, content: string) => void;
    readonly onCancel: () => void;
    readonly t: PanelT;
}
/**
 * The edit / new-file form.
 * @param props - injected draft, save wiring, and copy.
 */
export declare function Editor(props: EditorInjected): React.JSX.Element;
