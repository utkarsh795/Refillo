/**
 * Dexie database schema for Refillo.
 *
 * All quantities stored as milli-units (integer × 1000).
 * Schema versioning ensures data is preserved across app updates.
 */

import Dexie, { type Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import type { Unit } from '../lib/quantity';

// ─── Entity Types ────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  nameHindi?: string;
  category: string;
  unit: Unit;
  /** Stored as milli-units (qty × 1000) */
  currentQtyMilli: number;
  purchaseCost?: number;   // in rupees, optional
  sellingPrice?: number;   // in rupees, optional
  /** Milli-units below which item is flagged as low stock */
  lowStockThresholdMilli: number;
  barcode?: string;
  supplierName?: string;
  leadTimeDays?: number;
  staleReviewedAt?: Date;
  trackingSince: Date;
  lastSoldAt?: Date;
  isActive: boolean;
}

export type MovementType =
  | 'opening'
  | 'received'
  | 'sale'
  | 'sale_reversal'
  | 'adjustment';

export interface StockMovement {
  id: string;
  productId: string;
  type: MovementType;
  /** Positive = stock added, Negative = stock removed. Milli-units. */
  deltaQtyMilli: number;
  note?: string;
  /** Links to the parent saleTxn.id if type is 'sale' or 'sale_reversal' */
  transactionId?: string;
  createdAt: Date;
}

export interface SaleLineItem {
  productId: string;
  productName: string;
  qtyMilli: number;
  unit: Unit;
  sellingPrice?: number;
}

export interface SaleTxn {
  id: string;
  items: SaleLineItem[];
  totalAmount?: number;
  createdAt: Date;
  /** UUID generated when the sale form opens. Enforces uniqueness. */
  idempotencyKey: string;
}

export interface ReorderDraft {
  id: string;
  productId: string;
  requestedQtyMilli: number;
  note?: string;
  createdAt: Date;
  orderedAt?: Date;
  status: 'pending' | 'ordered' | 'received';
}

export interface Setting {
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
}

// ─── Database Class ───────────────────────────────────────────────────────────

export class RefilloDatabase extends Dexie {
  products!: Table<Product, string>;
  stockMovements!: Table<StockMovement, string>;
  saleTxns!: Table<SaleTxn, string>;
  reorderDrafts!: Table<ReorderDraft, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super('RefilloDB');

    // Version 1 — initial schema
    this.version(1).stores({
      products:       'id, name, category, barcode, isActive, lastSoldAt',
      stockMovements: 'id, productId, type, createdAt, transactionId',
      saleTxns:       'id, createdAt, &idempotencyKey',
      reorderDrafts:  'id, productId, status, createdAt',
      settings:       'key',
    });

    // Version 2 — Reorder Sheet & supplier/review support
    this.version(2).stores({
      products:       'id, name, category, barcode, isActive, lastSoldAt, staleReviewedAt',
      stockMovements: 'id, productId, type, createdAt, transactionId',
      saleTxns:       'id, createdAt, &idempotencyKey',
      reorderDrafts:  'id, productId, status, createdAt, orderedAt',
      settings:       'key',
    });
  }
}

export const db = new RefilloDatabase();

// ─── Factory helpers ──────────────────────────────────────────────────────────

export function newProduct(
  partial: Omit<Product, 'id' | 'trackingSince' | 'isActive' | 'currentQtyMilli'>
): Product {
  return {
    id: uuidv4(),
    currentQtyMilli: 0,
    trackingSince: new Date(),
    isActive: true,
    ...partial,
  };
}
