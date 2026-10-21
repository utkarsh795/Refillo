/**
 * Standalone verification tests for Refillo Reorder Sheet business logic.
 * Tests calculations for sales velocity, restock forecasting, fallback logic,
 * dead stock grace periods, and CSV generation.
 */

import assert from 'node:assert';
import {
  calculateRestockItem,
  calculateSlowStockItem,
  exportReorderToCSV,
  formatReorderTextSummary,
} from '../src/lib/reorderCalculations.ts';

const MS_PER_DAY = 86400000;
const now = new Date('2026-10-21T12:00:00Z');

console.log('🧪 Starting Reorder Sheet Business Logic Verification...\n');

// ─── Test 1: Restock Calculation with Sales History ──────────────────────────
{
  const product = {
    id: 'prod-parleg',
    name: 'Parle-G Biscuits',
    nameHindi: 'पारले-जी',
    category: 'Snacks',
    unit: 'packet',
    currentQtyMilli: 8000, // 8 packets (<= 10 min stock)
    lowStockThresholdMilli: 10000, // 10 packets
    trackingSince: new Date(now.getTime() - 6 * MS_PER_DAY),
    lastSoldAt: new Date(now.getTime() - 1 * MS_PER_DAY),
    supplierName: 'Parle Agency',
    leadTimeDays: 3,
    isActive: true,
  };

  // 6 sales movements: 5 packets sold per day over 6 days = 30 packets total
  const movements = [
    { id: '1', productId: 'prod-parleg', type: 'sale', deltaQtyMilli: -5000, createdAt: new Date(now.getTime() - 6 * MS_PER_DAY) },
    { id: '2', productId: 'prod-parleg', type: 'sale', deltaQtyMilli: -5000, createdAt: new Date(now.getTime() - 5 * MS_PER_DAY) },
    { id: '3', productId: 'prod-parleg', type: 'sale', deltaQtyMilli: -5000, createdAt: new Date(now.getTime() - 4 * MS_PER_DAY) },
    { id: '4', productId: 'prod-parleg', type: 'sale', deltaQtyMilli: -5000, createdAt: new Date(now.getTime() - 3 * MS_PER_DAY) },
    { id: '5', productId: 'prod-parleg', type: 'sale', deltaQtyMilli: -5000, createdAt: new Date(now.getTime() - 2 * MS_PER_DAY) },
    { id: '6', productId: 'prod-parleg', type: 'sale', deltaQtyMilli: -5000, createdAt: new Date(now.getTime() - 1 * MS_PER_DAY) },
  ];

  const calc = calculateRestockItem(product, movements, { leadTimeDays: 3, safetyStockDays: 7 }, now);

  assert.strictEqual(calc.isLowStock, true, 'Product should be marked low stock');
  assert.strictEqual(calc.salesStats.hasSalesHistory, true, 'Product should have sales history');
  assert.strictEqual(calc.salesStats.avgDailySalesMilli, 5000, 'Avg daily sales should be 5 packets (5000 milli)');
  assert.strictEqual(calc.currentQty, 8, 'Current qty should be 8');
  assert.strictEqual(calc.minStockQty, 10, 'Min stock should be 10');

  // Days remaining: 8000 / 5000 = 1.6 days
  assert.strictEqual(calc.daysRemaining, 1.6, 'Days remaining should be 1.6 days');

  // Buffer days = 3 + 7 = 10 days
  // Target buffer = 5000 * 10 = 50,000 milli (50 packets)
  // Target stock = max(10,000, 50,000) = 50,000
  // Deficit = 50,000 - 8,000 = 42,000 milli = 42 packets
  assert.strictEqual(calc.suggestedQty, 42, 'Suggested order quantity should be 42 packets');
  assert.strictEqual(calc.calculationMethod, 'history', 'Calculation method should be history');
  assert.ok(calc.explanation.includes('Based on sales history'), 'Explanation should state sales history');
  assert.strictEqual(calc.supplierName, 'Parle Agency', 'Supplier name should match');

  console.log('✅ Test 1 Passed: Sales velocity and buffer-based restock calculations correct.');
}

// ─── Test 2: Fallback Restock Calculation (No Sales History) ─────────────────
{
  const product = {
    id: 'prod-dettol',
    name: 'Dettol Soap',
    nameHindi: 'डेटॉल साबुन',
    category: 'Household',
    unit: 'piece',
    currentQtyMilli: 1000, // 1 piece (<= 3 min stock)
    lowStockThresholdMilli: 3000, // 3 pieces
    trackingSince: new Date(now.getTime() - 20 * MS_PER_DAY),
    isActive: true,
  };

  const movements = []; // Zero sales

  const calc = calculateRestockItem(product, movements, { leadTimeDays: 3, safetyStockDays: 7 }, now);

  assert.strictEqual(calc.isLowStock, true, 'Product should be low stock');
  assert.strictEqual(calc.salesStats.hasSalesHistory, false, 'Product should not have sales history');
  assert.strictEqual(calc.daysRemaining, null, 'Days remaining should be null when no sales velocity');
  assert.strictEqual(calc.calculationMethod, 'fallback', 'Calculation method should be fallback');

  // Fallback: 3 × min stock (3 × 3000 = 9000) - current stock (1000) = 8000 milli = 8 pieces
  assert.strictEqual(calc.suggestedQty, 8, 'Fallback suggested order should be 8 pieces');
  assert.ok(calc.explanation.includes('Fallback'), 'Explanation should clearly label fallback');
  assert.ok(!calc.explanation.includes('/day'), 'Must not invent sales history');

  console.log('✅ Test 2 Passed: Transparent fallback without invented sales history.');
}

