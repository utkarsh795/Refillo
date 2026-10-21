import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  RotateCcw,
  History,
  BarChart3,
  Settings,
  Store,
} from 'lucide-react';
import { useLowStockProducts, useShopName } from '../../hooks/useDb';

const NAV_ITEMS = [
  { to: '/',         icon: LayoutDashboard, label: 'Overview',      end: true },
  { to: '/products', icon: Package,         label: 'Products',      end: false },
  { to: '/sale',     icon: ShoppingCart,    label: 'Record Sale',   end: false },
  { to: '/reorder',  icon: RotateCcw,       label: 'Smart Reorder', end: false },
  { to: '/history',  icon: History,         label: 'Sales History', end: false },
  { to: '/reports',  icon: BarChart3,       label: 'Reports',       end: false },
  { to: '/settings', icon: Settings,        label: 'Settings',      end: false },
];

export function Sidebar() {
  const shopName = useShopName();
  const lowStock = useLowStockProducts() ?? [];

  return (
    <aside className="sidebar" aria-label="Main Navigation">
      {/* Brand Header */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Store size={22} color="#FFFFFF" />
        </div>
        <div>
          <div className="sidebar-logo-text">KiranaSaathi</div>
          <div className="sidebar-logo-tagline">Dukaan ka hisaab, ab aasaan.</div>
        </div>
      </div>

      {/* Navigation Section */}
      <div className="sidebar-section-label">Menu</div>
      <nav style={{ display: 'flex', flexDirection: 'column' }}>
        {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
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
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="shop-indicator">
          <div className="status-dot" />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shopName}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <span>100% Offline PWA</span>
          <span style={{ color: 'var(--clr-primary)', fontWeight: 600 }}>v2.0</span>
        </div>
      </div>
    </aside>
  );
}
