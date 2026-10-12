/**
 * The injected stylesheet, hand-written as a template string (the web server
 * serves exactly one file per client plugin, so no separate CSS artifact).
 * Colors come only from the shared `--dsw-alias-*` design platform; class
 * names carry the `dsh_cc` prefix to stay unique in the assembled shell.
 */

/** Stable <style> element id (idempotent injection across HMR re-runs). */
export const STYLE_ID = 'dsh-compaction-counter-style'

/** The chip stylesheet text. */
export const cssText = `
.dsh_cc_chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  min-width: 0;
  white-space: nowrap;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  cursor: default;
}
.dsh_cc_label {
  color: var(--dsw-alias-label-tertiary);
}
.dsh_cc_count {
  color: var(--dsw-alias-label-primary);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
.dsh_cc_failed {
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  color: var(--dsw-alias-state-error-primary, #e5484d);
  background: var(--dsw-alias-state-error-secondary, rgba(229, 72, 77, 0.12));
}
`

/** Inject the stylesheet once (stable id; HMR-safe). */
export function adoptStyles(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = cssText
  document.head.appendChild(style)
}
