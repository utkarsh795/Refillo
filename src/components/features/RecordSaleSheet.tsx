import React, { useState, useRef } from 'react';
import { recordSale } from '../../db/transactions';
import { newIdempotencyKey } from '../../lib/idempotency';
import { parseQty, UNIT_LABELS } from '../../lib/quantity';
import { useProducts } from '../../hooks/useDb';
import { useToast } from '../ui/Toast';
import { Search, Trash2, X, ShoppingCart, CheckCircle } from 'lucide-react';
import type { Product } from '../../db/schema';
import type { SaleLineItem } from '../../db/schema';

interface CartEntry {
  product: Product;
  qtyMilli: number;
}

interface Props {
  onClose: () => void;
}

type Step = 'build' | 'confirm' | 'success';

export function RecordSaleSheet({ onClose }: Props) {
  const { toast } = useToast();
  const products = useProducts();
  const idempotencyKey = useRef(newIdempotencyKey());

  const [step, setStep] = useState<Step>('build');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastTxnId, setLastTxnId] = useState<string>('');

  const filtered = (products ?? []).filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.nameHindi && p.nameHindi.includes(search));
    return matchSearch && p.currentQtyMilli > 0;
  }).slice(0, 30);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((e) => e.product.id === product.id);
      if (existing) {
        return prev.map((e) =>
          e.product.id === product.id
            ? { ...e, qtyMilli: e.qtyMilli + 1000 }
            : e
        );
      }
      return [...prev, { product, qtyMilli: 1000 }];
    });
    setSearch('');
  }

  function updateCartQty(productId: string, rawVal: string) {
    const n = parseQty(rawVal);
    if (!isNaN(n) && n > 0) {
      setCart((prev) => prev.map((e) =>
        e.product.id === productId ? { ...e, qtyMilli: n } : e
      ));
    } else if (rawVal === '' || rawVal === '0') {
      setCart((prev) => prev.filter((e) => e.product.id !== productId));
    }
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((e) => e.product.id !== productId));
  }

  const total = cart.reduce((sum, e) => {
    const price = e.product.sellingPrice ?? 0;
    const qty = e.qtyMilli / 1000;
    return sum + price * qty;
  }, 0);

  async function handleConfirm() {
    if (saving) return;
    if (cart.length === 0) { toast('Cart is empty', 'error'); return; }

    // Validate stock
    for (const entry of cart) {
      if (entry.qtyMilli > entry.product.currentQtyMilli) {
        toast(`Not enough stock for ${entry.product.name}`, 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const items: SaleLineItem[] = cart.map((e) => ({
        productId: e.product.id,
        productName: e.product.name,
        qtyMilli: e.qtyMilli,
        unit: e.product.unit,
        sellingPrice: e.product.sellingPrice,
      }));

      const txnId = await recordSale({
        items,
        totalAmount: total > 0 ? total : undefined,
        idempotencyKey: idempotencyKey.current,
      });

      setLastTxnId(txnId);
      setStep('success');
    } catch (e: any) {
      if (e?.message === 'DUPLICATE_SUBMISSION') {
        toast('Sale already recorded', 'info');
      } else {
        toast(e?.message ?? 'Failed to record sale', 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  if (step === 'success') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 0' }}>
        <CheckCircle size={56} color="var(--clr-primary)" />
        <div style={{ textAlign: 'center' }}>
          <h2>Sale Recorded!</h2>
          {total > 0 && (
            <p style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--clr-primary)', marginTop: 4 }}>
              ₹{total.toFixed(2)}
            </p>
          )}
          <p style={{ marginTop: 8 }}>{cart.length} item{cart.length > 1 ? 's' : ''} sold</p>
        </div>
        <button className="btn btn-primary" onClick={onClose} style={{ width: '100%', maxWidth: 280 }}>
          Done
        </button>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span className="sheet-title" style={{ margin: 0 }}>Confirm Sale</span>
          <button className="btn btn-ghost btn-icon" onClick={() => setStep('build')}><X size={18} /></button>
        </div>

        <div>
          {cart.map((e) => (
            <div key={e.product.id} className="cart-item">
              <div className="cart-item-name">{e.product.name}</div>
              <div style={{ textAlign: 'right' }}>
                <div className="cart-item-meta">{(e.qtyMilli / 1000).toFixed(2)} {UNIT_LABELS[e.product.unit]}</div>
                {e.product.sellingPrice && (
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--clr-primary)' }}>
                    ₹{(e.product.sellingPrice * e.qtyMilli / 1000).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {total > 0 && (
          <>
            <div className="divider" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 600 }}>Total</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--clr-primary)' }}>₹{total.toFixed(2)}</span>
            </div>
          </>
        )}

        <button
          className="btn btn-primary btn-full"
          onClick={handleConfirm}
          disabled={saving}
          id="confirm-sale-btn"
        >
          {saving ? 'Recording…' : '✓ Record Sale'}
        </button>
      </div>
    );
  }

  // Build step
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span className="sheet-title" style={{ margin: 0 }}>Record Sale</span>
        <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="search-bar">
        <Search size={16} />
        <input
          placeholder="Search & add item…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {search && (
        <div style={{ marginBottom: 12 }}>
          {filtered.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--clr-text-3)', fontSize: '0.85rem', padding: '12px 0' }}>
              No items found
            </p>
          ) : (
            filtered.map((p) => (
              <div key={p.id} className="product-card" onClick={() => addToCart(p)}>
                <div className="product-info">
                  <div className="product-name">{p.name}</div>
                  {p.nameHindi && <div className="product-hindi">{p.nameHindi}</div>}
                </div>
                <div className="product-qty">
                  <div className="product-qty-val">{(p.currentQtyMilli / 1000).toFixed(1)}</div>
                  <div className="product-qty-unit">{UNIT_LABELS[p.unit]}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Cart */}
      {cart.length > 0 && (
        <>
          <div className="section-title" style={{ margin: '8px 0 10px' }}>Cart ({cart.length} items)</div>
          {cart.map((e) => (
            <div key={e.product.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--clr-border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{e.product.name}</div>
                {e.product.sellingPrice && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--clr-text-3)' }}>
                    @₹{e.product.sellingPrice}/{UNIT_LABELS[e.product.unit]}
                  </div>
                )}
              </div>
              <div className="qty-row" style={{ flexShrink: 0 }}>
                <button className="qty-btn" onClick={() => {
                  const newMilli = e.qtyMilli - 1000;
                  if (newMilli <= 0) removeFromCart(e.product.id);
                  else setCart((prev) => prev.map((c) => c.product.id === e.product.id ? { ...c, qtyMilli: newMilli } : c));
                }}>−</button>
                <input
                  className="qty-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  value={e.qtyMilli / 1000}
                  onChange={(ev) => updateCartQty(e.product.id, ev.target.value)}
                />
                <button className="qty-btn" onClick={() => {
                  setCart((prev) => prev.map((c) => c.product.id === e.product.id ? { ...c, qtyMilli: c.qtyMilli + 1000 } : c));
                }}>+</button>
              </div>
              <button className="btn btn-ghost btn-icon" style={{ padding: 6 }} onClick={() => removeFromCart(e.product.id)}>
                <Trash2 size={15} color="var(--clr-danger)" />
              </button>
            </div>
          ))}

          <div className="divider" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ color: 'var(--clr-text-2)', fontSize: '0.88rem' }}>
              {cart.length} item{cart.length > 1 ? 's' : ''}
            </span>
            {total > 0 && (
              <span style={{ fontWeight: 700, color: 'var(--clr-primary)' }}>₹{total.toFixed(2)}</span>
            )}
          </div>
          <button className="btn btn-primary btn-full" onClick={() => setStep('confirm')}>
            <ShoppingCart size={16} />
            Review & Confirm
          </button>
        </>
      )}

      {cart.length === 0 && !search && (
        <div className="empty-state" style={{ padding: '24px 0' }}>
          <ShoppingCart size={36} />
          <p>Search above to add items to the sale</p>
        </div>
      )}
    </div>
  );
}
