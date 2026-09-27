import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
/** Required services: Remote face, slots, locale, settings scope. */
export declare const inject: string[];
/**
 * Compose the file panel surface.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
