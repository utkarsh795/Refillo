/**
 * Idempotency key helpers — prevent duplicate submissions from double-taps.
 *
 * A key is generated when a sale/stock-in form opens and embedded in the
 * transaction. The DB schema enforces uniqueness on this key, so a second
 * identical commit simply fails gracefully.
 */

import { v4 as uuidv4 } from 'uuid';

/** Generate a fresh idempotency key (UUID v4). Call once per form open. */
export function newIdempotencyKey(): string {
  return uuidv4();
}

/** Tiny guard: track in-flight submissions to block concurrent double-taps */
const inFlight = new Set<string>();

export function isInFlight(key: string): boolean {
  return inFlight.has(key);
}

export function markInFlight(key: string): void {
  inFlight.add(key);
}

export function clearInFlight(key: string): void {
  inFlight.delete(key);
}
