import React, { useState } from 'react';
import { useProducts, useCategories } from '../hooks/useDb';
import { BottomSheet } from '../components/ui/BottomSheet';
import { AddProductSheet } from '../components/features/AddProductSheet';
import { StockInSheet } from '../components/features/StockInSheet';
import { UNIT_LABELS, fromMilli } from '../lib/quantity';
import { Search, Plus, PackagePlus } from 'lucide-react';
import type { Product } from '../db/schema';

type SheetKind = 'add' | 'stockIn' | null;

function categoryEmoji(category: string): string {
  const map: Record<string, string> = {
    Staples: '🌾', Dairy: '🥛', Snacks: '🍿', Beverages: '☕',
    Household: '🧹', 'Personal Care': '🪥', Other: '📦',
  };
  return map[category] ?? '📦';
}

export function Products() {
  const categories = useCategories();
  const [search,          setSearch]          = useState('');
  const [category,        setCategory]        = useState('');
  const [sheet,           setSheet]           = useState<SheetKind>(null);
  const [stockInProduct,  setStockInProduct]  = useState<Product | null>(null);
  const products = useProducts(search, category) ?? [];

  function openStockIn(p: Product, e: React.MouseEvent) {
    e.stopPropagation();
    setStockInProduct(p);
    setSheet('stockIn');
  }

  const isLow = (p: Product) => p.currentQtyMilli <= p.lowStockThresholdMilli;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <h1>Products</h1>
        <span style={{
          background: 'var(--clr-surface-2)', borderRadius: 100,
          padding: '3px 10px', fontSize: '0.8rem', color: 'var(--clr-text-2)',
        }}>
          {products.length}
        </span>
        {/* Desktop add button in header */}
        <button
          className="btn btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={() => setSheet('add')}
          id="btn-add-product-header"
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* Search */}
      <div className="search-bar">
        <Search size={16} />
        <input
          placeholder="Search by name or हिंदी नाम…"
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

      {/* Category filter chips */}
      <div style={{
        display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10,
        marginBottom: 4, scrollbarWidth: 'none',
      }}>
        <button
          className={`tab-btn ${category === '' ? 'active' : ''}`}
          onClick={() => setCategory('')}
          style={{ flexShrink: 0, padding: '6px 14px', minWidth: 'auto', flex: 'none', fontSize: '0.78rem' }}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            className={`tab-btn ${category === c ? 'active' : ''}`}
            onClick={() => setCategory(c)}
            style={{ flexShrink: 0, padding: '6px 14px', minWidth: 'auto', flex: 'none', fontSize: '0.78rem' }}
          >
            {categoryEmoji(c)} {c}
          </button>
        ))}
      </div>

      {products.length === 0 ? (
        <div className="empty-state">
          <PackagePlus size={40} />
          <h3>No products found</h3>
          <p>{search ? `No results for "${search}"` : 'Add your first product to get started'}</p>
          {!search && (
            <button className="btn btn-primary" onClick={() => setSheet('add')}>
              <Plus size={16} /> Add Product
            </button>
          )}
        </div>
      ) : (
        /* product-list becomes a CSS grid on desktop */
        <div className="product-list">
          {products.map((p) => (
            <div
              key={p.id}
              className={`product-card ${isLow(p) ? 'low-stock' : ''}`}
            >
              <div className="product-icon">{categoryEmoji(p.category)}</div>
              <div className="product-info">
                <div className="product-name">{p.name}</div>
                {p.nameHindi && (
                  <div className="product-hindi">{p.nameHindi}</div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <span className="badge badge-gray">{p.category}</span>
                  {isLow(p) && <span className="badge badge-red">Low Stock</span>}
                  {p.sellingPrice && (
                    <span className="badge badge-green">₹{p.sellingPrice}</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <div className="product-qty">
                  <div className={`product-qty-val ${isLow(p) ? 'low' : ''}`}>
                    {fromMilli(p.currentQtyMilli).toFixed(
                      p.unit === 'piece' ? 0 : 2
                    )}
                  </div>
                  <div className="product-qty-unit">{UNIT_LABELS[p.unit]}</div>
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '4px 10px', fontSize: '0.72rem', gap: 4 }}
                  onClick={(e) => openStockIn(p, e)}
                >
                  <PackagePlus size={12} /> Add Stock
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB — mobile only (hidden on desktop by CSS) */}
      <button className="fab" onClick={() => setSheet('add')} id="fab-add-product" title="Add Product">
        <Plus size={26} />
      </button>

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
