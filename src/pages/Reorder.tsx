import React, { useState, useMemo } from 'react';
import { useReorderSheetData, useShopName, useCategories } from '../hooks/useDb';
import { db, type Product, type ReorderDraft } from '../db/schema';
import { UNIT_LABELS, fromMilli, toMilli } from '../lib/quantity';
import {
  calculateRestockItem,
  calculateSlowStockItem,
  exportReorderToCSV,
  formatReorderTextSummary,
  type RestockCalculation,
  type SlowStockCalculation,
  type RestockExportRow,
} from '../lib/reorderCalculations';
import { BottomSheet } from '../components/ui/BottomSheet';
import { StockInSheet } from '../components/features/StockInSheet';
import { useToast } from '../components/ui/Toast';
import {
  Clock,
  CheckCircle,
  Download,
  Copy,
  Plus,
  Minus,
  Search,
  ShoppingCart,
  Check,
  Undo2,
  Info,
  AlertTriangle,
  PackageCheck,
  Flame,
  ClipboardList,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

type TabSection = 'runningLow' | 'notMoving';
type OrderFilter = 'all' | 'needsOrder' | 'ordered';
type ReviewFilter = 'all' | 'unreviewed' | 'reviewed';

export function Reorder() {
  const { toast } = useToast();
  const shopName = useShopName();
  const categories = useCategories();
  const sheetData = useReorderSheetData();

  const [activeTab, setActiveTab] = useState<TabSection>('runningLow');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');

  // Multi-select for batch actions
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // Edited suggested order quantities { [productId]: quantityNumber }
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});

  // StockIn modal state for receiving items
  const [stockInProduct, setStockInProduct] = useState<Product | null>(null);
  const [isStockInOpen, setIsStockInOpen] = useState(false);

  const now = useMemo(() => new Date(), []);

  // Compute restock calculations for all products
  const restockCalculations = useMemo<RestockCalculation[]>(() => {
    if (!sheetData) return [];
    const { products, saleMovements, settings } = sheetData;

    return products
      .filter((p) => p.currentQtyMilli <= p.lowStockThresholdMilli)
      .map((p) => {
        const prodMovements = saleMovements.filter((m) => m.productId === p.id);
        return calculateRestockItem(p, prodMovements, settings, now);
      });
  }, [sheetData, now]);

  // Priority count categories
  const priorityStats = useMemo(() => {
    if (!sheetData) return { urgent: 0, soon: 0, healthy: 0 };
    const { products } = sheetData;
    let urgent = 0;
    let soon = 0;
    let healthy = 0;

    for (const p of products) {
      if (p.currentQtyMilli <= 0 || p.currentQtyMilli <= p.lowStockThresholdMilli * 0.5) {
        urgent++;
      } else if (p.currentQtyMilli <= p.lowStockThresholdMilli) {
        soon++;
      } else {
        healthy++;
      }
    }
    return { urgent, soon, healthy };
  }, [sheetData]);

  // Compute slow/dead stock calculations for all products
  const slowStockCalculations = useMemo<SlowStockCalculation[]>(() => {
    if (!sheetData) return [];
    const { products, settings } = sheetData;

    return products
      .map((p) => calculateSlowStockItem(p, settings, now))
      .filter((calc) => calc.isSlowMoving);
  }, [sheetData, now]);

  // Map of active drafts by productId
  const draftMap = useMemo(() => {
    if (!sheetData) return new Map<string, ReorderDraft>();
    const map = new Map<string, ReorderDraft>();
    for (const d of sheetData.drafts) {
      if (d.status !== 'received') {
        map.set(d.productId, d);
      }
    }
    return map;
  }, [sheetData]);

  // Filtered restock list
  const filteredRestock = useMemo(() => {
    return restockCalculations.filter((item) => {
      const p = item.product;
      const matchSearch =
        !searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.nameHindi && p.nameHindi.includes(searchTerm));
      const matchCategory = !categoryFilter || p.category === categoryFilter;

      const draft = draftMap.get(p.id);
      const isOrdered = draft?.status === 'ordered';

      let matchOrder = true;
      if (orderFilter === 'needsOrder') matchOrder = !isOrdered;
      if (orderFilter === 'ordered') matchOrder = isOrdered;

      return matchSearch && matchCategory && matchOrder;
    });
  }, [restockCalculations, searchTerm, categoryFilter, orderFilter, draftMap]);

  // Filtered slow stock list
  const filteredSlowStock = useMemo(() => {
    return slowStockCalculations.filter((item) => {
      const p = item.product;
      const matchSearch =
        !searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.nameHindi && p.nameHindi.includes(searchTerm));
      const matchCategory = !categoryFilter || p.category === categoryFilter;

      let matchReview = true;
      if (reviewFilter === 'unreviewed') matchReview = !item.isReviewed;
      if (reviewFilter === 'reviewed') matchReview = item.isReviewed;

      return matchSearch && matchCategory && matchReview;
    });
  }, [slowStockCalculations, searchTerm, categoryFilter, reviewFilter]);

  function getEffectiveQty(item: RestockCalculation): number {
    return customQuantities[item.product.id] ?? item.suggestedQty;
  }

  function handleQtyChange(productId: string, val: number, step = 1) {
    const updated = Math.max(step, val);
    setCustomQuantities((prev) => ({ ...prev, [productId]: updated }));
  }

  function toggleSelectProduct(productId: string) {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function selectAllFiltered() {
    if (selectedProductIds.size === filteredRestock.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredRestock.map((i) => i.product.id)));
    }
  }

  // Action: Mark single product as ordered
  async function handleMarkAsOrdered(calc: RestockCalculation) {
    const qtyNumber = getEffectiveQty(calc);
    const existingDraft = draftMap.get(calc.product.id);

    if (existingDraft) {
      await db.reorderDrafts.update(existingDraft.id, {
        status: 'ordered',
        orderedAt: new Date(),
        requestedQtyMilli: toMilli(qtyNumber),
      });
    } else {
      await db.reorderDrafts.add({
        id: uuidv4(),
        productId: calc.product.id,
        requestedQtyMilli: toMilli(qtyNumber),
        createdAt: new Date(),
        orderedAt: new Date(),
        status: 'ordered',
      });
    }

    toast(`Marked as ordered: ${calc.product.name} (${qtyNumber} ${UNIT_LABELS[calc.product.unit]})`, 'success');
  }

  // Action: Undo order status
  async function handleUndoOrder(productId: string) {
    const draft = draftMap.get(productId);
    if (draft) {
      await db.reorderDrafts.delete(draft.id);
      toast('Order status removed', 'info');
    }
  }

  // Action: Add single product to purchase list
  async function handleAddToPurchaseList(calc: RestockCalculation) {
    const qtyNumber = getEffectiveQty(calc);
    const existingDraft = draftMap.get(calc.product.id);

    if (existingDraft) {
      toast(`${calc.product.name} is already in the purchase list`, 'info');
      return;
    }

    await db.reorderDrafts.add({
      id: uuidv4(),
      productId: calc.product.id,
      requestedQtyMilli: toMilli(qtyNumber),
      createdAt: new Date(),
      status: 'pending',
    });

    toast(`${calc.product.name} added to purchase list`, 'success');
  }

  // Batch action: Prepare Purchase List
  async function handlePreparePurchaseList() {
    // If items selected, use selection; otherwise add all filtered needing order
    const targetItems = selectedProductIds.size > 0
      ? filteredRestock.filter((c) => selectedProductIds.has(c.product.id))
      : filteredRestock.filter((c) => draftMap.get(c.product.id)?.status !== 'ordered');

    if (targetItems.length === 0) {
      toast('All items are already in the purchase list or marked ordered', 'info');
      return;
    }

    let count = 0;
    for (const calc of targetItems) {
      const existing = draftMap.get(calc.product.id);
      if (!existing) {
        const qty = getEffectiveQty(calc);
        await db.reorderDrafts.add({
          id: uuidv4(),
          productId: calc.product.id,
          requestedQtyMilli: toMilli(qty),
          createdAt: new Date(),
          status: 'pending',
        });
        count++;
      }
    }

    setSelectedProductIds(new Set());
    toast(`Added ${count} products to your Purchase List!`, 'success');
  }

  // Batch action: Mark selected as ordered
  async function handleBatchMarkAsOrdered() {
    if (selectedProductIds.size === 0) return;

    const orderTime = new Date();
    let updatedCount = 0;

    for (const calc of restockCalculations) {
      if (selectedProductIds.has(calc.product.id)) {
        const qty = getEffectiveQty(calc);
        const existing = draftMap.get(calc.product.id);

        if (existing) {
          await db.reorderDrafts.update(existing.id, {
            status: 'ordered',
            orderedAt: orderTime,
            requestedQtyMilli: toMilli(qty),
          });
        } else {
          await db.reorderDrafts.add({
            id: uuidv4(),
            productId: calc.product.id,
            requestedQtyMilli: toMilli(qty),
            createdAt: orderTime,
            orderedAt: orderTime,
            status: 'ordered',
          });
        }
        updatedCount++;
      }
    }

    setSelectedProductIds(new Set());
    toast(`Marked ${updatedCount} products as ordered`, 'success');
  }

  // Action: Review toggle for slow items (persisted to Dexie)
  async function handleToggleReview(productId: string, currentReviewed: boolean) {
    if (currentReviewed) {
      await db.products.update(productId, { staleReviewedAt: undefined });
      toast('Item marked as unreviewed', 'info');
    } else {
      await db.products.update(productId, { staleReviewedAt: new Date() });
      toast('Item marked as reviewed', 'success');
    }
  }

  // Export to CSV
  function handleExportCSV() {
    const rows: RestockExportRow[] = filteredRestock.map((calc) => {
      const p = calc.product;
      const draft = draftMap.get(p.id);
      const isOrdered = draft?.status === 'ordered';
      const unit = UNIT_LABELS[p.unit] || p.unit;
      const orderQty = getEffectiveQty(calc);

      return {
        name: p.name,
        nameHindi: p.nameHindi,
        category: p.category,
        currentStock: calc.currentQty,
        unit,
        minStock: calc.minStockQty,
        avgDailySales: calc.salesStats.hasSalesHistory
          ? `${fromMilli(calc.salesStats.avgDailySalesMilli).toFixed(1)} ${unit}/day`
          : 'No sales history',
        daysRemaining:
          calc.daysRemaining !== null
            ? `${calc.daysRemaining.toFixed(1)} days`
            : 'Unknown',
        suggestedOrder: orderQty,
        supplier: p.supplierName || 'Not specified',
        orderStatus: isOrdered ? 'Ordered' : draft ? 'Draft' : 'Needs Order',
        orderedDate: draft?.orderedAt ? new Date(draft.orderedAt).toISOString().split('T')[0] : '',
      };
    });

    if (rows.length === 0) {
      toast('No items to export', 'info');
      return;
    }

    const csvData = exportReorderToCSV(rows);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kiranasaathi-reorder-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Reorder CSV downloaded!', 'success');
  }

  // Copy WhatsApp summary
  async function handleCopyList() {
    const rows: RestockExportRow[] = filteredRestock.map((calc) => {
      const p = calc.product;
      const draft = draftMap.get(p.id);
      const isOrdered = draft?.status === 'ordered';
      const unit = UNIT_LABELS[p.unit] || p.unit;
      const orderQty = getEffectiveQty(calc);

      return {
        name: p.name,
        nameHindi: p.nameHindi,
        category: p.category,
        currentStock: calc.currentQty,
        unit,
        minStock: calc.minStockQty,
        avgDailySales: calc.salesStats.hasSalesHistory
          ? `${fromMilli(calc.salesStats.avgDailySalesMilli).toFixed(1)} ${unit}/day`
          : 'None',
        daysRemaining:
          calc.daysRemaining !== null ? `${calc.daysRemaining.toFixed(1)} days` : 'N/A',
        suggestedOrder: orderQty,
        supplier: p.supplierName || 'Not specified',
        orderStatus: isOrdered ? 'Ordered' : draft ? 'Draft' : 'Needs Order',
      };
    });

    if (rows.length === 0) {
      toast('No items to copy', 'info');
      return;
    }

    const text = formatReorderTextSummary(shopName, rows);
    try {
      await navigator.clipboard.writeText(text);
      toast('Reorder summary copied to clipboard for WhatsApp!', 'success');
    } catch {
      toast('Unable to copy text', 'error');
    }
  }

  function openReceive(p: Product) {
    setStockInProduct(p);
    setIsStockInOpen(true);
  }

  function formatShortDate(date: Date): string {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(date));
  }

  return (
    <div className="page">
      {/* ════════════════════════════════════════════════════════════════════════
          SMART REORDER HEADER (Requirement 9)
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="page-header">
        <div>
          <h1 style={{ marginBottom: 2 }}>Smart Reorder</h1>
          <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--clr-text-2)' }}>
            Right stock. Right time. Less waste. (सही सामान, सही समय पर)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={handlePreparePurchaseList}
            title="Add low-stock items to purchase list"
          >
            <ClipboardList size={16} /> Prepare Purchase List
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem', padding: '8px 12px' }}
            onClick={handleCopyList}
          >
            <Copy size={15} /> Copy
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem', padding: '8px 12px' }}
            onClick={handleExportCSV}
          >
            <Download size={15} /> CSV
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          THREE PRIORITY SUMMARY CARDS (Requirement 9)
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="priority-summary-grid">
        <div className="priority-card p-urgent">
          <Flame size={26} />
          <div>
            <div className="priority-count">{priorityStats.urgent}</div>
            <div className="priority-label">Urgent (Stockout Risk)</div>
          </div>
        </div>

        <div className="priority-card p-soon">
          <AlertTriangle size={26} />
          <div>
            <div className="priority-count">{priorityStats.soon}</div>
            <div className="priority-label">Reorder Soon</div>
          </div>
        </div>

        <div className="priority-card p-healthy">
          <PackageCheck size={26} />
          <div>
            <div className="priority-count">{priorityStats.healthy}</div>
            <div className="priority-label">Healthy Stock</div>
          </div>
        </div>
      </div>

      {/* Tabs between Restock and Dead Stock */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'runningLow' ? 'active' : ''}`}
          onClick={() => setActiveTab('runningLow')}
        >
          Running Low — Need to Buy ({restockCalculations.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'notMoving' ? 'active' : ''}`}
          onClick={() => setActiveTab('notMoving')}
        >
          Not Moving — Check These ({slowStockCalculations.length})
        </button>
      </div>

      {/* Search & Category Filter */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) auto', gap: 10, marginBottom: 14 }}>
        <div className="search-bar" style={{ marginBottom: 0 }}>
          <Search size={16} />
          <input
            placeholder="Search product or हिंदी नाम…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{ background: 'none', border: 'none', color: 'var(--clr-text-3)', cursor: 'pointer', padding: 0 }}
            >
              ✕
            </button>
          )}
        </div>

        <select
          className="input"
          style={{ width: 'auto', minWidth: 140, padding: '8px 30px 8px 12px', fontSize: '0.85rem' }}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 1: RUNNING LOW — RESTOCK WORKING LIST
          ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'runningLow' && (
        <>
          {/* Sub-filters & Select All */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className={`tab-btn ${orderFilter === 'all' ? 'active' : ''}`}
                style={{ padding: '4px 10px', fontSize: '0.75rem', flex: 'none' }}
                onClick={() => setOrderFilter('all')}
              >
                All Low ({restockCalculations.length})
              </button>
              <button
                className={`tab-btn ${orderFilter === 'needsOrder' ? 'active' : ''}`}
                style={{ padding: '4px 10px', fontSize: '0.75rem', flex: 'none' }}
                onClick={() => setOrderFilter('needsOrder')}
              >
                Needs Order ({restockCalculations.filter((c) => draftMap.get(c.product.id)?.status !== 'ordered').length})
              </button>
              <button
                className={`tab-btn ${orderFilter === 'ordered' ? 'active' : ''}`}
                style={{ padding: '4px 10px', fontSize: '0.75rem', flex: 'none' }}
                onClick={() => setOrderFilter('ordered')}
              >
                Ordered ({restockCalculations.filter((c) => draftMap.get(c.product.id)?.status === 'ordered').length})
              </button>
            </div>

            {filteredRestock.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  className="reorder-checkbox"
                  checked={selectedProductIds.size > 0 && selectedProductIds.size === filteredRestock.length}
                  onChange={selectAllFiltered}
                />
                <span>Select All ({filteredRestock.length})</span>
              </label>
            )}
          </div>

          {/* Batch Bar */}
          {selectedProductIds.size > 0 && (
            <div className="batch-bar">
              <div>
                <strong>{selectedProductIds.size}</strong> product(s) selected
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  onClick={handlePreparePurchaseList}
                >
                  <ShoppingCart size={14} /> Add to Purchase List
                </button>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  onClick={handleBatchMarkAsOrdered}
                >
                  <Check size={14} /> Mark as Ordered
                </button>
              </div>
            </div>
          )}

          {/* Low Stock Items List */}
          {filteredRestock.length === 0 ? (
            <div className="empty-state">
              <CheckCircle size={44} color="var(--clr-primary)" />
              <h3>All stocked up! (स्टॉक पर्याप्त है)</h3>
              <p>
                {searchTerm || categoryFilter || orderFilter !== 'all'
                  ? 'No low-stock items match the selected filters.'
                  : 'No items are currently below their minimum stock threshold.'}
              </p>
            </div>
          ) : (
            filteredRestock.map((calc) => {
              const p = calc.product;
              const draft = draftMap.get(p.id);
              const isOrdered = draft?.status === 'ordered';
              const unit = UNIT_LABELS[p.unit] || p.unit;
              const step = p.unit === 'kg' || p.unit === 'litre' ? 0.5 : 1;
              const currentEffectiveQty = getEffectiveQty(calc);

              return (
                <div
                  key={p.id}
                  className={`reorder-item-card ${isOrdered ? 'is-ordered' : ''}`}
                >
                  <div className="reorder-item-row">
                    <input
                      type="checkbox"
                      className="reorder-checkbox"
                      checked={selectedProductIds.has(p.id)}
                      onChange={() => toggleSelectProduct(p.id)}
                    />

                    <div className="reorder-item-body">
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>
                            {p.name}
                            {p.nameHindi && (
                              <span style={{ fontSize: '0.82rem', color: 'var(--clr-text-3)', marginLeft: 8, fontWeight: 500 }}>
                                {p.nameHindi}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--clr-text-3)', marginTop: 2 }}>
                            {p.category} {p.supplierName ? `· Supplier: ${p.supplierName}` : '· Supplier not set'}
                          </div>
                        </div>

                        <div>
                          {isOrdered ? (
                            <span className="badge badge-green">
                              <Check size={12} /> Ordered
                              {draft?.orderedAt && ` (${formatShortDate(draft.orderedAt)})`}
                            </span>
                          ) : draft ? (
                            <span className="badge badge-yellow">In Purchase List</span>
                          ) : (
                            <span className="badge badge-peach">Restock Needed</span>
                          )}
                        </div>
                      </div>

                      {/* Plain Metrics Grid */}
                      <div className="reorder-metric-grid">
                        <div className="reorder-metric-item">
                          <span className="reorder-metric-label">Current Stock</span>
                          <span className="reorder-metric-val" style={{ color: 'var(--clr-peach-action)' }}>
                            {calc.currentQty} {unit}
                          </span>
                        </div>

                        <div className="reorder-metric-item">
                          <span className="reorder-metric-label">Min Stock Alert</span>
                          <span className="reorder-metric-val">
                            {calc.minStockQty} {unit}
                          </span>
                        </div>

                        <div className="reorder-metric-item">
                          <span className="reorder-metric-label">Avg Daily Sales</span>
                          <span className="reorder-metric-val">
                            {calc.salesStats.hasSalesHistory
                              ? `${fromMilli(calc.salesStats.avgDailySalesMilli).toFixed(1)} ${unit}/day`
                              : 'No sales history'}
                          </span>
                        </div>

                        <div className="reorder-metric-item">
                          <span className="reorder-metric-label">Days Stock Left</span>
                          <span className="reorder-metric-val">
                            {calc.daysRemaining !== null
                              ? calc.daysRemaining < 1
                                ? '< 1 day'
                                : `~${calc.daysRemaining.toFixed(1)} days`
                              : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Recommendation Explanation */}
                      <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-3)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Info size={12} />
                        <span>{calc.explanation}</span>
                      </div>

                      {/* Quantity Stepper & Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--clr-text-2)' }}>
                            Suggested Order:
                          </span>
                          <div className="qty-stepper">
                            <button
                              className="qty-stepper-btn"
                              onClick={() => handleQtyChange(p.id, currentEffectiveQty - step, step)}
                            >
                              <Minus size={14} />
                            </button>
                            <input
                              className="qty-stepper-input"
                              type="number"
                              min={step}
                              step={step}
                              value={currentEffectiveQty}
                              onChange={(e) => handleQtyChange(p.id, parseFloat(e.target.value) || step, step)}
                            />
                            <button
                              className="qty-stepper-btn"
                              onClick={() => handleQtyChange(p.id, currentEffectiveQty + step, step)}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <span style={{ fontSize: '0.78rem', color: 'var(--clr-text-3)' }}>{unit}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {isOrdered ? (
                            <>
                              <button
                                className="btn btn-ghost"
                                style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                                onClick={() => handleUndoOrder(p.id)}
                              >
                                <Undo2 size={13} /> Undo Order
                              </button>
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                                onClick={() => openReceive(p)}
                              >
                                <Plus size={13} /> Receive Goods
                              </button>
                            </>
                          ) : (
                            <>
                              {!draft && (
                                <button
                                  className="btn btn-ghost"
                                  style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                                  onClick={() => handleAddToPurchaseList(calc)}
                                >
                                  <ShoppingCart size={13} /> Add to List
                                </button>
                              )}
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                                onClick={() => handleMarkAsOrdered(calc)}
                              >
                                <Check size={13} /> Mark as Ordered
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 2: NOT MOVING — SLOW/DEAD STOCK LIST
          ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'notMoving' && (
        <>
          <div className="card" style={{ marginBottom: 14, borderColor: 'var(--clr-yellow-border)', background: 'var(--clr-yellow-surface)', padding: '12px 16px' }}>
            <p style={{ fontSize: '0.82rem', margin: 0, color: 'var(--clr-yellow-action)' }}>
              <strong>Slow Stock Rule:</strong> Products with no recorded sales in the last {sheetData?.settings.staleDays ?? 30} days.
              Newly added products within the {sheetData?.settings.staleGracePeriodDays ?? 14}-day grace period are excluded to prevent premature flagging.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <button
              className={`tab-btn ${reviewFilter === 'all' ? 'active' : ''}`}
              style={{ padding: '4px 10px', fontSize: '0.75rem', flex: 'none' }}
              onClick={() => setReviewFilter('all')}
            >
              All Slow Moving ({slowStockCalculations.length})
            </button>
            <button
              className={`tab-btn ${reviewFilter === 'unreviewed' ? 'active' : ''}`}
              style={{ padding: '4px 10px', fontSize: '0.75rem', flex: 'none' }}
              onClick={() => setReviewFilter('unreviewed')}
            >
              Needs Review ({slowStockCalculations.filter((c) => !c.isReviewed).length})
            </button>
            <button
              className={`tab-btn ${reviewFilter === 'reviewed' ? 'active' : ''}`}
              style={{ padding: '4px 10px', fontSize: '0.75rem', flex: 'none' }}
              onClick={() => setReviewFilter('reviewed')}
            >
              Reviewed ({slowStockCalculations.filter((c) => c.isReviewed).length})
            </button>
          </div>

          {filteredSlowStock.length === 0 ? (
            <div className="empty-state">
              <CheckCircle size={44} color="var(--clr-primary)" />
              <h3>No slow-moving inventory!</h3>
              <p>
                All products have recorded recent sales, or are currently within their initial grace period.
              </p>
            </div>
          ) : (
            filteredSlowStock.map((item) => {
              const p = item.product;
              const unit = UNIT_LABELS[p.unit] || p.unit;

              return (
                <div
                  key={p.id}
                  className={`reorder-item-card ${item.isReviewed ? 'is-reviewed' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>
                        {p.name}
                        {p.nameHindi && (
                          <span style={{ fontSize: '0.82rem', color: 'var(--clr-text-3)', marginLeft: 8, fontWeight: 500 }}>
                            {p.nameHindi}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--clr-text-3)', marginTop: 2 }}>
                        {p.category} {p.supplierName ? `· Supplier: ${p.supplierName}` : ''}
                      </div>
                    </div>

                    <div>
                      {item.isNeverSold ? (
                        <span className="badge badge-red">Never sold</span>
                      ) : (
                        <span className="badge badge-yellow">
                          <Clock size={11} /> {item.daysSinceLastSale}d without sale
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="reorder-metric-grid" style={{ marginTop: 10 }}>
                    <div className="reorder-metric-item">
                      <span className="reorder-metric-label">Current Stock</span>
                      <span className="reorder-metric-val">
                        {item.currentQty} {unit}
                      </span>
                    </div>

                    <div className="reorder-metric-item">
                      <span className="reorder-metric-label">Last Sale Date</span>
                      <span className="reorder-metric-val">
                        {item.lastSaleDate ? formatShortDate(item.lastSaleDate) : 'Never sold'}
                      </span>
                    </div>

                    <div className="reorder-metric-item">
                      <span className="reorder-metric-label">Days Inactive</span>
                      <span className="reorder-metric-val" style={{ color: 'var(--clr-peach-action)' }}>
                        {item.daysSinceLastSale !== null
                          ? `${item.daysSinceLastSale} days`
                          : `Added ${item.daysSinceAdded}d ago`}
                      </span>
                    </div>

                    <div className="reorder-metric-item">
                      <span className="reorder-metric-label">Tied-Up Capital</span>
                      <span className="reorder-metric-val">
                        {item.stockValue !== undefined ? `₹${item.stockValue.toFixed(0)}` : 'Cost not set'}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-3)', marginTop: 6 }}>
                    {item.classificationReason}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                    <div>
                      {item.isReviewed && item.reviewedAt ? (
                        <span className="badge badge-green" style={{ fontSize: '0.75rem' }}>
                          <Check size={12} /> Reviewed on {formatShortDate(item.reviewedAt)}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--clr-text-3)' }}>
                          Pending owner review
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      {item.isReviewed ? (
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                          onClick={() => handleToggleReview(p.id, true)}
                        >
                          <Undo2 size={13} /> Unmark
                        </button>
                      ) : (
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: '0.78rem', padding: '6px 14px', borderColor: 'rgba(71, 122, 90, 0.3)' }}
                          onClick={() => handleToggleReview(p.id, false)}
                        >
                          <Check size={13} /> Mark as Reviewed
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {/* Stock In Bottom Sheet modal */}
      <BottomSheet
        open={isStockInOpen}
        onClose={() => {
          setIsStockInOpen(false);
          setStockInProduct(null);
        }}
      >
        {stockInProduct && (
          <StockInSheet
            preSelectedProduct={stockInProduct}
            onClose={() => {
              setIsStockInOpen(false);
              setStockInProduct(null);
            }}
          />
        )}
      </BottomSheet>
    </div>
  );
}
