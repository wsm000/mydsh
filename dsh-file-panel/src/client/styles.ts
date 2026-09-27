/**
 * The file panel stylesheet, hand-written as a template string and injected
 * once by the plugin body: the web server serves exactly one file per client
 * plugin, so no separate CSS artifact may exist. Tokens come only from the
 * shared `--dsw-alias-*` design platform (no literal colors); class names
 * carry the `dsh_filePanel` prefix to stay unique in the assembled shell.
 */

/** Stable `<style>` element id (idempotent injection across HMR re-runs). */
export const STYLE_ID = 'dsh-file-panel-style'

/** The panel's injected stylesheet text. */
export const cssText = `
.dsh_filePanel_trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 14px;
  background: none;
  color: var(--dsw-alias-label-dimmed);
  cursor: pointer;
}
.dsh_filePanel_trigger:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dsh_filePanel_trigger svg {
  width: 15px;
  height: 15px;
}
.dsh_filePanel_popover {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 440px;
  max-width: calc(100vw - 32px);
  max-height: min(520px, calc(100vh - 120px));
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: var(--dsw-shadow-popover, 0 8px 24px rgb(0 0 0 / 0.12));
  overflow: hidden;
}
.dsh_filePanel_header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.dsh_filePanel_title {
  flex: 1;
  min-width: 0;
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh_filePanel_iconButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 13px;
  background: none;
  color: var(--dsw-alias-label-dimmed);
  cursor: pointer;
}
.dsh_filePanel_iconButton:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dsh_filePanel_iconButton svg {
  width: 14px;
  height: 14px;
}
.dsh_filePanel_crumbs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  overflow-x: auto;
  scrollbar-width: thin;
}
.dsh_filePanel_crumb {
  display: inline-flex;
  align-items: center;
  flex: none;
  padding: 2px 6px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}
.dsh_filePanel_crumb:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dsh_filePanel_crumbSep {
  flex: none;
  color: var(--dsw-alias-label-dimmed);
  font-size: 12px;
  line-height: 18px;
}
.dsh_filePanel_body {
  flex: 1;
  min-height: 120px;
  max-height: 400px;
  overflow-y: auto;
  padding: 4px;
}
.dsh_filePanel_row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 8px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  text-align: left;
  cursor: pointer;
}
.dsh_filePanel_row:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh_filePanel_rowIcon {
  flex: none;
  width: 15px;
  height: 15px;
  color: var(--dsw-alias-label-dimmed);
}
.dsh_filePanel_rowName {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh_filePanel_rowMeta {
  flex: none;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.dsh_filePanel_note {
  padding: 14px 12px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 13px;
  line-height: 20px;
  text-align: center;
}
.dsh_filePanel_error {
  padding: 14px 12px;
  color: var(--dsw-alias-danger-text, var(--dsw-alias-label-primary));
  font-size: 13px;
  line-height: 20px;
}
.dsh_filePanel_editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
}
.dsh_filePanel_field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dsh_filePanel_label {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.dsh_filePanel_input,
.dsh_filePanel_textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
}
.dsh_filePanel_input {
  padding: 5px 8px;
}
.dsh_filePanel_textarea {
  min-height: 220px;
  padding: 8px;
  resize: vertical;
  font-family: var(--dsw-font-mono, ui-monospace, monospace);
  tab-size: 2;
}
.dsh_filePanel_actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.dsh_filePanel_button {
  padding: 4px 14px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
}
.dsh_filePanel_button:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh_filePanel_buttonPrimary {
  border-color: transparent;
  background: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-label-inverse, #fff);
}
.dsh_filePanel_buttonPrimary:hover {
  background: var(--dsw-alias-brand-primary-hover, var(--dsw-alias-brand-primary));
}
.dsh_filePanel_button:disabled {
  opacity: 0.55;
  cursor: default;
}
.dsh_filePanel_readContent {
  padding: 12px;
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-mono, ui-monospace, monospace);
  font-size: 12px;
  line-height: 19px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
`

/**
 * Inject the panel stylesheet once (stable id; HMR-safe).
 */
export function adoptStyles(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = cssText
  document.head.appendChild(style)
}
