/**
 * Pure calculation and export utilities for the Reorder Sheet.
 *
 * Implements transparent, deterministic stock forecasting, fallback logic,
 * and slow/dead stock classification with configurable grace periods.
 */

import type { Product, StockMovement } from '../db/schema';
import { fromMilli, UNIT_LABELS } from './quantity.ts';

export interface SalesVelocityStats {
  hasSalesHistory: boolean;
  totalQtySoldMilli: number;
  historyDays: number;
  avgDailySalesMilli: number;
  saleCount: number;
}

export interface RestockCalculation {
  product: Product;
  isLowStock: boolean;
  currentQty: number;
  minStockQty: number;
  salesStats: SalesVelocityStats;
  daysRemaining: number | null;
  suggestedQtyMilli: number;
  suggestedQty: number;
  calculationMethod: 'history' | 'fallback';
  explanation: string;
  supplierName: string;
}

export interface SlowStockCalculation {
  product: Product;
  currentQty: number;
  daysSinceAdded: number;
  isInGracePeriod: boolean;
  isNeverSold: boolean;
  lastSaleDate: Date | null;
  daysSinceLastSale: number | null;
  isSlowMoving: boolean;
  classificationReason: string;
  stockValue: number | undefined;
  isReviewed: boolean;
  reviewedAt: Date | undefined;
}

export interface ReorderSettings {
  leadTimeDays: number;
  safetyStockDays: number;
  staleDays: number;
  staleGracePeriodDays: number;
}

export const DEFAULT_REORDER_SETTINGS: ReorderSettings = {
  leadTimeDays: 3,
  safetyStockDays: 7,
  staleDays: 30,
  staleGracePeriodDays: 14,
};

/**
 * Calculates historical sales velocity from actual sale movements.
 */
export function calculateSalesVelocity(
  movements: StockMovement[],
  trackingSince: Date | string,
  now = new Date()
): SalesVelocityStats {
  const saleMovements = movements.filter((m) => m.type === 'sale');

  if (saleMovements.length === 0) {
    return {
      hasSalesHistory: false,
      totalQtySoldMilli: 0,
      historyDays: 0,
      avgDailySalesMilli: 0,
      saleCount: 0,
    };
  }

  let totalQtySoldMilli = 0;
  let earliestSaleMs = now.getTime();

  for (const m of saleMovements) {
    totalQtySoldMilli += Math.abs(m.deltaQtyMilli);
    const mTime = new Date(m.createdAt).getTime();
    if (mTime < earliestSaleMs) {
      earliestSaleMs = mTime;
    }
  }

  const trackingStartMs = new Date(trackingSince).getTime();
  const baselineStartMs = Math.min(earliestSaleMs, trackingStartMs);
  const diffMs = now.getTime() - baselineStartMs;
  const historyDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const avgDailySalesMilli = totalQtySoldMilli / historyDays;

  return {
    hasSalesHistory: totalQtySoldMilli > 0,
    totalQtySoldMilli,
    historyDays,
    avgDailySalesMilli,
    saleCount: saleMovements.length,
  };
}

/**
 * Calculates restock metrics, days remaining, and suggested order quantity.
 */
export function calculateRestockItem(
  product: Product,
  movements: StockMovement[],
  settings: Pick<ReorderSettings, 'leadTimeDays' | 'safetyStockDays'>,
  now = new Date()
): RestockCalculation {
  const currentQty = fromMilli(product.currentQtyMilli);
  const minStockQty = fromMilli(product.lowStockThresholdMilli);
  const isLowStock = product.currentQtyMilli <= product.lowStockThresholdMilli;
  const salesStats = calculateSalesVelocity(movements, product.trackingSince, now);

  const daysRemaining =
    salesStats.hasSalesHistory && salesStats.avgDailySalesMilli > 0
      ? product.currentQtyMilli / salesStats.avgDailySalesMilli
      : null;

  const effectiveLeadTime = product.leadTimeDays ?? settings.leadTimeDays;
  const bufferDays = effectiveLeadTime + settings.safetyStockDays;

  let suggestedQtyMilli = 0;
  let calculationMethod: 'history' | 'fallback' = 'fallback';
  let explanation = '';

  const unitLabel = UNIT_LABELS[product.unit] || product.unit;

  if (salesStats.hasSalesHistory && salesStats.avgDailySalesMilli > 0) {
    calculationMethod = 'history';
    const targetBufferMilli = salesStats.avgDailySalesMilli * bufferDays;
    const targetStockMilli = Math.max(product.lowStockThresholdMilli, targetBufferMilli);
    const deficitMilli = Math.max(0, targetStockMilli - product.currentQtyMilli);

    // Kirana store packaging roundings:
    // packet/piece: whole units
    // kg/litre: 0.25 unit steps
    const stepMilli = product.unit === 'kg' || product.unit === 'litre' ? 250 : 1000;
    const roundedMilli = Math.ceil(deficitMilli / stepMilli) * stepMilli;
    suggestedQtyMilli = Math.max(stepMilli, roundedMilli);

    const avgDisplay = fromMilli(salesStats.avgDailySalesMilli).toFixed(1);
    explanation = `Based on sales history: ~${avgDisplay} ${unitLabel}/day (${effectiveLeadTime}d lead + ${settings.safetyStockDays}d safety stock)`;
  } else {
    calculationMethod = 'fallback';
    // Fallback formula: (3 × minimum stock) - current stock
    const targetFallbackMilli = product.lowStockThresholdMilli * 3;
    const deficitMilli = Math.max(0, targetFallbackMilli - product.currentQtyMilli);

    const stepMilli = product.unit === 'kg' || product.unit === 'litre' ? 250 : 1000;
    const roundedMilli = Math.ceil(deficitMilli / stepMilli) * stepMilli;
    // Ensure at least 1 unit or the deficit
    suggestedQtyMilli = Math.max(stepMilli, roundedMilli, product.lowStockThresholdMilli);

    explanation = `Fallback: Based on 3× min stock buffer (no sales history recorded yet)`;
  }

  return {
    product,
    isLowStock,
    currentQty,
    minStockQty,
    salesStats,
    daysRemaining,
    suggestedQtyMilli,
    suggestedQty: fromMilli(suggestedQtyMilli),
    calculationMethod,
    explanation,
    supplierName: product.supplierName || 'Not specified',
  };
}

