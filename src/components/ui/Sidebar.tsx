import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home, Package, RotateCcw, Clock, Settings, Store
} from 'lucide-react';
import { useLowStockProducts, useShopName } from '../../hooks/useDb';

const NAV = [
  { to: '/',         icon: Home,       label: 'Home',     end: true },
  { to: '/products', icon: Package,    label: 'Products', end: false },
  { to: '/reorder',  icon: RotateCcw,  label: 'Reorder',  end: false },
  { to: '/stale',    icon: Clock,      label: 'Stale Items', end: false },
  { to: '/settings', icon: Settings,   label: 'Settings', end: false },
];

export function Sidebar() {
  const shopName  = useShopName();
  const lowStock  = useLowStockProducts() ?? [];

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Store size={18} color="#052e16" />
        </div>
        <div>
          <div className="sidebar-logo-text">Refillo</div>
          <div className="sidebar-logo-sub" style={{ maxWidth: 148, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shopName}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="sidebar-section-label">Navigation</div>
      {NAV.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `sidebar-nav-item ${isActive ? 'active' : ''}`
          }
        >
          <Icon size={18} />
          <span style={{ flex: 1 }}>{label}</span>
          {to === '/reorder' && lowStock.length > 0 && (
            <span className="sidebar-badge">{lowStock.length}</span>
          )}
        </NavLink>
      ))}

      {/* Footer */}
      <div className="sidebar-footer">
        <div style={{ fontWeight: 600, marginBottom: 2 }}>Refillo v1.0</div>
        <div>Offline-first · No login needed</div>
      </div>
    </aside>
  );
}
