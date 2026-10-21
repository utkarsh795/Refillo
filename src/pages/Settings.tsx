import React, { useState } from 'react';
import { db } from '../db/schema';
import { useShopName, useCategories, useSetting } from '../hooks/useDb';
import { useToast } from '../components/ui/Toast';
import { Trash2, Plus } from 'lucide-react';

export function Settings() {
  const { toast } = useToast();
  const shopName = useShopName();
  const categories = useCategories();
  const staleDays = useSetting<number>('staleDays', 30);
  const staleGracePeriodDays = useSetting<number>('staleGracePeriodDays', 14);
  const supplierLeadTimeDays = useSetting<number>('supplierLeadTimeDays', 3);
  const safetyStockDays = useSetting<number>('safetyStockDays', 7);
  const defaultLowThreshold = useSetting<number>('defaultLowStockThreshold', 5);

  const [editShopName, setEditShopName] = useState<string | null>(null);
  const [editStaleDays, setEditStaleDays] = useState<string | null>(null);
  const [editGracePeriod, setEditGracePeriod] = useState<string | null>(null);
  const [editLeadTime, setEditLeadTime] = useState<string | null>(null);
  const [editSafetyStock, setEditSafetyStock] = useState<string | null>(null);
  const [editThreshold, setEditThreshold] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const currentShopName = editShopName !== null ? editShopName : shopName;
  const currentStaleDays = editStaleDays !== null ? editStaleDays : staleDays.toString();
  const currentGracePeriod = editGracePeriod !== null ? editGracePeriod : staleGracePeriodDays.toString();
  const currentLeadTime = editLeadTime !== null ? editLeadTime : supplierLeadTimeDays.toString();
  const currentSafetyStock = editSafetyStock !== null ? editSafetyStock : safetyStockDays.toString();
  const currentThreshold = editThreshold !== null ? editThreshold : defaultLowThreshold.toString();

  async function saveSettings() {
    setSaving(true);
    try {
      await db.settings.bulkPut([
        { key: 'shopName', value: currentShopName.trim() || 'My Kirana Store' },
        { key: 'staleDays', value: parseInt(currentStaleDays, 10) || 30 },
        { key: 'staleGracePeriodDays', value: parseInt(currentGracePeriod, 10) || 14 },
        { key: 'supplierLeadTimeDays', value: parseInt(currentLeadTime, 10) || 3 },
        { key: 'safetyStockDays', value: parseInt(currentSafetyStock, 10) || 7 },
        { key: 'defaultLowStockThreshold', value: parseFloat(currentThreshold) || 5 },
      ]);
      toast('Settings saved!', 'success');
    } catch {
      toast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function addCategory() {
    const cat = newCategory.trim();
    if (!cat) return;
    if (categories.includes(cat)) { toast('Category already exists', 'info'); return; }
    await db.settings.put({ key: 'categories', value: [...categories, cat] });
    setNewCategory('');
    toast(`Category "${cat}" added`, 'success');
  }

  async function removeCategory(cat: string) {
    const updated = categories.filter((c) => c !== cat);
    await db.settings.put({ key: 'categories', value: updated });
    toast(`Category "${cat}" removed`, 'success');
  }

  async function clearAllData() {
    if (!window.confirm('Delete ALL data? This cannot be undone.')) return;
    await db.products.clear();
    await db.stockMovements.clear();
    await db.saleTxns.clear();
    await db.reorderDrafts.clear();
    toast('All data cleared', 'info');
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      {/* Shop Info */}
      <div className="section-title">Shop Info</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label>Shop Name</label>
          <input
            className="input"
            value={currentShopName}
            onChange={(e) => setEditShopName(e.target.value)}
            placeholder="My Kirana Store"
          />
        </div>
      </div>

      {/* Reorder & Restock Thresholds */}
      <div className="section-title">Reorder & Restock Settings</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="input-group">
            <label>Supplier Lead Time (days)</label>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min="1"
              value={currentLeadTime}
              onChange={(e) => setEditLeadTime(e.target.value)}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--clr-text-3)' }}>
              Days taken for supplier delivery
            </span>
          </div>

          <div className="input-group">
            <label>Safety Stock Buffer (days)</label>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min="1"
              value={currentSafetyStock}
              onChange={(e) => setEditSafetyStock(e.target.value)}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--clr-text-3)' }}>
              Extra stock buffer to avoid stockouts
            </span>
          </div>
        </div>

        <div className="input-group">
          <label>Default Low Stock Threshold (units)</label>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.5"
            value={currentThreshold}
            onChange={(e) => setEditThreshold(e.target.value)}
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--clr-text-3)' }}>
            Initial restock alert threshold for newly added products
          </span>
        </div>
      </div>

      {/* Slow / Dead Stock Thresholds */}
      <div className="section-title">Slow & Dead Stock Rules</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="input-group">
            <label>Stale Threshold (days)</label>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min="1"
              value={currentStaleDays}
              onChange={(e) => setEditStaleDays(e.target.value)}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--clr-text-3)' }}>
              No sales for this many days flags item as slow moving (default 30)
            </span>
          </div>

          <div className="input-group">
            <label>New Product Grace Period (days)</label>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min="1"
              value={currentGracePeriod}
              onChange={(e) => setEditGracePeriod(e.target.value)}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--clr-text-3)' }}>
              Grace window before an unsold new item is flagged as dead stock (default 14)
            </span>
          </div>
        </div>
      </div>

      <button className="btn btn-primary btn-full" onClick={saveSettings} disabled={saving} style={{ marginBottom: 20 }}>
        {saving ? 'Saving…' : 'Save Settings'}
      </button>

      {/* Categories */}
      <div className="section-title">Categories</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            className="input"
            placeholder="New category name"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
          />
          <button className="btn btn-primary btn-icon" onClick={addCategory}>
            <Plus size={18} />
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {categories.map((cat) => (
            <div
              key={cat}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--clr-surface-2)',
                border: '1px solid var(--clr-border)',
                borderRadius: 100,
                padding: '4px 10px',
                fontSize: '0.82rem',
              }}
            >
              <span>{cat}</span>
              <button
                onClick={() => removeCategory(cat)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--clr-text-3)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="section-title" style={{ color: 'var(--clr-danger)' }}>Danger Zone</div>
      <div className="card" style={{ borderColor: 'rgba(248,113,113,0.3)', marginBottom: 24 }}>
        <p style={{ fontSize: '0.85rem', marginBottom: 12 }}>
          Clear all products, sales history, stock movements, and drafts. Use for testing or a clean reset.
        </p>
        <button className="btn btn-danger" onClick={clearAllData}>
          <Trash2 size={16} /> Clear All Data
        </button>
      </div>
    </div>
  );
}
