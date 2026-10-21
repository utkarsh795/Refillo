import React, { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { recordSale } from '../db/transactions';
import { newIdempotencyKey } from '../lib/idempotency';
import { UNIT_LABELS, fromMilli } from '../lib/quantity';
import { useProducts, useCategories } from '../hooks/useDb';
import { useToast } from '../components/ui/Toast';
import {
  Search,
  ShoppingCart,
  CheckCircle,
  Plus,
  Minus,
  Store,
} from 'lucide-react';
import type { Product, SaleLineItem } from '../db/schema';

interface CartEntry {
  product: Product;
  qtyMilli: number;
}

export function RecordSale() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const products = useProducts() ?? [];
  const categories = useCategories() ?? [];
  const idempotencyKey = useRef(newIdempotencyKey());

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [completedTxnId, setCompletedTxnId] = useState<string | null>(null);

  // Available in-stock products
  const availableProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.nameHindi && p.nameHindi.includes(searchTerm));
      const matchCategory = !selectedCategory || p.category === selectedCategory;
      return matchSearch && matchCategory && p.currentQtyMilli > 0;
    });
  }, [products, searchTerm, selectedCategory]);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((e) => e.product.id === product.id);
      const step = product.unit === 'kg' || product.unit === 'litre' ? 500 : 1000;
      if (existing) {
        const nextQty = existing.qtyMilli + step;
        if (nextQty > product.currentQtyMilli) {
          toast(`Cannot exceed available stock (${fromMilli(product.currentQtyMilli)} ${UNIT_LABELS[product.unit]})`, 'error');
          return prev;
        }
        return prev.map((e) =>
          e.product.id === product.id ? { ...e, qtyMilli: nextQty } : e
        );
      }
      return [...prev, { product, qtyMilli: step }];
    });
  }

  function updateCartQty(productId: string, newMilli: number) {
    const item = cart.find((e) => e.product.id === productId);
    if (!item) return;

    if (newMilli <= 0) {
      removeFromCart(productId);
      return;
    }

    if (newMilli > item.product.currentQtyMilli) {
      toast(`Only ${fromMilli(item.product.currentQtyMilli)} ${UNIT_LABELS[item.product.unit]} available in stock`, 'error');
      return;
    }

    setCart((prev) =>
      prev.map((e) => (e.product.id === productId ? { ...e, qtyMilli: newMilli } : e))
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((e) => e.product.id !== productId));
  }

  // Calculate cart total
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const price = item.product.sellingPrice ?? 0;
      return sum + price * fromMilli(item.qtyMilli);
    }, 0);
  }, [cart]);

  async function handleConfirmSale() {
    if (cart.length === 0) {
      toast('Cart is empty. Select products to sell.', 'info');
      return;
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
        totalAmount: cartTotal > 0 ? cartTotal : undefined,
        idempotencyKey: idempotencyKey.current,
      });

      setCompletedTxnId(txnId);
      toast('Sale successfully recorded!', 'success');
    } catch (err: any) {
      if (err?.message === 'DUPLICATE_SUBMISSION') {
        toast('Sale already processed', 'info');
      } else {
        toast(err?.message ?? 'Failed to record sale', 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  function handleStartNewSale() {
    idempotencyKey.current = newIdempotencyKey();
    setCart([]);
    setCompletedTxnId(null);
    setSearchTerm('');
  }

  // Success Confirmation Screen
  if (completedTxnId) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: 440, width: '100%', textAlign: 'center', padding: '36px 24px' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'var(--clr-primary-surface)',
              color: 'var(--clr-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <CheckCircle size={36} />
          </div>

          <h2 style={{ fontSize: '1.4rem', marginBottom: 4 }}>Bikri Darj Ho Gayi!</h2>
          <p style={{ color: 'var(--clr-text-3)', fontSize: '0.86rem', marginBottom: 16 }}>
            Sale recorded successfully & inventory updated.
          </p>

          <div
            style={{
              background: 'var(--clr-surface-2)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Amount
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--clr-primary)', marginTop: 2 }}>
              ₹{cartTotal.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-3)', marginTop: 4 }}>
              Txn ID: {completedTxnId.slice(0, 8)} · {cart.length} item{cart.length > 1 ? 's' : ''} sold
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/')}>
              Dashboard
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleStartNewSale}>
              <Plus size={16} /> New Sale
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Record Sale (बिक्री दर्ज करें)</h1>
          <p style={{ margin: 0, fontSize: '0.82rem' }}>
            Select products sold to customer and complete the sale in seconds.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => navigate('/history')}>
            View Sales History
          </button>
        </div>
      </div>

      {/* Two-column layout on Desktop, stacked on Mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Product Catalog & Search */}
        <div>
          {/* Soft-blue search bar */}
          <div className="search-bar">
            <Search size={18} />
            <input
              placeholder="Search product by name or हिंदी नाम…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
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

          {/* Category filter chips */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, marginBottom: 10, scrollbarWidth: 'none' }}>
            <button
              className={`tab-btn ${selectedCategory === '' ? 'active' : ''}`}
              style={{ flex: 'none', padding: '5px 12px', fontSize: '0.78rem' }}
              onClick={() => setSelectedCategory('')}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                className={`tab-btn ${selectedCategory === c ? 'active' : ''}`}
                style={{ flex: 'none', padding: '5px 12px', fontSize: '0.78rem' }}
                onClick={() => setSelectedCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Product Items to Click & Add */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto' }}>
            {availableProducts.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 16px' }}>
                <Store size={32} />
                <h3>No items available</h3>
                <p>No in-stock products matched your search or category filter.</p>
              </div>
            ) : (
              availableProducts.map((p) => {
                const inCart = cart.find((e) => e.product.id === p.id);
                const unit = UNIT_LABELS[p.unit] || p.unit;
                return (
                  <div
                    key={p.id}
                    className="product-card"
                    style={{
                      marginBottom: 0,
                      borderColor: inCart ? 'var(--clr-primary-action)' : 'var(--clr-border)',
                      background: inCart ? '#FAFDFB' : 'var(--clr-surface)',
                    }}
                    onClick={() => addToCart(p)}
                  >
                    <div className="product-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.94rem' }}>{p.name}</span>
                        {p.nameHindi && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--clr-text-3)' }}>({p.nameHindi})</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <span className="badge badge-gray" style={{ fontSize: '0.68rem' }}>{p.category}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-3)' }}>
                          Available: <strong>{fromMilli(p.currentQtyMilli)} {unit}</strong>
                        </span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 12 }}>
                      {p.sellingPrice ? (
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--clr-primary)' }}>
                          ₹{p.sellingPrice}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-3)' }}>No price</div>
                      )}

                      <button
                        className="btn btn-ghost"
                        style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(p);
                        }}
                      >
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Sale Summary & Confirmation Cart */}
        <div className="card" style={{ padding: '20px', border: '1px solid var(--clr-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingCart size={18} color="var(--clr-primary)" /> Customer Cart ({cart.length})
            </h3>
            {cart.length > 0 && (
              <button
                className="btn btn-ghost"
                style={{ padding: '4px 8px', fontSize: '0.72rem', color: 'var(--clr-status-crit)' }}
                onClick={() => setCart([])}
              >
                Clear Cart
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--clr-text-3)' }}>
              <ShoppingCart size={40} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Cart is empty</div>
              <p style={{ fontSize: '0.78rem', margin: '4px 0 0' }}>
                Tap on products from the left to add items to this sale.
              </p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '45vh', overflowY: 'auto', marginBottom: 16 }}>
                {cart.map((entry) => {
                  const p = entry.product;
                  const unit = UNIT_LABELS[p.unit] || p.unit;
                  const step = p.unit === 'kg' || p.unit === 'litre' ? 500 : 1000;
                  const itemSubtotal = (p.sellingPrice ?? 0) * fromMilli(entry.qtyMilli);

                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '10px 12px',
                        background: 'var(--clr-surface-2)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--clr-border)',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-3)', marginTop: 2 }}>
                          {p.sellingPrice ? `₹${p.sellingPrice} per ${unit}` : 'No rate set'}
                        </div>
                      </div>

                      {/* Quantity Stepper */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="qty-stepper" style={{ background: '#FFFFFF' }}>
                          <button
                            className="qty-stepper-btn"
                            onClick={() => updateCartQty(p.id, entry.qtyMilli - step)}
                          >
                            <Minus size={13} />
                          </button>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0 6px', minWidth: 38, textAlign: 'center' }}>
                            {fromMilli(entry.qtyMilli)}
                          </span>
                          <button
                            className="qty-stepper-btn"
                            onClick={() => updateCartQty(p.id, entry.qtyMilli + step)}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--clr-text-3)', minWidth: 26 }}>{unit}</span>
                      </div>

                      <div style={{ textAlign: 'right', minWidth: 60 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--clr-text)' }}>
                          ₹{itemSubtotal.toFixed(0)}
                        </div>
                        <button
                          onClick={() => removeFromCart(p.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--clr-status-crit)', cursor: 'pointer', fontSize: '0.72rem', padding: 0 }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Order Calculation Totals */}
              <div
                style={{
                  background: 'var(--clr-primary-surface)',
                  border: '1px solid rgba(71, 122, 90, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--clr-text-2)', marginBottom: 6 }}>
                  <span>Total Items</span>
                  <span>{cart.length} products</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--clr-text)' }}>Total Payable</span>
                  <span style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--clr-primary)' }}>
                    ₹{cartTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                className="btn btn-primary btn-full"
                style={{ padding: '12px', fontSize: '0.95rem' }}
                onClick={handleConfirmSale}
                disabled={saving}
              >
                {saving ? 'Recording Sale…' : 'Complete Sale & Update Stock'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
