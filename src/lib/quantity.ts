/**
 * Quantity helpers — all DB values stored as milli-units (qty × 1000).
 * This eliminates floating-point drift for common retail quantities.
 *
 * Examples:
 *   1 piece  → 1000
 *   0.5 kg   → 500
 *   0.25 L   → 250
 *   12 pkt   → 12000
 */

export const MILLI = 1000;

/** Convert a human-readable quantity to milli-units for storage */
export function toMilli(qty: number): number {
  return Math.round(qty * MILLI);
}

/** Convert milli-units from storage back to a human-readable number */
export function fromMilli(milli: number): number {
  return milli / MILLI;
}

/** Format a milli-unit value for display (strips trailing zeros) */
export function displayQty(milli: number, unit: string): string {
  const val = fromMilli(milli);
  const formatted =
    Number.isInteger(val) ? val.toString() : val.toFixed(3).replace(/\.?0+$/, '');
  return `${formatted} ${unit}`;
}

/** Parse a user-typed string into milli-units. Returns NaN if invalid. */
export function parseQty(input: string): number {
  const n = parseFloat(input.trim());
  if (isNaN(n) || n < 0) return NaN;
  return toMilli(n);
}

/** Unit labels for display */
export const UNIT_LABELS: Record<string, string> = {
  piece: 'pcs',
  kg: 'kg',
  litre: 'L',
  packet: 'pkt',
};

export type Unit = 'piece' | 'kg' | 'litre' | 'packet';
export const UNITS: Unit[] = ['piece', 'kg', 'litre', 'packet'];
