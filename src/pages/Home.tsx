import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useLowStockProducts,
  useRecentSales,
  useTodaySalesTotal,
  useShopName,
  useProducts,
  useInventoryMetrics,
} from '../hooks/useDb';
import { BottomSheet } from '../components/ui/BottomSheet';
import { StockInSheet } from '../components/features/StockInSheet';
import { RecordSaleSheet } from '../components/features/RecordSaleSheet';
import { AddProductSheet } from '../components/features/AddProductSheet';
import { UNIT_LABELS, fromMilli } from '../lib/quantity';
import {
  Plus,
  ShoppingCart,
  RotateCcw,
  Package,
  Store,
  Wifi,
  WifiOff,
  AlertTriangle,
  Receipt,
  Layers,
} from 'lucide-react';
import type { Product } from '../db/schema';

type SheetKind = 'stockIn' | 'sale' | 'add' | null;

export function Home() {
  const navigate = useNavigate();
  const shopName = useShopName();
  const lowStock = useLowStockProducts() ?? [];
  const recentSales = useRecentSales(6) ?? [];
  const allProducts = useProducts() ?? [];
  const todayTotal = useTodaySalesTotal() ?? 0;
  const inventoryMetrics = useInventoryMetrics();

  const [sheet, setSheet] = useState<SheetKind>(null);
  const [stockInProduct, setStockInProduct] = useState<Product | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(false);
    const handleOffline = () => setOnline(true);
    window.addEventListener('online', () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));
  }, []);

  const todayStr = useMemo(() => new Date().toDateString(), []);
  const todaySalesCount = useMemo(() => {
    return recentSales.filter((s) => {
      const d = new Date(s.createdAt);
      return d.toDateString() === todayStr;
    }).length;
  }, [recentSales, todayStr]);

  const dateFormatted = useMemo(() => {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  }, []);

  function formatTime(d: Date) {
    return new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(d));
  }

  function openStockIn(p: Product) {
    setStockInProduct(p);
    setSheet('stockIn');
  }

  return (
    <div className="page">
      {/* ════════════════════════════════════════════════════════════════════════
          1. BEAUTIFUL DASHBOARD HERO SECTION
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="dashboard-hero">
        <div style={{ flex: 1, minWidth: 260, zIndex: 1 }}>
          <div className="hero-eyebrow">YOUR SHOP, YOUR CONTROL</div>
          <h1 className="hero-heading">Namaste, Dukandaar!</h1>
          <p className="hero-subtitle">Aaj apni dukaan ka haal dekh lein.</p>

          <div className="hero-meta-row">
            <span>📅 {dateFormatted}</span>
            <span>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: online ? 'var(--clr-status-success)' : 'var(--clr-status-warn)' }}>
              {online ? <Wifi size={13} /> : <WifiOff size={13} />}
              {online ? 'Online Sync Active' : 'Offline Mode (Local SQLite/IndexedDB)'}
            </span>
          </div>
        </div>

        {/* Hero Actions */}
        <div className="hero-actions" style={{ zIndex: 1 }}>
          <button
            className="btn btn-primary"
            onClick={() => setSheet('add')}
            id="hero-add-product"
          >
            <Plus size={16} /> + Add Product
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setSheet('sale')}
            id="hero-record-sale"
          >
            <ShoppingCart size={16} /> Record Sale
          </button>
        </div>

        {/* Decorative Leaf/Store Motif SVG */}
        <div className="hero-decor-motif">
          <Store size={140} />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          2. FOUR COORDINATED METRIC CARDS
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="metric-grid-4">
        {/* Card 1: Total Products (#E7F1E8) */}
        <div
          className="metric-card card-green"
          onClick={() => navigate('/products')}
          style={{ cursor: 'pointer' }}
        >
          <div className="metric-header">
            <span className="metric-label">Total Products</span>
            <div className="metric-icon-wrap"><Package size={18} /></div>
          </div>
          <div className="metric-val">{inventoryMetrics?.totalCount ?? allProducts.length}</div>
          <div className="metric-sub">
            {inventoryMetrics?.inStockCount ?? allProducts.length} items in healthy stock
          </div>
        </div>

        {/* Card 2: Low Stock (#FBE8DD) */}
        <div
          className="metric-card card-peach"
          onClick={() => navigate('/reorder')}
          style={{ cursor: 'pointer' }}
        >
          <div className="metric-header">
            <span className="metric-label">Low Stock</span>
            <div className="metric-icon-wrap"><AlertTriangle size={18} /></div>
          </div>
          <div className="metric-val">{lowStock.length}</div>
          <div className="metric-sub">
            {lowStock.length > 0 ? 'Needs restock reorder →' : 'All levels adequate'}
          </div>
        </div>

        {/* Card 3: Out of Stock (#F0E8F7) */}
        <div
          className="metric-card card-lavender"
          onClick={() => navigate('/reorder')}
          style={{ cursor: 'pointer' }}
        >
          <div className="metric-header">
            <span className="metric-label">Out of Stock</span>
            <div className="metric-icon-wrap"><Layers size={18} /></div>
          </div>
          <div className="metric-val">{inventoryMetrics?.outOfStockCount ?? 0}</div>
          <div className="metric-sub">Zero inventory items</div>
        </div>

        {/* Card 4: Today's Sales (#315D46) */}
        <div
          className="metric-card card-deep-sage"
          onClick={() => navigate('/history')}
          style={{ cursor: 'pointer' }}
        >
          <div className="metric-header">
            <span className="metric-label">Today's Sales</span>
            <div className="metric-icon-wrap"><Receipt size={18} /></div>
          </div>
          <div className="metric-val">
            {todayTotal > 0 ? `₹${todayTotal.toFixed(0)}` : '₹0'}
          </div>
          <div className="metric-sub">
            {todaySalesCount} checkout{todaySalesCount !== 1 ? 's' : ''} recorded today
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          3. COLOURFUL QUICK ACTION CARDS
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="section-title">Quick Actions (त्वरित कार्य)</div>
      <div className="quick-action-grid">
        <div className="quick-action-card qa-green" onClick={() => setSheet('add')}>
          <div className="qa-icon"><Plus size={18} /></div>
          <div>
            <div className="qa-title">Add Product</div>
            <div className="qa-desc">Naya saamaan jodein</div>
          </div>
        </div>

        <div className="quick-action-card qa-blue" onClick={() => setSheet('sale')}>
          <div className="qa-icon"><ShoppingCart size={18} /></div>
          <div>
            <div className="qa-title">Record Sale</div>
            <div className="qa-desc">Bikri darj karein</div>
          </div>
        </div>

        <div className="quick-action-card qa-lavender" onClick={() => navigate('/reorder')}>
          <div className="qa-icon"><RotateCcw size={18} /></div>
          <div>
            <div className="qa-title">Smart Reorder</div>
            <div className="qa-desc">Kharid soochi banayein</div>
          </div>
        </div>

        <div className="quick-action-card qa-peach" onClick={() => navigate('/products')}>
          <div className="qa-icon"><Package size={18} /></div>
          <div>
            <div className="qa-title">View Products</div>
            <div className="qa-desc">Dukaan ka poora stock</div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          4. STOCK AT A GLANCE (Low stock & critical warnings)
          ════════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
        
        {/* Left: Stock at a Glance */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0 }}>Stock at a Glance</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-3)' }}>
                Products running low or requiring owner action
              </span>
            </div>
            {lowStock.length > 0 && (
              <span className="badge badge-peach">{lowStock.length} items</span>
            )}
          </div>

          {lowStock.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--clr-text-3)' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: 4 }}>🌿</div>
              <div style={{ fontWeight: 600, color: 'var(--clr-text)' }}>Stock health is optimal!</div>
              <p style={{ fontSize: '0.8rem', margin: '4px 0 0' }}>
                All inventory quantities are currently above their configured reorder thresholds.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lowStock.slice(0, 5).map((p) => {
                const isCritical = p.currentQtyMilli <= 0;
                const unit = UNIT_LABELS[p.unit] || p.unit;

                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: isCritical ? '#FFF8F8' : 'var(--clr-surface-2)',
                      border: `1px solid ${isCritical ? 'rgba(185, 76, 72, 0.25)' : 'var(--clr-border)'}`,
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--clr-text)' }}>
                        {p.name}
                        {p.nameHindi && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--clr-text-3)', marginLeft: 6 }}>
                            {p.nameHindi}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: isCritical ? 'var(--clr-status-crit)' : 'var(--clr-peach-action)', marginTop: 2 }}>
                        Current: <strong>{fromMilli(p.currentQtyMilli)} {unit}</strong> · Min: {fromMilli(p.lowStockThresholdMilli)} {unit}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge ${isCritical ? 'badge-red' : 'badge-peach'}`}>
                        {isCritical ? 'Out of stock' : 'Low stock'}
                      </span>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                        onClick={() => openStockIn(p)}
                        title="Add stock"
                      >
                        <Plus size={13} /> Stock In
                      </button>
                    </div>
                  </div>
                );
              })}

              {lowStock.length > 5 && (
                <button
                  className="btn btn-ghost btn-full"
                  style={{ fontSize: '0.8rem', marginTop: 6 }}
                  onClick={() => navigate('/reorder')}
                >
                  View all {lowStock.length} low stock items in Smart Reorder →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Recent Sales Activity */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0 }}>Recent Activity</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-3)' }}>
                Live customer transactions
              </span>
            </div>
            <button
              className="btn btn-ghost"
              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              onClick={() => navigate('/history')}
            >
              All History →
            </button>
          </div>

          {recentSales.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--clr-text-3)' }}>
              <Receipt size={32} style={{ opacity: 0.35, margin: '0 auto 6px' }} />
              <div style={{ fontWeight: 600, color: 'var(--clr-text)' }}>No sales recorded yet</div>
              <p style={{ fontSize: '0.8rem', margin: '4px 0 0' }}>
                Customer checkouts will appear here immediately after recording a sale.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentSales.map((sale) => (
                <div
                  key={sale.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--clr-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--clr-primary-action)',
                        marginTop: 6,
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--clr-text)' }}>
                        {sale.items.map((i) => `${i.productName} (${fromMilli(i.qtyMilli)})`).join(', ')}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-3)', marginTop: 2 }}>
                        {formatTime(sale.createdAt)} · {sale.items.length} item{sale.items.length > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--clr-primary)', whiteSpace: 'nowrap' }}>
                    {sale.totalAmount ? `₹${sale.totalAmount.toFixed(0)}` : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          SHEETS & MODALS (Stock In, Record Sale, Add Product)
          ════════════════════════════════════════════════════════════════════════ */}
      <BottomSheet open={sheet !== null} onClose={() => setSheet(null)}>
        {sheet === 'stockIn' && stockInProduct && (
          <StockInSheet
            preSelectedProduct={stockInProduct}
            onClose={() => {
              setSheet(null);
              setStockInProduct(null);
            }}
          />
        )}
        {sheet === 'sale' && (
          <RecordSaleSheet onClose={() => setSheet(null)} />
        )}
        {sheet === 'add' && (
          <AddProductSheet onClose={() => setSheet(null)} />
        )}
      </BottomSheet>
    </div>
  );
}
