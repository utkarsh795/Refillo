import React from 'react';
import { useStaleProducts, useStaleDays } from '../hooks/useDb';
import { BottomSheet } from '../components/ui/BottomSheet';
import { StockInSheet } from '../components/features/StockInSheet';
import { UNIT_LABELS, fromMilli } from '../lib/quantity';
import { Clock, TrendingDown, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import type { Product } from '../db/schema';

export function StaleItems() {
  const staleDays = useStaleDays();
  const stale = useStaleProducts(staleDays) ?? [];
  const [stockInProduct, setStockInProduct] = useState<Product | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function daysSince(date: Date | undefined): number {
    if (!date) return Infinity;
    const ms = Date.now() - new Date(date).getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }

  const sorted = [...stale].sort((a, b) => {
    const da = a.lastSoldAt ? daysSince(new Date(a.lastSoldAt)) : Infinity;
    const db_ = b.lastSoldAt ? daysSince(new Date(b.lastSoldAt)) : Infinity;
    return db_ - da;
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Stale Items</h1>
        {stale.length > 0 && (
          <span className="badge badge-yellow">{stale.length}</span>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(250,204,21,0.2)' }}>
        <p style={{ fontSize: '0.82rem', margin: 0 }}>
          Items not sold in the last <strong style={{ color: 'var(--clr-warn)' }}>{staleDays} days</strong>.
          These may be tying up money or expiring soon. Change threshold in Settings.
        </p>
      </div>

      {stale.length === 0 ? (
        <div className="empty-state">
          <CheckCircle size={40} color="var(--clr-primary)" />
          <h3>Nothing stale!</h3>
          <p>All items have been sold within the last {staleDays} days</p>
        </div>
      ) : (
        sorted.map((p) => {
          const days = daysSince(p.lastSoldAt ? new Date(p.lastSoldAt) : undefined);
          const isNeverSold = !p.lastSoldAt;
          return (
            <div key={p.id} className="card" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ marginTop: 2 }}>
                  {isNeverSold
                    ? <TrendingDown size={18} color="var(--clr-danger)" />
                    : <Clock size={18} color="var(--clr-warn)" />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  {p.nameHindi && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-2)' }}>{p.nameHindi}</div>
                  )}
                  <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span className="badge badge-gray">{p.category}</span>
                    <span className={`badge ${isNeverSold ? 'badge-red' : 'badge-yellow'}`}>
                      {isNeverSold ? 'Never sold' : `${days} days ago`}
                    </span>
                    <span className="badge badge-gray">
                      {fromMilli(p.currentQtyMilli).toFixed(2)} {UNIT_LABELS[p.unit]} in stock
                    </span>
                  </div>
                  {p.purchaseCost && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-3)', marginTop: 6 }}>
                      Cost tied up: ≈₹{(p.purchaseCost * fromMilli(p.currentQtyMilli)).toFixed(0)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      <BottomSheet open={sheetOpen} onClose={() => { setSheetOpen(false); setStockInProduct(null); }}>
        {stockInProduct && (
          <StockInSheet
            preSelectedProduct={stockInProduct}
            onClose={() => { setSheetOpen(false); setStockInProduct(null); }}
          />
        )}
      </BottomSheet>
    </div>
  );
}
