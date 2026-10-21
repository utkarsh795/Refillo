/**
 * Demo seed data for Refillo.
 * Only runs when the products table is empty (first-ever launch).
 */

import { db, newProduct, type Product } from './schema';
import { setOpeningStock } from './transactions';
import { toMilli } from '../lib/quantity';
import { v4 as uuidv4 } from 'uuid';

const DEMO_PRODUCTS = [
  {
    name: 'Tata Salt',
    nameHindi: 'टाटा नमक',
    category: 'Staples',
    unit: 'packet' as const,
    purchaseCost: 20,
    sellingPrice: 24,
    lowStockThresholdMilli: toMilli(5),
    openingQty: 18,
    supplierName: 'Tata Consumer Products',
    daysAgoAdded: 60,
  },
  {
    name: 'Aashirvaad Atta 5kg',
    nameHindi: 'आशीर्वाद आटा',
    category: 'Staples',
    unit: 'packet' as const,
    purchaseCost: 215,
    sellingPrice: 240,
    lowStockThresholdMilli: toMilli(3),
    openingQty: 8,
    supplierName: 'ITC Limited',
    daysAgoAdded: 45,
  },
  {
    name: 'Amul Butter 100g',
    nameHindi: 'अमूल मक्खन',
    category: 'Dairy',
    unit: 'piece' as const,
    purchaseCost: 52,
    sellingPrice: 58,
    lowStockThresholdMilli: toMilli(4),
    openingQty: 10,
    supplierName: 'Amul Dairy Dist.',
    daysAgoAdded: 30,
  },
  {
    name: 'Surf Excel 1kg',
    nameHindi: 'सर्फ एक्सेल',
    category: 'Household',
    unit: 'packet' as const,
    purchaseCost: 175,
    sellingPrice: 195,
    lowStockThresholdMilli: toMilli(2),
    openingQty: 2, // Low stock: 2 <= 2
    supplierName: 'Hindustan Unilever',
    daysAgoAdded: 50,
    soldDaysAgo: 42, // Last sold 42 days ago -> Dead stock (> 30 days)
  },
  {
    name: 'Parle-G Biscuits',
    nameHindi: 'पारले-जी',
    category: 'Snacks',
    unit: 'packet' as const,
    purchaseCost: 5,
    sellingPrice: 6,
    lowStockThresholdMilli: toMilli(10),
    openingQty: 8, // Low stock: 8 <= 10 packets
    supplierName: 'Parle Agency',
    daysAgoAdded: 40,
    hasSalesHistory: true, // 5 packets/day sold over recent days
  },
  {
    name: 'Tata Tea Premium 250g',
    nameHindi: 'टाटा चाय',
    category: 'Beverages',
    unit: 'packet' as const,
    purchaseCost: 85,
    sellingPrice: 98,
    lowStockThresholdMilli: toMilli(3),
    openingQty: 6,
    supplierName: 'Tata Consumer Products',
    daysAgoAdded: 40,
    soldDaysAgo: 2,
  },
  {
    name: 'Maggi Noodles',
    nameHindi: 'मैगी',
    category: 'Snacks',
    unit: 'packet' as const,
    purchaseCost: 14,
    sellingPrice: 16,
    lowStockThresholdMilli: toMilli(5),
    openingQty: 24,
    supplierName: 'Nestle India',
    daysAgoAdded: 25,
    soldDaysAgo: 1,
  },
  {
    name: 'Refined Sunflower Oil 1L',
    nameHindi: 'सनफ्लावर तेल',
    category: 'Staples',
    unit: 'litre' as const,
    purchaseCost: 130,
    sellingPrice: 148,
    lowStockThresholdMilli: toMilli(2),
    openingQty: 4,
    supplierName: 'Fortune Agro',
    daysAgoAdded: 38, // Added 38 days ago, NEVER sold -> Dead stock (exceeds 14d grace period)
  },
  {
    name: 'Dettol Soap',
    nameHindi: 'डेटॉल साबुन',
    category: 'Household',
    unit: 'piece' as const,
    purchaseCost: 40,
    sellingPrice: 48,
    lowStockThresholdMilli: toMilli(3),
    openingQty: 1, // Low stock: 1 <= 3 pieces (NO sales history -> uses fallback)
    supplierName: 'Reckitt Benckiser Dist.',
    daysAgoAdded: 20,
  },
  {
    name: 'Colgate Toothpaste 100g',
    nameHindi: 'कोलगेट',
    category: 'Personal Care',
    unit: 'piece' as const,
    purchaseCost: 58,
    sellingPrice: 68,
    lowStockThresholdMilli: toMilli(2),
    openingQty: 5,
    supplierName: 'Colgate-Palmolive',
    daysAgoAdded: 4, // Newly added 4 days ago, never sold -> PROTECTED by 14d grace period!
  },
];

export async function seedDemoData(): Promise<void> {
  // Ensure default settings are present
  const defaultSettings = [
    { key: 'shopName', value: 'Sharma General Store' },
    { key: 'staleDays', value: 30 },
    { key: 'staleGracePeriodDays', value: 14 },
    { key: 'supplierLeadTimeDays', value: 3 },
    { key: 'safetyStockDays', value: 7 },
    { key: 'defaultLowStockThreshold', value: 5 },
    { key: 'categories', value: ['Staples', 'Dairy', 'Snacks', 'Beverages', 'Household', 'Personal Care', 'Other'] },
  ];

  for (const s of defaultSettings) {
    const existing = await db.settings.get(s.key);
    if (!existing) {
      await db.settings.put(s);
    }
  }

  const count = await db.products.count();
  if (count > 0) return; // already seeded products

  const now = new Date();

  for (const p of DEMO_PRODUCTS) {
    const { openingQty, daysAgoAdded, soldDaysAgo, hasSalesHistory, ...productFields } = p;
    const trackingSince = new Date(now.getTime() - (daysAgoAdded ?? 30) * 86400000);

    let lastSoldAt: Date | undefined = undefined;
    if (soldDaysAgo !== undefined) {
      lastSoldAt = new Date(now.getTime() - soldDaysAgo * 86400000);
    } else if (hasSalesHistory) {
      lastSoldAt = new Date(now.getTime() - 86400000); // sold yesterday
    }

    const product: Product = {
      ...newProduct(productFields),
      trackingSince,
      lastSoldAt,
    };

    await db.products.add(product);

    if (openingQty > 0) {
      await setOpeningStock(product.id, toMilli(openingQty));
    }

    // If item has sales history, seed sample historical sale movements
    if (hasSalesHistory) {
      // 5 packets/day over past 6 days = 30 packets sold
      const days = [6, 5, 4, 3, 2, 1];
      for (const d of days) {
        const saleTime = new Date(now.getTime() - d * 86400000 + 36000000);
        await db.stockMovements.add({
          id: uuidv4(),
          productId: product.id,
          type: 'sale',
          deltaQtyMilli: -toMilli(5),
          createdAt: saleTime,
          note: 'Daily customer sales',
        });
      }
    } else if (soldDaysAgo !== undefined) {
      const saleTime = new Date(now.getTime() - soldDaysAgo * 86400000);
      await db.stockMovements.add({
        id: uuidv4(),
        productId: product.id,
        type: 'sale',
        deltaQtyMilli: -toMilli(1),
        createdAt: saleTime,
        note: 'Customer sale',
      });
    }
  }
}
