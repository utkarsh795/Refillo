import React, { useState } from 'react';
import { useProducts, useCategories } from '../hooks/useDb';
import { BottomSheet } from '../components/ui/BottomSheet';
import { AddProductSheet } from '../components/features/AddProductSheet';
import { StockInSheet } from '../components/features/StockInSheet';
import { UNIT_LABELS, fromMilli } from '../lib/quantity';
import { Search, Plus, PackagePlus, Store } from 'lucide-react';
import type { Product } from '../db/schema';

type SheetKind = 'add' | 'stockIn' | null;

function categoryIndicator(category: string) {
  const map: Record<string, { emoji: string; bg: string; text: string }> = {
    Staples:       { emoji: '🌾', bg: 'var(--clr-yellow-surface)', text: 'var(--clr-yellow-action)' },
    Dairy:         { emoji: '🥛', bg: 'var(--clr-blue-surface)',   text: 'var(--clr-blue-action)' },
    Snacks:        { emoji: '🍿', bg: 'var(--clr-peach-surface)',  text: 'var(--clr-peach-action)' },
    Beverages:     { emoji: '☕', bg: 'var(--clr-lavender-surface)', text: 'var(--clr-lavender-action)' },
    Household:     { emoji: '🧹', bg: 'var(--clr-primary-surface)', text: 'var(--clr-primary)' },
    'Personal Care': { emoji: '🪥', bg: 'var(--clr-blue-surface)', text: 'var(--clr-blue-action)' },
    Other:         { emoji: '📦', bg: 'var(--clr-surface-2)',      text: 'var(--clr-text-2)' },
  };
  return map[category] ?? { emoji: '📦', bg: 'var(--clr-surface-2)', text: 'var(--clr-text-2)' };
}

