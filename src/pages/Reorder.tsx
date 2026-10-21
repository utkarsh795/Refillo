import React, { useState } from 'react';
import { useLowStockProducts, useReorderDrafts, useProducts } from '../hooks/useDb';
import { db } from '../db/schema';
import { UNIT_LABELS, fromMilli } from '../lib/quantity';
import { BottomSheet } from '../components/ui/BottomSheet';
import { StockInSheet } from '../components/features/StockInSheet';
import { useToast } from '../components/ui/Toast';
import { AlertTriangle, Plus, Check, Truck, ClipboardList } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { Product } from '../db/schema';

type SheetKind = 'stockIn' | null;

function statusBadge(status: string) {
  if (status === 'pending')  return <span className="badge badge-yellow">Pending</span>;
  if (status === 'ordered')  return <span className="badge badge-orange">Ordered</span>;
  if (status === 'received') return <span className="badge badge-green">Received</span>;
  return null;
}

export function Reorder() {
  const { toast } = useToast();
  const lowStock = useLowStockProducts() ?? [];
  const allDrafts = useReorderDrafts() ?? [];
  const products = useProducts() ?? [];
  const [tab, setTab] = useState<'alerts' | 'drafts'>('alerts');
  const [stockInProduct, setStockInProduct] = useState<Product | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);

  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  async function addDraft(p: Product) {
    // Avoid duplicate pending drafts for same product
    const existing = allDrafts.find(
      (d) => d.productId === p.id && d.status === 'pending'
    );
    if (existing) { toast(`Already in reorder list`, 'info'); return; }

    await db.reorderDrafts.add({
      id: uuidv4(),
      productId: p.id,
      requestedQtyMilli: p.lowStockThresholdMilli * 3,
      createdAt: new Date(),
      status: 'pending',
    });
    toast(`${p.name} added to reorder list`, 'success');
  }

  async function advanceStatus(draftId: string, current: string) {
    if (current === 'pending')  await db.reorderDrafts.update(draftId, { status: 'ordered' });
    if (current === 'ordered')  await db.reorderDrafts.update(draftId, { status: 'received' });
  }

  function openReceive(p: Product) {
    setStockInProduct(p);
    setSheet('stockIn');
  }

  const pendingDrafts = allDrafts.filter((d) => d.status !== 'received');
  const doneDrafts    = allDrafts.filter((d) => d.status === 'received');

  return (
    <div className="page">
      <div className="page-header">
        <h1>Reorder</h1>
        {(lowStock.length + allDrafts.filter(d => d.status === 'pending').length) > 0 && (
          <span className="badge badge-red">{lowStock.length} low</span>
        )}
      </div>

      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'alerts' ? 'active' : ''}`} onClick={() => setTab('alerts')}>
          ⚠ Low Stock ({lowStock.length})
        </button>
        <button className={`tab-btn ${tab === 'drafts' ? 'active' : ''}`} onClick={() => setTab('drafts')}>
          📋 Drafts ({allDrafts.length})
        </button>
      </div>

      {tab === 'alerts' && (
        <>
          {lowStock.length === 0 ? (
            <div className="empty-state">
              <Check size={40} color="var(--clr-primary)" />
              <h3>All stocked up!</h3>
              <p>No items are below their low-stock threshold</p>
            </div>
          ) : (
            <div className="two-col-cards">
            {lowStock.map((p) => (
              <div key={p.id} className="card low-stock">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <AlertTriangle size={18} color="var(--clr-danger)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    {p.nameHindi && <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-2)' }}>{p.nameHindi}</div>}
                    <div style={{ fontSize: '0.82rem', color: 'var(--clr-danger)', marginTop: 4 }}>
                      Stock: {fromMilli(p.currentQtyMilli).toFixed(2)} {UNIT_LABELS[p.unit]}
                      {' '}/ Threshold: {fromMilli(p.lowStockThresholdMilli)} {UNIT_LABELS[p.unit]}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: '0.8rem' }} onClick={() => addDraft(p)}>
                    <ClipboardList size={14} /> Add to List
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1, fontSize: '0.8rem' }} onClick={() => openReceive(p)}>
                    <Plus size={14} /> Add Stock
                  </button>
                </div>
              </div>
            ))}
            </div>
          )}
        </>
      )}

      {tab === 'drafts' && (
        <>
          {allDrafts.length === 0 ? (
            <div className="empty-state">
              <ClipboardList size={40} />
              <h3>No reorder drafts</h3>
              <p>Add items from the Low Stock tab to build your order list</p>
            </div>
          ) : (
            <>
              {pendingDrafts.length > 0 && (
                <>
                  <div className="section-title">Active Orders</div>
                  {pendingDrafts.map((d) => {
                    const p = productMap[d.productId];
                    if (!p) return null;
                    return (
                      <div key={d.id} className="card" style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>{p.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-2)', marginTop: 2 }}>
                              Requested: {fromMilli(d.requestedQtyMilli)} {UNIT_LABELS[p.unit]}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--clr-text-3)', marginTop: 2 }}>
                              {new Date(d.createdAt).toLocaleDateString('en-IN')}
                            </div>
                          </div>
                          {statusBadge(d.status)}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          {d.status !== 'received' && (
                            <button
                              className="btn btn-ghost"
                              style={{ flex: 1, fontSize: '0.8rem' }}
                              onClick={() => advanceStatus(d.id, d.status)}
                            >
                              {d.status === 'pending' ? <><Truck size={14} /> Mark Ordered</> : <><Check size={14} /> Mark Received</>}
                            </button>
                          )}
                          {d.status === 'ordered' && (
                            <button
                              className="btn btn-primary"
                              style={{ flex: 1, fontSize: '0.8rem' }}
                              onClick={() => openReceive(p)}
                            >
                              <Plus size={14} /> Add Stock
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {doneDrafts.length > 0 && (
                <>
                  <div className="section-title">Received</div>
                  {doneDrafts.map((d) => {
                    const p = productMap[d.productId];
                    if (!p) return null;
                    return (
                      <div key={d.id} className="card" style={{ marginBottom: 8, opacity: 0.6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div style={{ fontWeight: 600 }}>{p.name}</div>
                          {statusBadge(d.status)}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}
        </>
      )}

      {/* Stock In Sheet */}
      <BottomSheet open={sheet === 'stockIn'} onClose={() => { setSheet(null); setStockInProduct(null); }}>
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
