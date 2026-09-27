/**
 * The invariant companion for dsh-file-panel: defensive checks that must
 * never fire in a healthy deployment. Kept as a tiny standalone module so
 * both halves can import it without pulling in the host runtime.
 */

/** An invariant that was violated; the message carries the violated fact. */
export class InvariantError extends Error {
  constructor(reason: string) {
    super(`No runtime invariant: ${reason}`)
    this.name = 'InvariantError'
  }
}

/**
 * Assert a condition that must hold; throws {@link InvariantError} otherwise.
 * @param condition - the fact the caller relies on.
 * @param reason - what the fact was, for the violation message.
 */
export function invariant(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new InvariantError(reason)
}
