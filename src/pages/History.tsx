import React, { useState, useMemo } from 'react';
import { useAllSales } from '../hooks/useDb';
import { reverseSale } from '../db/transactions';
import { fromMilli, UNIT_LABELS } from '../lib/quantity';
import { useToast } from '../components/ui/Toast';
import { History as HistoryIcon, RotateCcw, Search, ShoppingBag, Receipt } from 'lucide-react';
import type { SaleTxn } from '../db/schema';

export function History() {
  const { toast } = useToast();
  const sales = useAllSales() ?? [];
  const [searchTerm, setSearchTerm] = useState('');
  const [reversingId, setReversingId] = useState<string | null>(null);

  const filteredSales = useMemo(() => {
    if (!searchTerm) return sales;
    const term = searchTerm.toLowerCase();
    return sales.filter((s) => {
      const matchItem = s.items.some((i) => i.productName.toLowerCase().includes(term));
      const matchId = s.id.toLowerCase().includes(term);
      return matchItem || matchId;
    });
  }, [sales, searchTerm]);

  const totalRevenue = useMemo(() => {
    return sales.reduce((sum, s) => sum + (s.totalAmount ?? 0), 0);
  }, [sales]);

  async function handleReverseSale(txn: SaleTxn) {
    if (!window.confirm(`Reverse this sale of ₹${(txn.totalAmount ?? 0).toFixed(0)}? Stock will be restored.`)) {
      return;
    }

    setReversingId(txn.id);
    try {
      await reverseSale(txn.id);
      toast('Sale reversed and inventory restored!', 'success');
    } catch (err: any) {
      toast(err?.message ?? 'Failed to reverse sale', 'error');
    } finally {
      setReversingId(null);
    }
  }

  function formatDateTime(d: Date | string) {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(d));
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Sales History (बिक्री इतिहास)</h1>
          <p style={{ margin: 0, fontSize: '0.82rem' }}>
            Complete audit trail of all recorded store sales and stock deductions.
          </p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="metric-card card-green">
          <div className="metric-header">
            <span className="metric-label">Total Revenue</span>
            <div className="metric-icon-wrap"><Receipt size={18} /></div>
          </div>
          <div className="metric-val">₹{totalRevenue.toFixed(0)}</div>
          <div className="metric-sub">Across all recorded transactions</div>
        </div>

        <div className="metric-card card-lavender">
          <div className="metric-header">
            <span className="metric-label">Total Transactions</span>
            <div className="metric-icon-wrap"><HistoryIcon size={18} /></div>
          </div>
          <div className="metric-val">{sales.length}</div>
          <div className="metric-sub">Customer checkouts recorded</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-bar" style={{ maxWidth: 480, marginBottom: 16 }}>
        <Search size={16} />
        <input
          placeholder="Search by product name in transactions…"
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

      {/* Sales Transactions List */}
      {filteredSales.length === 0 ? (
        <div className="empty-state">
          <ShoppingBag size={40} />
          <h3>No sales records found</h3>
          <p>
            {searchTerm
              ? 'No transactions matched your search query.'
              : 'Start by recording customer sales from the Record Sale page.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredSales.map((txn) => {
            return (
              <div
                key={txn.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  padding: '16px 18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: 'var(--clr-primary-surface)',
                        color: 'var(--clr-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Receipt size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                        ₹{(txn.totalAmount ?? 0).toFixed(2)}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-3)' }}>
                        Txn #{txn.id.slice(0, 8)} · {formatDateTime(txn.createdAt)}
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '0.75rem', padding: '5px 10px', color: 'var(--clr-status-crit)' }}
                    onClick={() => handleReverseSale(txn)}
                    disabled={reversingId === txn.id}
                  >
                    <RotateCcw size={13} /> {reversingId === txn.id ? 'Reversing…' : 'Reverse Sale'}
                  </button>
                </div>

                {/* Line items table */}
                <div
                  style={{
                    background: 'var(--clr-surface-2)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                  }}
                >
                  {txn.items.map((item, idx) => {
                    const unit = UNIT_LABELS[item.unit] || item.unit;
                    const subtotal = (item.sellingPrice ?? 0) * fromMilli(item.qtyMilli);
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '4px 0',
                          borderBottom: idx < txn.items.length - 1 ? '1px dashed var(--clr-border)' : 'none',
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>
                          {item.productName} × {fromMilli(item.qtyMilli)} {unit}
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--clr-text)' }}>
                          {item.sellingPrice ? `₹${subtotal.toFixed(0)}` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
