import React, { useState } from 'react';
import { db } from '../db/schema';
import { useShopName, useCategories, useSetting } from '../hooks/useDb';
import { useToast } from '../components/ui/Toast';
import { Store, Trash2, Plus, ChevronRight, Moon, Wifi } from 'lucide-react';

export function Settings() {
  const { toast } = useToast();
  const shopName = useShopName();
  const categories = useCategories();
  const staleDays = useSetting<number>('staleDays', 30);
  const defaultLowThreshold = useSetting<number>('defaultLowStockThreshold', 5);

  const [editShopName, setEditShopName] = useState(shopName);
  const [editStaleDays, setEditStaleDays] = useState(staleDays.toString());
  const [editThreshold, setEditThreshold] = useState(defaultLowThreshold.toString());
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);

  async function saveSettings() {
    setSaving(true);
    try {
      await db.settings.bulkPut([
        { key: 'shopName', value: editShopName.trim() || 'My Kirana Store' },
        { key: 'staleDays', value: parseInt(editStaleDays) || 30 },
        { key: 'defaultLowStockThreshold', value: parseFloat(editThreshold) || 5 },
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
            value={editShopName}
            onChange={(e) => setEditShopName(e.target.value)}
            placeholder="My Kirana Store"
          />
        </div>
      </div>

      {/* Thresholds */}
      <div className="section-title">Thresholds</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="input-group">
          <label>Stale Item Threshold (days)</label>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min="1"
            value={editStaleDays}
            onChange={(e) => setEditStaleDays(e.target.value)}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-3)' }}>
            Items not sold in this many days appear in Stale Items
          </span>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label>Default Low Stock Threshold (units)</label>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.5"
            value={editThreshold}
            onChange={(e) => setEditThreshold(e.target.value)}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-3)' }}>
            Used for new products (each product can have its own threshold)
          </span>
        </div>
      </div>

      <button className="btn btn-primary btn-full" onClick={saveSettings} disabled={saving} style={{ marginBottom: 20 }}>
        {saving ? 'Saving…' : 'Save Settings'}
      </button>

      {/* Categories */}
      <div className="section-title">Categories</div>
      <div className="card" style={{ marginBottom: 16 }}>
        {categories.map((cat) => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--clr-border)' }}>
            <span style={{ fontWeight: 500 }}>{cat}</span>
            <button
              className="btn btn-ghost btn-icon"
              style={{ padding: 6 }}
              onClick={() => removeCategory(cat)}
              title="Remove category"
            >
              <Trash2 size={14} color="var(--clr-danger)" />
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            className="input"
            placeholder="New category name"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={addCategory}>
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* PWA Info */}
      <div className="section-title">App Info</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Moon size={16} color="var(--clr-primary)" />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Works Offline</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--clr-text-2)' }}>
              All data is stored locally. Internet only needed for first install.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Wifi size={16} color="var(--clr-text-3)" />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>No Account Required</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--clr-text-2)' }}>
              No login, no cloud, no subscription. Your data stays on your phone.
            </div>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="section-title">Danger Zone</div>
      <div className="card" style={{ marginBottom: 32, borderColor: 'rgba(248,113,113,0.25)' }}>
        <p style={{ fontSize: '0.82rem', marginBottom: 12 }}>
          Permanently delete all products, stock movements, and sale history. Cannot be undone.
        </p>
        <button className="btn btn-danger btn-full" onClick={clearAllData}>
          <Trash2 size={16} /> Clear All Data
        </button>
      </div>
    </div>
  );
}
