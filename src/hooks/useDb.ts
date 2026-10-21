/**
 * useLiveQuery hooks — reactive wrappers around Dexie for all core entities.
 * Components that use these hooks re-render automatically when DB changes.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';

// ─── Products ─────────────────────────────────────────────────────────────────

export function useProducts(searchTerm = '', category = '') {
  return useLiveQuery(async () => {
    let query = db.products.where('isActive').equals(1);
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

// ─── Reorder Drafts ───────────────────────────────────────────────────────────

export function useReorderDrafts(status?: string) {
  return useLiveQuery(async () => {
    const all = status
      ? await db.reorderDrafts.where('status').equals(status).toArray()
      : await db.reorderDrafts.toArray();
    return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [status]);
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
  return useSetting<string>('shopName', 'My Kirana Store');
}

export function useStaleDays(): number {
  return useSetting<number>('staleDays', 30);
}
