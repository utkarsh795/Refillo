import React, { useMemo } from 'react';
import { useReportsData, useInventoryMetrics } from '../hooks/useDb';
import { BarChart3, TrendingUp, PackageCheck, AlertTriangle, Layers, Award } from 'lucide-react';

export function Reports() {
  const reportsData = useReportsData();
  const inventoryMetrics = useInventoryMetrics();

  // Find max revenue for SVG bar height scaling
  const maxDayRevenue = useMemo(() => {
    if (!reportsData) return 100;
    const max = Math.max(...reportsData.last7Days.map((d) => d.revenue), 100);
    return max * 1.15; // 15% headroom
  }, [reportsData]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Reports & Analytics (दुकान रिपोर्ट)</h1>
          <p style={{ margin: 0, fontSize: '0.82rem' }}>
            Real business insights calculated directly from recorded sales and stock movements.
          </p>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 22 }}>
        <div className="metric-card card-green">
          <div className="metric-header">
            <span className="metric-label">All-Time Revenue</span>
            <div className="metric-icon-wrap"><TrendingUp size={18} /></div>
          </div>
          <div className="metric-val">₹{(reportsData?.totalRevenueToDate ?? 0).toFixed(0)}</div>
          <div className="metric-sub">Total sales recorded</div>
        </div>

        <div className="metric-card card-blue">
          <div className="metric-header">
            <span className="metric-label" style={{ color: 'var(--clr-blue-action)' }}>Stock Value Tied Up</span>
            <div className="metric-icon-wrap" style={{ background: 'rgba(88, 120, 185, 0.15)', color: 'var(--clr-blue-action)' }}>
              <Layers size={18} />
            </div>
          </div>
          <div className="metric-val" style={{ color: 'var(--clr-blue-action)' }}>
            ₹{(inventoryMetrics?.totalStockValue ?? 0).toFixed(0)}
          </div>
          <div className="metric-sub">Inventory purchase investment</div>
        </div>

        <div className="metric-card card-peach">
          <div className="metric-header">
            <span className="metric-label">Stock Attention</span>
            <div className="metric-icon-wrap"><AlertTriangle size={18} /></div>
          </div>
          <div className="metric-val">
            {(inventoryMetrics?.lowStockCount ?? 0) + (inventoryMetrics?.outOfStockCount ?? 0)}
          </div>
          <div className="metric-sub">
            {inventoryMetrics?.lowStockCount ?? 0} low · {inventoryMetrics?.outOfStockCount ?? 0} out of stock
          </div>
        </div>
      </div>

      {/* 7-Day Revenue Trend — Clean Inline SVG Bar Chart */}
      <div className="card" style={{ marginBottom: 22, padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={18} color="var(--clr-primary)" /> Last 7 Days Revenue Trend
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-3)' }}>
              Daily recorded sales turnover (₹)
            </span>
          </div>
        </div>

        {/* SVG Chart Canvas */}
        <div style={{ width: '100%', overflowX: 'auto', padding: '10px 0' }}>
          <div style={{ minWidth: 480, height: 200, display: 'flex', alignItems: 'flex-end', gap: 18, borderBottom: '1px solid var(--clr-border)', paddingBottom: 10 }}>
            {reportsData?.last7Days.map((bar, idx) => {
              const heightPct = Math.max(4, Math.round((bar.revenue / maxDayRevenue) * 100));
              const isToday = idx === reportsData.last7Days.length - 1;

              return (
                <div
                  key={bar.dateStr}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                >
                  {/* Amount tooltip above bar */}
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: bar.revenue > 0 ? 'var(--clr-primary)' : 'var(--clr-text-muted)' }}>
                    {bar.revenue > 0 ? `₹${bar.revenue.toFixed(0)}` : '—'}
                  </span>

                  {/* SVG Bar */}
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 44,
                      height: `${heightPct}%`,
                      background: isToday
                        ? 'var(--clr-primary)'
                        : bar.revenue > 0
                        ? 'var(--clr-primary-action)'
                        : 'var(--clr-surface-2)',
                      borderRadius: '6px 6px 0 0',
                      transition: 'height 300ms ease, background 200ms ease',
                      border: bar.revenue === 0 ? '1px dashed var(--clr-border)' : 'none',
                    }}
                    title={`${bar.dayLabel} (${bar.dateStr}): ₹${bar.revenue} from ${bar.txnCount} orders`}
                  />

                  {/* Day label */}
                  <div style={{ textAlign: 'center', marginTop: 4 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--clr-primary)' : 'var(--clr-text-2)' }}>
                      {bar.dayLabel}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two-Column Grid: Top Sellers & Category Inventory */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        
        {/* Top Selling Products */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award size={18} color="var(--clr-yellow-action)" /> Top Selling Products
          </h3>

          {(!reportsData?.topProducts || reportsData.topProducts.length === 0) ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--clr-text-3)', fontSize: '0.85rem' }}>
              No sales data recorded yet. Record customer checkouts to populate rankings.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reportsData.topProducts.map((p, idx) => (
                <div
                  key={p.productId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'var(--clr-surface-2)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--clr-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 100,
                        background: idx === 0 ? 'var(--clr-yellow-surface)' : 'var(--clr-surface)',
                        color: idx === 0 ? 'var(--clr-yellow-action)' : 'var(--clr-text-2)',
                        border: '1px solid var(--clr-border)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{p.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-3)' }}>{p.category}</div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--clr-primary)' }}>
                      ₹{p.revenue.toFixed(0)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-3)' }}>
                      {p.unitsSold} units sold
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={18} color="var(--clr-lavender-action)" /> Inventory by Category
          </h3>

          {(!reportsData?.categorySummaries || reportsData.categorySummaries.length === 0) ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--clr-text-3)', fontSize: '0.85rem' }}>
              No category information available.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reportsData.categorySummaries.map((cat) => (
                <div
                  key={cat.category}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'var(--clr-surface-2)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--clr-border)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{cat.category}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-3)' }}>
                      {cat.productCount} product{cat.productCount !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--clr-text)' }}>
                      ₹{cat.stockValue.toFixed(0)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-3)' }}>Stock Capital</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
