/**
 * The `file-panel` settings namespace: the durable enable switch every
 * deployment can turn off from the Web settings page. Registered with the
 * settings provider at plugin load; the runtime reads the owner scope's live
 * value on every call, so a toggle takes effect without a restart.
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type SettingsScope } from '@deepseek-ai/dsh-settings';
import type { FilePanelSettings } from './contract.ts';
/** The branded namespace name (the Web allowlist must list the same string). */
export declare const FILE_PANEL_NAMESPACE: any;
/** Schemastery schema of the `file-panel` namespace section. */
export declare const FilePanelSettingsSchema: z<FilePanelSettings>;
/**
 * Register the namespace with the settings provider and return its owner scope.
 * @param ctx - the plugin context carrying the settings provider.
 * @returns the owner scope backing the runtime's live enable check.
 */
export declare function registerFilePanelSettings(ctx: Context): SettingsScope<FilePanelSettings>;