/**
 * Calculates slow and dead stock classification adhering to the grace period.
 */
export function calculateSlowStockItem(
  product: Product,
  settings: Pick<ReorderSettings, 'staleDays' | 'staleGracePeriodDays'>,
  now = new Date()
): SlowStockCalculation {
  const currentQty = fromMilli(product.currentQtyMilli);
  const trackingTime = new Date(product.trackingSince).getTime();
  const nowMs = now.getTime();
  const daysSinceAdded = Math.max(0, Math.floor((nowMs - trackingTime) / (1000 * 60 * 60 * 24)));
  const isInGracePeriod = daysSinceAdded < settings.staleGracePeriodDays;

  const isNeverSold = !product.lastSoldAt;
  const lastSaleDate = product.lastSoldAt ? new Date(product.lastSoldAt) : null;
  const daysSinceLastSale = lastSaleDate
    ? Math.max(0, Math.floor((nowMs - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  let isSlowMoving = false;
  let classificationReason = '';

  if (isNeverSold) {
    if (isInGracePeriod) {
      isSlowMoving = false;
      classificationReason = `New item added ${daysSinceAdded}d ago (in ${settings.staleGracePeriodDays}d grace period)`;
    } else {
      isSlowMoving = true;
      classificationReason = `Never sold — added ${daysSinceAdded} days ago (exceeds ${settings.staleGracePeriodDays}-day grace period)`;
    }
  } else if (daysSinceLastSale !== null) {
    if (daysSinceLastSale >= settings.staleDays) {
      isSlowMoving = true;
      classificationReason = `No sales in ${daysSinceLastSale} days (exceeds ${settings.staleDays}-day threshold)`;
    } else {
      isSlowMoving = false;
      classificationReason = `Sold recently (${daysSinceLastSale} days ago)`;
    }
  }

  const stockValue =
    product.purchaseCost !== undefined ? product.purchaseCost * currentQty : undefined;

  const isReviewed = Boolean(product.staleReviewedAt);
  const reviewedAt = product.staleReviewedAt ? new Date(product.staleReviewedAt) : undefined;

  return {
    product,
    currentQty,
    daysSinceAdded,
    isInGracePeriod,
    isNeverSold,
    lastSaleDate,
    daysSinceLastSale,
    isSlowMoving,
    classificationReason,
    stockValue,
    isReviewed,
    reviewedAt,
  };
}

/**
 * Formats CSV rows safely escaping commas and quotes.
 */
function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export interface RestockExportRow {
  name: string;
  nameHindi?: string;
  category: string;
  currentStock: number;
  unit: string;
  minStock: number;
  avgDailySales: string;
  daysRemaining: string;
  suggestedOrder: number;
  supplier: string;
  orderStatus: string;
  orderedDate?: string;
}

/**
 * Builds standard CSV content for the low stock reorder list.
 */
export function exportReorderToCSV(rows: RestockExportRow[]): string {
  const headers = [
    'Product Name',
    'Hindi Name',
    'Category',
    'Current Stock',
    'Unit',
    'Min Stock Level',
    'Avg Daily Sales',
    'Days Stock Left',
    'Suggested Order Qty',
    'Supplier',
    'Order Status',
    'Ordered Date',
  ];

  const lines = [headers.map(escapeCSV).join(',')];

  for (const r of rows) {
    lines.push(
      [
        r.name,
        r.nameHindi || '',
        r.category,
        r.currentStock,
        r.unit,
        r.minStock,
        r.avgDailySales,
        r.daysRemaining,
        r.suggestedOrder,
        r.supplier,
        r.orderStatus,
        r.orderedDate || '',
      ]
        .map(escapeCSV)
        .join(',')
    );
  }

  return lines.join('\r\n');
}

/**
 * Builds clean plain-text summary suitable for Kirana shopkeepers sharing on WhatsApp or SMS.
 */
export function formatReorderTextSummary(
  shopName: string,
  rows: RestockExportRow[]
): string {
  const dateStr = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  const lines: string[] = [
    `📦 *${shopName} — Reorder List (${dateStr})*`,
    `Total items to restock: ${rows.length}`,
    '----------------------------------------',
  ];

  rows.forEach((r, idx) => {
    const hindi = r.nameHindi ? ` (${r.nameHindi})` : '';
    const supplier = r.supplier && r.supplier !== 'Not specified' ? ` [${r.supplier}]` : '';
    lines.push(
      `${idx + 1}. *${r.name}*${hindi}${supplier}\n   Stock: ${r.currentStock} ${r.unit} | Order: *${r.suggestedOrder} ${r.unit}*`
    );
  });

  lines.push('----------------------------------------');
  lines.push('Generated via Refillo Kirana Management');
  return lines.join('\n');
}
