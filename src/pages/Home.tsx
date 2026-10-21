import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useLowStockProducts, useRecentSales, useTodaySalesTotal,
  useShopName, useStaleDays, useStaleProducts, useProducts
} from '../hooks/useDb';
import { BottomSheet } from '../components/ui/BottomSheet';
import { StockInSheet } from '../components/features/StockInSheet';
import { RecordSaleSheet } from '../components/features/RecordSaleSheet';
import { UNIT_LABELS } from '../lib/quantity';
import {
  PackagePlus, ShoppingCart, AlertTriangle, Clock,
  Store, Package, TrendingUp
} from 'lucide-react';

type SheetKind = 'stockIn' | 'sale' | null;

export function Home() {
  const navigate    = useNavigate();
  const shopName    = useShopName();
  const staleDays   = useStaleDays();
  const lowStock    = useLowStockProducts() ?? [];
  const stale       = useStaleProducts(staleDays) ?? [];
  const recentSales = useRecentSales(8) ?? [];
  const allProducts = useProducts() ?? [];
  const todayTotal  = useTodaySalesTotal() ?? 0;
  const [sheet, setSheet] = useState<SheetKind>(null);

  const todaySalesCount = recentSales.filter((s) => {
    const d = new Date(s.createdAt);
    return d.toDateString() === new Date().toDateString();
  }).length;

  function formatTime(d: Date) {
    return new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(d);
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'linear-gradient(135deg, var(--clr-primary), #22c55e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Store size={22} color="var(--clr-primary-fg)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: '1.2rem', marginBottom: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {shopName}
          </h1>
          <p style={{ fontSize: '0.75rem', margin: 0 }}>
            {new Intl.DateTimeFormat('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long',
            }).format(new Date())}
          </p>
        </div>
      </div>

      {/* Two-column grid on desktop */}
      <div className="home-grid">
        {/* Left / main column */}
        <div className="home-main">
          {/* Stats */}
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Today's Sales</div>
              <div className={`stat-value ${todayTotal > 0 ? 'green' : ''}`}>
                {todayTotal > 0 ? `₹${todayTotal.toFixed(0)}` : '—'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-3)' }}>
                {todaySalesCount} transaction{todaySalesCount !== 1 ? 's' : ''}
              </div>
            </div>

            <div
              className="stat-card"
              style={{ cursor: lowStock.length > 0 ? 'pointer' : 'default' }}
              onClick={() => lowStock.length > 0 && navigate('/reorder')}
            >
              <div className="stat-label">Low Stock</div>
              <div className={`stat-value ${lowStock.length > 0 ? 'red' : 'green'}`}>
                {lowStock.length}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-3)' }}>
                {lowStock.length > 0 ? 'Tap to reorder →' : 'All stocked up!'}
              </div>
            </div>

            <div
              className="stat-card"
              style={{ cursor: stale.length > 0 ? 'pointer' : 'default' }}
              onClick={() => stale.length > 0 && navigate('/stale')}
            >
              <div className="stat-label">Stale Items</div>
              <div className={`stat-value ${stale.length > 0 ? 'orange' : 'green'}`}>
                {stale.length}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-3)' }}>
                {stale.length > 0 ? `${staleDays}+ days idle` : 'All moving!'}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Total Products</div>
              <div className="stat-value">{allProducts.length}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-3)' }}>in inventory</div>
            </div>
          </div>

          {/* Alert strips */}
          {lowStock.length > 0 && (
            <div
              className="card"
              style={{ borderColor: 'rgba(248,113,113,0.35)', cursor: 'pointer', marginBottom: 12 }}
              onClick={() => navigate('/reorder')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={18} color="var(--clr-danger)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {lowStock.length} item{lowStock.length > 1 ? 's' : ''} running low
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-2)' }}>
                    {lowStock.slice(0, 3).map((p) => p.name).join(', ')}
                    {lowStock.length > 3 && ` +${lowStock.length - 3} more`}
                  </div>
                </div>
                <span style={{ color: 'var(--clr-danger)', fontSize: '0.8rem', fontWeight: 600 }}>
                  View →
                </span>
              </div>
            </div>
          )}

          {stale.length > 0 && (
            <div
              className="card"
              style={{ borderColor: 'rgba(250,204,21,0.25)', cursor: 'pointer', marginBottom: 16 }}
              onClick={() => navigate('/stale')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Clock size={18} color="var(--clr-warn)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {stale.length} item{stale.length > 1 ? 's' : ''} not sold in {staleDays}+ days
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-2)' }}>
                    May be tying up money — tap to review
                  </div>
                </div>
                <span style={{ color: 'var(--clr-warn)', fontSize: '0.8rem', fontWeight: 600 }}>
                  View →
                </span>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="section-title">Quick Actions</div>
          <div className="quick-actions">
            <button className="quick-action-btn green" onClick={() => setSheet('stockIn')} id="btn-add-stock">
              <div className="icon-wrap"><PackagePlus size={22} /></div>
              Add Stock
            </button>
            <button className="quick-action-btn orange" onClick={() => setSheet('sale')} id="btn-record-sale">
              <div className="icon-wrap"><ShoppingCart size={22} /></div>
              Record Sale
            </button>
            <button className="quick-action-btn blue" onClick={() => navigate('/products')}>
              <div className="icon-wrap"><Package size={22} /></div>
              Products
            </button>
            <button className="quick-action-btn purple" onClick={() => navigate('/reorder')}>
              <div className="icon-wrap"><TrendingUp size={22} /></div>
              Reorder
            </button>
          </div>
        </div>

        {/* Right / side column (recent sales) */}
        <div className="home-side">
          <div className="section-title">Recent Sales</div>
          {recentSales.length === 0 ? (
            <div className="card">
              <p style={{ textAlign: 'center', fontSize: '0.85rem', padding: '12px 0' }}>
                No sales recorded yet
              </p>
            </div>
          ) : (
            <div className="card">
              {recentSales.map((s) => (
                <div key={s.id} className="sale-row">
                  <div className="sale-row-dot" />
                  <div className="sale-row-info">
                    <div style={{ fontWeight: 500, fontSize: '0.88rem', lineHeight: 1.3 }}>
                      {s.items.map((i) => i.productName).join(', ')}
                    </div>
                    <div className="sale-row-items">
                      {s.items.map((i) =>
                        `${(i.qtyMilli / 1000).toFixed(i.qtyMilli % 1000 === 0 ? 0 : 2)} ${UNIT_LABELS[i.unit]}`
                      ).join(' · ')}
                    </div>
                    <div className="sale-row-time">{formatTime(new Date(s.createdAt))}</div>
                  </div>
                  {s.totalAmount != null && (
                    <div className="sale-row-amount">₹{s.totalAmount.toFixed(0)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sheets */}
      <BottomSheet open={sheet === 'stockIn'} onClose={() => setSheet(null)}>
        <StockInSheet onClose={() => setSheet(null)} />
      </BottomSheet>
      <BottomSheet open={sheet === 'sale'} onClose={() => setSheet(null)}>
        <RecordSaleSheet onClose={() => setSheet(null)} />
      </BottomSheet>
    </div>
  );
}
