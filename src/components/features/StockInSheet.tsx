import React, { useState } from 'react';
import { receiveStock } from '../../db/transactions';
import { parseQty, UNIT_LABELS } from '../../lib/quantity';
import { useProducts } from '../../hooks/useDb';
import { useToast } from '../ui/Toast';
import { Search, Package, X } from 'lucide-react';
import type { Product } from '../../db/schema';

interface Props {
  /** Pre-select a product (from reorder flow) */
  preSelectedProduct?: Product;
  onClose: () => void;
}

export function StockInSheet({ preSelectedProduct, onClose }: Props) {
  const { toast } = useToast();
  const products = useProducts();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Product | null>(preSelectedProduct ?? null);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [cartonPieces, setCartonPieces] = useState('');
  const [useCarton, setUseCarton] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = (products ?? []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.nameHindi && p.nameHindi.includes(search))
  ).slice(0, 20);

  function handleSelect(p: Product) {
    setSelected(p);
    setSearch('');
    setQty('');
  }

  function effectiveQty(): number {
    const base = parseFloat(qty || '0');
    if (useCarton && cartonPieces) {
      return base * parseFloat(cartonPieces);
    }
    return base;
  }

  async function handleConfirm() {
    if (!selected) { toast('Select a product', 'error'); return; }
    const effective = effectiveQty();
    if (isNaN(effective) || effective <= 0) { toast('Enter a valid quantity', 'error'); return; }

    const qtyMilli = parseQty(effective.toString());
    if (isNaN(qtyMilli)) { toast('Invalid quantity', 'error'); return; }

    setSaving(true);
    try {
      await receiveStock({
        productId: selected.id,
        qtyMilli,
        note: note.trim() || undefined,
        type: 'received',
      });
      toast(`+${effective} ${UNIT_LABELS[selected.unit]} of ${selected.name} added!`, 'success');
      onClose();
    } catch (e: any) {
      toast(e?.message ?? 'Failed to update stock', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <span className="sheet-title" style={{ margin: 0 }}>Add Stock</span>
        <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
      </div>

      {!selected ? (
        <>
          <div className="search-bar">
            <Search size={16} />
            <input autoFocus placeholder="Search product…" value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          {search && filtered.length === 0 && (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <Package size={32} />
              <p>No products match "{search}"</p>
            </div>
          )}
          {filtered.map((p) => (
            <div key={p.id} className="product-card" onClick={() => handleSelect(p)}>
              <div className="product-icon">
                {categoryEmoji(p.category)}
              </div>
              <div className="product-info">
                <div className="product-name">{p.name}</div>
                {p.nameHindi && <div className="product-hindi">{p.nameHindi}</div>}
              </div>
              <div className="product-qty">
                <div className="product-qty-val">{(p.currentQtyMilli / 1000).toFixed(1)}</div>
                <div className="product-qty-unit">{UNIT_LABELS[p.unit]}</div>
              </div>
            </div>
          ))}
        </>
      ) : (
        <>
          {/* Selected product */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{selected.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-2)' }}>
                  Current: {(selected.currentQtyMilli / 1000).toFixed(2)} {UNIT_LABELS[selected.unit]}
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelected(null)} style={{ fontSize: '0.75rem' }}>
                Change
              </button>
            </div>
          </div>

          <div className="input-group">
            <label>Quantity Received ({UNIT_LABELS[selected.unit]})</label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.5"
              placeholder="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
              style={{ fontSize: '1.2rem', fontWeight: 700 }}
            />
          </div>

          {/* Carton conversion helper */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--clr-text-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={useCarton} onChange={(e) => setUseCarton(e.target.checked)}
                style={{ accentColor: 'var(--clr-primary)' }} />
              Entering cartons? Set pieces per carton
            </label>
            {useCarton && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="input" type="number" inputMode="numeric" min="1" step="1"
                  placeholder="e.g. 12" value={cartonPieces}
                  onChange={(e) => setCartonPieces(e.target.value)}
                  style={{ flex: 1 }} />
                <span style={{ color: 'var(--clr-text-2)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                  {qty && cartonPieces
                    ? `= ${effectiveQty()} ${UNIT_LABELS[selected.unit]}`
                    : `${UNIT_LABELS[selected.unit]} per carton`}
                </span>
              </div>
            )}
          </div>

          <div className="input-group">
            <label>Note (optional)</label>
            <input className="input" placeholder="e.g. Supplier: Ramesh" value={note}
              onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="divider" />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ color: 'var(--clr-text-2)', fontSize: '0.88rem' }}>Stock to add</span>
            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--clr-primary)' }}>
              +{isNaN(effectiveQty()) ? 0 : effectiveQty()} {UNIT_LABELS[selected.unit]}
            </span>
          </div>

          <button className="btn btn-primary btn-full" onClick={handleConfirm} disabled={saving || !qty}>
            {saving ? 'Saving…' : 'Confirm Stock In'}
          </button>
        </>
      )}
    </div>
  );
}

function categoryEmoji(category: string): string {
  const map: Record<string, string> = {
    Staples: '🌾', Dairy: '🥛', Snacks: '🍿', Beverages: '☕',
    Household: '🧹', 'Personal Care': '🪥', Other: '📦',
  };
  return map[category] ?? '📦';
}
