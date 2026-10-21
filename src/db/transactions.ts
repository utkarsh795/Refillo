/**
 * Atomic database transactions for Refillo.
 *
 * All operations that touch multiple tables are wrapped in Dexie transactions
 * so they either fully succeed or fully roll back — no partial writes.
 */

import { v4 as uuidv4 } from 'uuid';
import { db, type SaleLineItem } from './schema';
import { isInFlight, markInFlight, clearInFlight } from '../lib/idempotency';

// ─── Record a Sale ────────────────────────────────────────────────────────────

export interface RecordSaleInput {
  items: SaleLineItem[];
  totalAmount?: number;
  idempotencyKey: string;
}

export async function recordSale(input: RecordSaleInput): Promise<string> {
  const { items, totalAmount, idempotencyKey } = input;

  // In-flight guard (double-tap within same JS event loop)
  if (isInFlight(idempotencyKey)) {
    throw new Error('DUPLICATE_SUBMISSION');
  }

  // DB-level idempotency: check if this key was already committed
  const existing = await db.saleTxns
    .where('idempotencyKey')
    .equals(idempotencyKey)
    .first();
  if (existing) return existing.id;

  markInFlight(idempotencyKey);

  try {
    const txnId = uuidv4();
    const now = new Date();

    await db.transaction('rw', [db.products, db.stockMovements, db.saleTxns], async () => {
      // Validate stock availability first
      for (const item of items) {
        const product = await db.products.get(item.productId);
        if (!product) throw new Error(`Product not found: ${item.productId}`);
        if (product.currentQtyMilli < item.qtyMilli) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }
      }

      // Deduct stock and record movements
      for (const item of items) {
        await db.products
          .where('id')
          .equals(item.productId)
          .modify((p) => {
            p.currentQtyMilli -= item.qtyMilli;
            p.lastSoldAt = now;
          });

        await db.stockMovements.add({
          id: uuidv4(),
          productId: item.productId,
          type: 'sale',
          deltaQtyMilli: -item.qtyMilli,
          transactionId: txnId,
          createdAt: now,
        });
      }

      // Record the sale transaction
      await db.saleTxns.add({
        id: txnId,
        items,
        totalAmount,
        createdAt: now,
        idempotencyKey,
      });
    });

    return txnId;
  } finally {
    clearInFlight(idempotencyKey);
  }
}

// ─── Receive Stock ────────────────────────────────────────────────────────────

export interface ReceiveStockInput {
  productId: string;
  qtyMilli: number;
  note?: string;
  type?: 'received' | 'opening' | 'adjustment';
}

export async function receiveStock(input: ReceiveStockInput): Promise<void> {
  const { productId, qtyMilli, note, type = 'received' } = input;

  await db.transaction('rw', [db.products, db.stockMovements], async () => {
    const product = await db.products.get(productId);
    if (!product) throw new Error(`Product not found: ${productId}`);

    await db.products
      .where('id')
      .equals(productId)
      .modify((p) => {
        p.currentQtyMilli += qtyMilli;
      });

    await db.stockMovements.add({
      id: uuidv4(),
      productId,
      type,
      deltaQtyMilli: qtyMilli,
      note,
      createdAt: new Date(),
    });
  });
}

// ─── Reverse a Sale ───────────────────────────────────────────────────────────

export async function reverseSale(saleTxnId: string): Promise<void> {
  const txn = await db.saleTxns.get(saleTxnId);
  if (!txn) throw new Error(`Sale transaction not found: ${saleTxnId}`);

  await db.transaction('rw', [db.products, db.stockMovements], async () => {
    const now = new Date();
    for (const item of txn.items) {
      await db.products
        .where('id')
        .equals(item.productId)
        .modify((p) => {
          p.currentQtyMilli += item.qtyMilli;
        });

      await db.stockMovements.add({
        id: uuidv4(),
        productId: item.productId,
        type: 'sale_reversal',
        deltaQtyMilli: item.qtyMilli,
        transactionId: saleTxnId,
        note: 'Sale reversed',
        createdAt: now,
      });
    }
  });
}

// ─── Set Opening Stock ────────────────────────────────────────────────────────

export async function setOpeningStock(productId: string, qtyMilli: number): Promise<void> {
  await db.transaction('rw', [db.products, db.stockMovements], async () => {
    const product = await db.products.get(productId);
    if (!product) throw new Error(`Product not found: ${productId}`);

    const delta = qtyMilli - product.currentQtyMilli;

    await db.products
      .where('id')
      .equals(productId)
      .modify((p) => {
        p.currentQtyMilli = qtyMilli;
      });

    await db.stockMovements.add({
      id: uuidv4(),
      productId,
      type: 'opening',
      deltaQtyMilli: delta,
      note: 'Opening stock set',
      createdAt: new Date(),
    });
  });
}
