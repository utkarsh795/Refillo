/**
 * Demo seed data for Refillo.
 * Only runs when the products table is empty (first-ever launch).
 */

import { db, newProduct } from './schema';
import { setOpeningStock } from './transactions';
import { toMilli } from '../lib/quantity';

const DEMO_PRODUCTS = [
  { name: 'Tata Salt', nameHindi: 'टाटा नमक', category: 'Staples', unit: 'packet' as const, purchaseCost: 20, sellingPrice: 24, lowStockThresholdMilli: toMilli(5), openingQty: 18 },
  { name: 'Aashirvaad Atta 5kg', nameHindi: 'आशीर्वाद आटा', category: 'Staples', unit: 'packet' as const, purchaseCost: 215, sellingPrice: 240, lowStockThresholdMilli: toMilli(3), openingQty: 8 },
  { name: 'Amul Butter 100g', nameHindi: 'अमूल मक्खन', category: 'Dairy', unit: 'piece' as const, purchaseCost: 52, sellingPrice: 58, lowStockThresholdMilli: toMilli(4), openingQty: 10 },
  { name: 'Surf Excel 1kg', nameHindi: 'सर्फ एक्सेल', category: 'Household', unit: 'packet' as const, purchaseCost: 175, sellingPrice: 195, lowStockThresholdMilli: toMilli(2), openingQty: 2 },
  { name: 'Parle-G Biscuits', nameHindi: 'पारले-जी', category: 'Snacks', unit: 'packet' as const, purchaseCost: 5, sellingPrice: 6, lowStockThresholdMilli: toMilli(10), openingQty: 30 },
  { name: 'Tata Tea Premium 250g', nameHindi: 'टाटा चाय', category: 'Beverages', unit: 'packet' as const, purchaseCost: 85, sellingPrice: 98, lowStockThresholdMilli: toMilli(3), openingQty: 6 },
  { name: 'Maggi Noodles', nameHindi: 'मैगी', category: 'Snacks', unit: 'packet' as const, purchaseCost: 14, sellingPrice: 16, lowStockThresholdMilli: toMilli(5), openingQty: 24 },
  { name: 'Refined Sunflower Oil 1L', nameHindi: 'सनफ्लावर तेल', category: 'Staples', unit: 'litre' as const, purchaseCost: 130, sellingPrice: 148, lowStockThresholdMilli: toMilli(2), openingQty: 4 },
  { name: 'Dettol Soap', nameHindi: 'डेटॉल साबुन', category: 'Household', unit: 'piece' as const, purchaseCost: 40, sellingPrice: 48, lowStockThresholdMilli: toMilli(3), openingQty: 1 },  // low stock!
  { name: 'Colgate Toothpaste 100g', nameHindi: 'कोलगेट', category: 'Personal Care', unit: 'piece' as const, purchaseCost: 58, sellingPrice: 68, lowStockThresholdMilli: toMilli(2), openingQty: 5 },
];

export async function seedDemoData(): Promise<void> {
  const count = await db.products.count();
  if (count > 0) return; // already seeded

  // Default settings
  await db.settings.bulkPut([
    { key: 'shopName', value: 'Sharma General Store' },
    { key: 'staleDays', value: 30 },
    { key: 'defaultLowStockThreshold', value: 5 },
    { key: 'categories', value: ['Staples', 'Dairy', 'Snacks', 'Beverages', 'Household', 'Personal Care', 'Other'] },
  ]);

  for (const p of DEMO_PRODUCTS) {
    const { openingQty, ...productFields } = p;
    const product = newProduct(productFields);
    await db.products.add(product);
    if (openingQty > 0) {
      await setOpeningStock(product.id, toMilli(openingQty));
    }
  }
}