// ─── Test 3: Dead Stock Grace Period Rule ────────────────────────────────────
{
  // Newly added product: created 5 days ago, NO sales yet
  const newProduct = {
    id: 'prod-colgate',
    name: 'Colgate Toothpaste',
    category: 'Personal Care',
    unit: 'piece',
    currentQtyMilli: 5000,
    lowStockThresholdMilli: 2000,
    trackingSince: new Date(now.getTime() - 5 * MS_PER_DAY), // 5 days old
    isActive: true,
  };

  const settings = { staleDays: 30, staleGracePeriodDays: 14 };
  const calcNew = calculateSlowStockItem(newProduct, settings, now);

  assert.strictEqual(calcNew.isInGracePeriod, true, 'Product should be within 14-day grace period');
  assert.strictEqual(calcNew.isNeverSold, true, 'Product has never sold');
  assert.strictEqual(calcNew.isSlowMoving, false, 'Newly added product MUST NOT be flagged as dead stock');

  console.log('✅ Test 3 Passed: Newly added products protected by grace period.');
}

// ─── Test 4: Slow Moving & Never Sold Classification ─────────────────────────
{
  const settings = { staleDays: 30, staleGracePeriodDays: 14 };

  // Product A: Added 35 days ago, never sold -> Dead stock!
  const deadProduct = {
    id: 'prod-oil',
    name: 'Refined Sunflower Oil 1L',
    category: 'Staples',
    unit: 'litre',
    currentQtyMilli: 4000,
    lowStockThresholdMilli: 2000,
    purchaseCost: 130,
    trackingSince: new Date(now.getTime() - 35 * MS_PER_DAY),
    isActive: true,
  };

  const calcDead = calculateSlowStockItem(deadProduct, settings, now);
  assert.strictEqual(calcDead.isSlowMoving, true, 'Item added 35 days ago with no sales should be dead stock');
  assert.strictEqual(calcDead.isNeverSold, true, 'Item should be marked never sold');
  assert.strictEqual(calcDead.stockValue, 4 * 130, 'Stock value tied up should be 4 × 130 = ₹520');

  // Product B: Sold 42 days ago (> 30 days) -> Slow moving!
  const slowProduct = {
    id: 'prod-surf',
    name: 'Surf Excel 1kg',
    category: 'Household',
    unit: 'packet',
    currentQtyMilli: 2000,
    lowStockThresholdMilli: 2000,
    purchaseCost: 175,
    trackingSince: new Date(now.getTime() - 60 * MS_PER_DAY),
    lastSoldAt: new Date(now.getTime() - 42 * MS_PER_DAY),
    isActive: true,
  };

  const calcSlow = calculateSlowStockItem(slowProduct, settings, now);
  assert.strictEqual(calcSlow.isSlowMoving, true, 'Item not sold for 42 days should be slow moving');
  assert.strictEqual(calcSlow.isNeverSold, false, 'Item has sold before');
  assert.strictEqual(calcSlow.daysSinceLastSale, 42, 'Days since last sale should be 42');
  assert.strictEqual(calcSlow.stockValue, 2 * 175, 'Stock value tied up should be 2 × 175 = ₹350');

  // Product C: Sold 5 days ago (<= 30 days) -> Active, not slow!
  const activeProduct = {
    id: 'prod-tea',
    name: 'Tata Tea 250g',
    category: 'Beverages',
    unit: 'packet',
    currentQtyMilli: 6000,
    lowStockThresholdMilli: 3000,
    trackingSince: new Date(now.getTime() - 60 * MS_PER_DAY),
    lastSoldAt: new Date(now.getTime() - 5 * MS_PER_DAY),
    isActive: true,
  };

  const calcActive = calculateSlowStockItem(activeProduct, settings, now);
  assert.strictEqual(calcActive.isSlowMoving, false, 'Recently sold item is NOT slow moving');

  console.log('✅ Test 4 Passed: Slow moving and never sold distinction verified.');
}

// ─── Test 5: CSV and Plain-Text Export ─────────────────────────────────────────
{
  const sampleExportRows = [
    {
      name: 'Parle-G Biscuits',
      nameHindi: 'पारले-जी',
      category: 'Snacks',
      currentStock: 8,
      unit: 'packet',
      minStock: 10,
      avgDailySales: '5.0 packet/day',
      daysRemaining: '1.6 days',
      suggestedOrder: 42,
      supplier: 'Parle Agency',
      orderStatus: 'Needs Order',
    },
  ];

  const csv = exportReorderToCSV(sampleExportRows);
  assert.ok(csv.includes('"Parle-G Biscuits"'), 'CSV should contain product name');
  assert.ok(csv.includes('"पारले-जी"'), 'CSV should contain Hindi name');
  assert.ok(csv.includes('"42"'), 'CSV should contain suggested order');
  assert.ok(csv.includes('"Parle Agency"'), 'CSV should contain supplier');

  const textSummary = formatReorderTextSummary('Sharma Store', sampleExportRows);
  assert.ok(textSummary.includes('Sharma Store'), 'Text summary should contain shop name');
  assert.ok(textSummary.includes('*Parle-G Biscuits*'), 'Text summary should contain bold product name');
  assert.ok(textSummary.includes('Order: *42 packet*'), 'Text summary should contain order qty');

  console.log('✅ Test 5 Passed: CSV and text exports formatted properly.');
}

console.log('\n🎉 ALL REORDER SHEET TESTS PASSED SUCCESSFULLY!\n');
