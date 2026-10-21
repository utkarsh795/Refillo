/**
 * useLiveQuery hooks — reactive wrappers around Dexie for all core entities.
 * Components that use these hooks re-render automatically when DB changes.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Product, type StockMovement, type ReorderDraft } from '../db/schema';
import { DEFAULT_REORDER_SETTINGS, type ReorderSettings } from '../lib/reorderCalculations';
import { fromMilli } from '../lib/quantity';

// ─── Products ─────────────────────────────────────────────────────────────────

export function useProducts(searchTerm = '', category = '') {
  return useLiveQuery(async () => {
    const query = db.products.where('isActive').equals(1);
    const all = await query.toArray();
    return all
      .filter((p) => {
        const matchSearch =
          !searchTerm ||
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.nameHindi && p.nameHindi.includes(searchTerm));
        const matchCategory = !category || p.category === category;
        return matchSearch && matchCategory;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [searchTerm, category]);
}

export function useProduct(id: string | undefined) {
  return useLiveQuery(() => (id ? db.products.get(id) : undefined), [id]);
}

export function useLowStockProducts() {
  return useLiveQuery(async () => {
    const all = await db.products.where('isActive').equals(1).toArray();
    return all.filter((p) => p.currentQtyMilli <= p.lowStockThresholdMilli);
  });
}

export function useStaleProducts(staleDays: number) {
  return useLiveQuery(async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - staleDays);

    const all = await db.products.where('isActive').equals(1).toArray();
    return all.filter(
      (p) => !p.lastSoldAt || p.lastSoldAt < cutoff
    );
  }, [staleDays]);
}

// ─── Inventory Health Metrics ─────────────────────────────────────────────────

export interface InventoryMetrics {
  totalCount: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalStockValue: number;
}

export function useInventoryMetrics(): InventoryMetrics | undefined {
  return useLiveQuery(async () => {
    const products = await db.products.where('isActive').equals(1).toArray();
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let totalValue = 0;

    for (const p of products) {
      if (p.currentQtyMilli <= 0) {
        outOfStock++;
      } else if (p.currentQtyMilli <= p.lowStockThresholdMilli) {
        lowStock++;
      } else {
        inStock++;
      }

      if (p.purchaseCost && p.currentQtyMilli > 0) {
        totalValue += p.purchaseCost * fromMilli(p.currentQtyMilli);
      }
    }

    return {
      totalCount: products.length,
      inStockCount: inStock,
      lowStockCount: lowStock,
      outOfStockCount: outOfStock,
      totalStockValue: totalValue,
    };
  });
}

// ─── Stock Movements ──────────────────────────────────────────────────────────

export function useProductMovements(productId: string | undefined, limit = 20) {
  return useLiveQuery(async () => {
    if (!productId) return [];
    return db.stockMovements
      .where('productId')
      .equals(productId)
      .reverse()
      .limit(limit)
      .toArray();
  }, [productId, limit]);
}

// ─── Sale Transactions ────────────────────────────────────────────────────────

export function useRecentSales(limit = 10) {
  return useLiveQuery(() =>
    db.saleTxns.orderBy('createdAt').reverse().limit(limit).toArray()
  );
}

export function useAllSales() {
  return useLiveQuery(() =>
    db.saleTxns.orderBy('createdAt').reverse().toArray()
  );
}

export function useTodaySalesTotal() {
  return useLiveQuery(async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const sales = await db.saleTxns
      .where('createdAt')
      .aboveOrEqual(start)
      .toArray();
    return sales.reduce((sum, s) => sum + (s.totalAmount ?? 0), 0);
  });
}

// ─── Reports & Analytics Data ─────────────────────────────────────────────────

export interface DailySalesBar {
  dayLabel: string;
  dateStr: string;
  revenue: number;
  txnCount: number;
}

export interface TopSellingItem {
  productId: string;
  name: string;
  unitsSold: number;
  revenue: number;
  category: string;
}

export interface CategorySummary {
  category: string;
  productCount: number;
  stockValue: number;
}

export interface ReportsData {
  last7Days: DailySalesBar[];
  totalRevenueToDate: number;
  topProducts: TopSellingItem[];
  categorySummaries: CategorySummary[];
}

export function useReportsData(): ReportsData | undefined {
  return useLiveQuery(async () => {
    const sales = await db.saleTxns.toArray();
    const products = await db.products.where('isActive').equals(1).toArray();
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 1. Build last 7 days buckets
    const now = new Date();
    const days: DailySalesBar[] = [];
    const dayMap = new Map<string, DailySalesBar>();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const dayLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(d);
      const entry: DailySalesBar = { dayLabel, dateStr: key, revenue: 0, txnCount: 0 };
      days.push(entry);
      dayMap.set(key, entry);
    }

    let totalRevenueToDate = 0;
    const prodSalesMap = new Map<string, { unitsSoldMilli: number; revenue: number }>();

    for (const s of sales) {
      const rev = s.totalAmount ?? 0;
      totalRevenueToDate += rev;

      const dateKey = new Date(s.createdAt).toISOString().split('T')[0];
      const bar = dayMap.get(dateKey);
      if (bar) {
        bar.revenue += rev;
        bar.txnCount += 1;
      }

      for (const item of s.items) {
        const existing = prodSalesMap.get(item.productId) ?? { unitsSoldMilli: 0, revenue: 0 };
        existing.unitsSoldMilli += item.qtyMilli;
        existing.revenue += (item.sellingPrice ?? 0) * fromMilli(item.qtyMilli);
        prodSalesMap.set(item.productId, existing);
      }
    }

    // Top products
    const topProducts: TopSellingItem[] = Array.from(prodSalesMap.entries())
      .map(([id, data]) => {
        const p = productMap.get(id);
        return {
          productId: id,
          name: p?.name ?? 'Unknown Item',
          unitsSold: fromMilli(data.unitsSoldMilli),
          revenue: data.revenue,
          category: p?.category ?? 'Other',
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Category breakdown
    const catMap = new Map<string, CategorySummary>();
    for (const p of products) {
      const c = catMap.get(p.category) ?? { category: p.category, productCount: 0, stockValue: 0 };
      c.productCount++;
      if (p.purchaseCost && p.currentQtyMilli > 0) {
        c.stockValue += p.purchaseCost * fromMilli(p.currentQtyMilli);
      }
      catMap.set(p.category, c);
    }

    return {
      last7Days: days,
      totalRevenueToDate,
      topProducts,
      categorySummaries: Array.from(catMap.values()),
    };
  });
}

// ─── Reorder Drafts ───────────────────────────────────────────────────────────

export function useReorderDrafts(status?: string) {
  return useLiveQuery(async () => {
    const all = status
      ? await db.reorderDrafts.where('status').equals(status).toArray()
      : await db.reorderDrafts.toArray();
    return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [status]);
}

// ─── Reorder Sheet Composite Data ─────────────────────────────────────────────

export interface ReorderSheetData {
  products: Product[];
  saleMovements: StockMovement[];
  drafts: ReorderDraft[];
  settings: ReorderSettings;
}

export function useReorderSheetData(): ReorderSheetData | undefined {
  return useLiveQuery(async () => {
    const products = await db.products.where('isActive').equals(1).toArray();
    const saleMovements = await db.stockMovements.where('type').equals('sale').toArray();
    const drafts = await db.reorderDrafts.toArray();

    const allSettings = await db.settings.toArray();
    const settingsMap = Object.fromEntries(allSettings.map((s) => [s.key, s.value]));

    const settings: ReorderSettings = {
      leadTimeDays: Number(settingsMap.supplierLeadTimeDays ?? DEFAULT_REORDER_SETTINGS.leadTimeDays),
      safetyStockDays: Number(settingsMap.safetyStockDays ?? DEFAULT_REORDER_SETTINGS.safetyStockDays),
      staleDays: Number(settingsMap.staleDays ?? DEFAULT_REORDER_SETTINGS.staleDays),
      staleGracePeriodDays: Number(settingsMap.staleGracePeriodDays ?? DEFAULT_REORDER_SETTINGS.staleGracePeriodDays),
    };

    return {
      products,
      saleMovements,
      drafts,
      settings,
    };
  });
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function useSetting<T>(key: string, defaultValue: T): T {
  const result = useLiveQuery(
    () => db.settings.get(key),
    [key]
  );
  return result !== undefined ? (result.value as T) : defaultValue;
}

export function useCategories(): string[] {
  return useSetting<string[]>('categories', ['Staples', 'Snacks', 'Beverages', 'Dairy', 'Household', 'Personal Care', 'Other']);
}

export function useShopName(): string {
  return useSetting<string>('shopName', 'Sharma General Store');
}

export function useStaleDays(): number {
  return useSetting<number>('staleDays', 30);
}