export function Products() {
  const categories = useCategories();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [stockInProduct, setStockInProduct] = useState<Product | null>(null);
  const products = useProducts(search, category) ?? [];

  function openStockIn(p: Product, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    setStockInProduct(p);
    setSheet('stockIn');
  }

  function getStockStatus(p: Product) {
    if (p.currentQtyMilli <= 0) {
      return { label: 'Out of Stock', badgeClass: 'badge-red' };
    }
    if (p.currentQtyMilli <= p.lowStockThresholdMilli) {
      return { label: 'Low Stock', badgeClass: 'badge-peach' };
    }
    return { label: 'In Stock', badgeClass: 'badge-green' };
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Product Inventory (उत्पाद सूची)</h1>
          <p style={{ margin: 0, fontSize: '0.82rem' }}>
            Manage prices, stock levels, and supplier links for all items.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              background: 'var(--clr-surface-2)',
              border: '1px solid var(--clr-border)',
              borderRadius: 100,
              padding: '4px 12px',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--clr-text-2)',
            }}
          >
            {products.length} Products
          </span>

          <button
            className="btn btn-primary"
            onClick={() => setSheet('add')}
            id="btn-add-product-header"
          >
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {/* Soft-Blue Search Bar */}
      <div className="search-bar">
        <Search size={18} />
        <input
          placeholder="Search by product name, barcode or हिंदी नाम…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{ background: 'none', border: 'none', color: 'var(--clr-text-3)', cursor: 'pointer', padding: 0 }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Category Filter Chips with Pastel Indicators */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 10,
          marginBottom: 14,
          scrollbarWidth: 'none',
        }}
      >
        <button
          className={`tab-btn ${category === '' ? 'active' : ''}`}
          onClick={() => setCategory('')}
          style={{ flexShrink: 0, padding: '6px 14px', minWidth: 'auto', flex: 'none', fontSize: '0.8rem' }}
        >
          All ({products.length})
        </button>
        {categories.map((c) => {
          const info = categoryIndicator(c);
          return (
            <button
              key={c}
              className={`tab-btn ${category === c ? 'active' : ''}`}
              onClick={() => setCategory(c)}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                minWidth: 'auto',
                flex: 'none',
                fontSize: '0.8rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{info.emoji}</span>
              <span>{c}</span>
            </button>
          );
        })}
      </div>

      {products.length === 0 ? (
        <div className="empty-state">
          <Store size={40} />
          <h3>No products found</h3>
          <p>{search ? `No products matched "${search}"` : 'Start your store inventory by adding your first product'}</p>
          <button className="btn btn-primary" onClick={() => setSheet('add')} style={{ marginTop: 6 }}>
            <Plus size={16} /> Add Product
          </button>
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE VIEW (visible on >= 768px via media queries) */}
          <div className="table-container" style={{ display: 'none' }} id="desktop-inventory-table">
            <table className="kirana-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Stock Qty</th>
                  <th>Min Alert</th>
                  <th>Sale Price</th>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const status = getStockStatus(p);
                  const unit = UNIT_LABELS[p.unit] || p.unit;
                  const catInfo = categoryIndicator(p.category);

                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--clr-text)' }}>{p.name}</div>
                        {p.nameHindi && (
                          <div style={{ fontSize: '0.76rem', color: 'var(--clr-text-3)' }}>{p.nameHindi}</div>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: catInfo.bg,
                            color: catInfo.text,
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          {catInfo.emoji} {p.category}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: status.badgeClass === 'badge-red' ? 'var(--clr-status-crit)' : 'var(--clr-text)' }}>
                          {fromMilli(p.currentQtyMilli).toFixed(p.unit === 'piece' ? 0 : 2)}
                        </span>{' '}
                        <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-3)' }}>{unit}</span>
                      </td>
                      <td style={{ color: 'var(--clr-text-3)', fontSize: '0.82rem' }}>
                        {fromMilli(p.lowStockThresholdMilli)} {unit}
                      </td>
                      <td>
                        {p.sellingPrice ? (
                          <span style={{ fontWeight: 600, color: 'var(--clr-primary)' }}>
                            ₹{p.sellingPrice}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.78rem' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--clr-text-2)' }}>
                        {p.supplierName || <span style={{ color: 'var(--clr-text-muted)' }}>Not set</span>}
                      </td>
                      <td>
                        <span className={`badge ${status.badgeClass}`}>{status.label}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                          onClick={(e) => openStockIn(p, e)}
                        >
                          <PackagePlus size={13} /> Stock In
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE PRODUCT CARDS VIEW (default on mobile screens) */}
          <div id="mobile-inventory-cards">
            {products.map((p) => {
              const status = getStockStatus(p);
              const unit = UNIT_LABELS[p.unit] || p.unit;
              const catInfo = categoryIndicator(p.category);

              return (
                <div
                  key={p.id}
                  className={`product-card ${status.badgeClass === 'badge-red' ? 'is-out' : status.badgeClass === 'badge-peach' ? 'is-low' : ''}`}
                >
                  <div className="product-icon">{catInfo.emoji}</div>
                  <div className="product-info">
                    <div className="product-name">{p.name}</div>
                    {p.nameHindi && <div className="product-hindi">{p.nameHindi}</div>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <span className="badge badge-gray">{p.category}</span>
                      <span className={`badge ${status.badgeClass}`}>{status.label}</span>
                      {p.sellingPrice && (
                        <span className="badge badge-green">₹{p.sellingPrice}</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <div className="product-qty">
                      <div className={`product-qty-val ${status.badgeClass === 'badge-red' ? 'out' : status.badgeClass === 'badge-peach' ? 'low' : ''}`}>
                        {fromMilli(p.currentQtyMilli).toFixed(p.unit === 'piece' ? 0 : 2)}
                      </div>
                      <div className="product-qty-unit">{unit}</div>
                    </div>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '4px 10px', fontSize: '0.72rem', gap: 4 }}
                      onClick={(e) => openStockIn(p, e)}
                    >
                      <PackagePlus size={12} /> Stock In
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Sheets */}
      <BottomSheet open={sheet === 'add'} onClose={() => setSheet(null)}>
        <AddProductSheet onClose={() => setSheet(null)} />
      </BottomSheet>
      <BottomSheet
        open={sheet === 'stockIn'}
        onClose={() => { setSheet(null); setStockInProduct(null); }}
      >
        {stockInProduct && (
          <StockInSheet
            preSelectedProduct={stockInProduct}
            onClose={() => { setSheet(null); setStockInProduct(null); }}
          />
        )}
      </BottomSheet>
    </div>
  );
}
