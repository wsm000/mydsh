/**
 * `file-panel` locale namespace: the workspace file panel copy.
 * Chinese is the product copy; English mirrors it.
 */
/** Simplified Chinese dictionary (the key-set source of truth). */
export declare const zh: {
    'action.aria': string;
    'panel.title': string;
    'panel.root': string;
    'panel.up': string;
    'panel.loading': string;
    'panel.empty': string;
    'panel.error': string;
    'panel.truncated': string;
    'action.refresh': string;
    'action.newFile': string;
    close: string;
    'file.size': string;
    'file.modified': string;
    'read.title': string;
    'read.truncated': string;
    'read.binary': string;
    'read.edit': string;
    'edit.title': string;
    'new.title': string;
    'edit.name': string;
    'edit.namePlaceholder': string;
    'edit.content': string;
    'edit.save': string;
    'edit.cancel': string;
    'edit.saving': string;
    'edit.emptyName': string;
    'save.error': string;
    'load.error': string;
};
/** The `file-panel` namespace key union. */
export type FilePanelKey = keyof typeof zh;
/** English dictionary, checked complete against the zh key set. */
export declare const en: {
    'action.aria': string;
    'panel.title': string;
    'panel.root': string;
    'panel.up': string;
    'panel.loading': string;
    'panel.empty': string;
    'panel.error': string;
    'panel.truncated': string;
    'action.refresh': string;
    'action.newFile': string;
    close: string;
    'file.size': string;
    'file.modified': string;
    'read.title': string;
    'read.truncated': string;
    'read.binary': string;
    'read.edit': string;
    'edit.title': string;
    'new.title': string;
    'edit.name': string;
    'edit.namePlaceholder': string;
    'edit.content': string;
    'edit.save': string;
    'edit.cancel': string;
    'edit.saving': string;
    'edit.emptyName': string;
    'save.error': string;
    'load.error': string;
};
/** Locale namespace id registered under ctx.locale. */
export declare const NS = "file-panel";
/**
 * Fill one dictionary template's `{name}`-style placeholders.
 * @param template - dictionary text.
 * @param params - placeholder values; absent params replace nothing.
 * @returns the filled text.
 */
export declare function fmt(template: string, params?: Record<string, string>): string;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The workspace file panel copy. */
        [NS]: FilePanelKey;
    }
}
