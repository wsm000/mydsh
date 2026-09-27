/**
 * The injected stylesheet, hand-written as a template string (the web server
 * serves exactly one file per client plugin, so no separate CSS artifact).
 * Colors come only from the shared `--dsw-alias-*` design platform; class
 * names carry the `dsh_sc` prefix to stay unique in the assembled shell.
 */

/** Stable <style> element id (idempotent injection across HMR re-runs). */
export const STYLE_ID = 'dsh-session-cost-style'

/** The status chip stylesheet text. */
export const cssText = `
.dsh_sc_chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  min-width: 0;
  font-size: 12px;
  line-height: 18px;
}
.dsh_sc_item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
}
.dsh_sc_itemLabel {
  color: var(--dsw-alias-label-tertiary);
}
.dsh_sc_amount {
  color: var(--dsw-alias-label-primary);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
.dsh_sc_period {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 8px;
  border-radius: 999px;
  cursor: default;
  white-space: nowrap;
}
.dsh_sc_periodDot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}
.dsh_sc_period--peak .dsh_sc_periodDot {
  background: var(--dsw-alias-state-error-primary, #e5484d);
}
.dsh_sc_period--idle .dsh_sc_periodDot {
  background: var(--dsw-alias-state-success-primary, #30a46c);
}
.dsh_sc_period--peak {
  color: var(--dsw-alias-state-error-primary, #e5484d);
}
.dsh_sc_period--idle {
  color: var(--dsw-alias-state-success-primary, #30a46c);
}
`

/**
 * Inject the stylesheet once (stable id; HMR-safe).
 */
export function adoptStyles(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = cssText
  document.head.appendChild(style)
}
