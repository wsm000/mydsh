/**
 * dsh-session-cost host entry — a deliberate no-op.
 *
 * This plugin is client-only: it renders a status chip in the web GUI from
 * session projections and the local clock, with no host service and no wire
 * traffic. The host apply exists only so the profile Loader forms an active
 * entry fiber for the package, which is what the client-module registry scans
 * to discover and serve the `dsh.client` bundle (`/plugins/dsh-session-cost/client.js`).
 */
import type { Context } from '@deepseek-ai/cordis'

/** Cordis plugin name (the Loader entry and client bundle id). */
export const name = 'dsh-session-cost'

/** No host services are required. */
export const inject: string[] = []

/** The host half carries no work; the browser half does everything. */
export function apply(_ctx: Context): void {
  /* Intentionally empty — client-only plugin. */
}
