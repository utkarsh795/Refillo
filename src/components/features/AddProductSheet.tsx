import React, { useState } from 'react';
import { db, newProduct } from '../../db/schema';
import { setOpeningStock } from '../../db/transactions';
import { parseQty, UNITS, UNIT_LABELS, toMilli } from '../../lib/quantity';
import { useCategories } from '../../hooks/useDb';
import { useToast } from '../ui/Toast';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function AddProductSheet({ onClose }: Props) {
  const categories = useCategories();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [nameHindi, setNameHindi] = useState('');
  const [category, setCategory] = useState(categories[0] ?? 'Other');
  const [unit, setUnit] = useState<'piece' | 'kg' | 'litre' | 'packet'>('piece');
  const [openingQty, setOpeningQty] = useState('0');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [barcode, setBarcode] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { toast('Product name is required', 'error'); return; }
    const openingMilli = parseQty(openingQty || '0');
    const thresholdMilli = parseQty(lowStockThreshold || '5');
    if (isNaN(openingMilli)) { toast('Invalid opening quantity', 'error'); return; }

    setSaving(true);
    try {
      const product = newProduct({
        name: name.trim(),
        nameHindi: nameHindi.trim() || undefined,
        category,
        unit,
        purchaseCost: purchaseCost ? parseFloat(purchaseCost) : undefined,
        sellingPrice: sellingPrice ? parseFloat(sellingPrice) : undefined,
        lowStockThresholdMilli: isNaN(thresholdMilli) ? toMilli(5) : thresholdMilli,
        barcode: barcode.trim() || undefined,
      });
      await db.products.add(product);
      if (openingMilli > 0) {
        await setOpeningStock(product.id, openingMilli);
      }
      toast(`${product.name} added!`, 'success');
      onClose();
    } catch (e: any) {
      toast(e?.message ?? 'Failed to add product', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <span className="sheet-title" style={{ margin: 0 }}>Add Product</span>
        <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="input-group">
        <label>Product Name *</label>
        <input className="input" placeholder="e.g. Tata Salt" value={name}
          onChange={(e) => setName(e.target.value)} autoFocus />
      </div>

      <div className="input-group">
        <label>Hindi Name (optional)</label>
        <input className="input" placeholder="हिंदी नाम" value={nameHindi}
          onChange={(e) => setNameHindi(e.target.value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="input-group">
          <label>Category</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label>Unit</label>
          <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as any)}>
            {UNITS.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]} ({u})</option>)}
          </select>
        </div>
      </div>

      <div className="input-group">
        <label>Opening Stock ({UNIT_LABELS[unit]})</label>
        <input className="input" type="number" inputMode="decimal" min="0" step="0.5"
          placeholder="0" value={openingQty} onChange={(e) => setOpeningQty(e.target.value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="input-group">
          <label>Purchase Cost (₹)</label>
          <input className="input" type="number" inputMode="decimal" min="0" step="0.5"
            placeholder="Optional" value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} />
        </div>
        <div className="input-group">
          <label>Selling Price (₹)</label>
          <input className="input" type="number" inputMode="decimal" min="0" step="0.5"
            placeholder="Optional" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} />
        </div>
      </div>

      <div className="input-group">
        <label>Low Stock Alert (below {UNIT_LABELS[unit]})</label>
        <input className="input" type="number" inputMode="decimal" min="0"
          placeholder="5" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
      </div>

      <div className="input-group">
        <label>Barcode (optional — for future scanning)</label>
        <input className="input" placeholder="Scan or type barcode" value={barcode}
          onChange={(e) => setBarcode(e.target.value)} />
      </div>

      <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving} style={{ marginTop: 8 }}>
        {saving ? 'Saving…' : 'Add Product'}
      </button>
    </div>
  );
}
