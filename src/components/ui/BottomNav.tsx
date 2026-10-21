import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, RotateCcw } from 'lucide-react';
import { useLowStockProducts } from '../../hooks/useDb';

const MOBILE_NAV_ITEMS = [
  { to: '/',        icon: LayoutDashboard, label: 'Home' },
  { to: '/products',icon: Package,         label: 'Products' },
  { to: '/sale',    icon: ShoppingCart,    label: 'Sale' },
  { to: '/reorder', icon: RotateCcw,       label: 'Reorder' },
];

export function BottomNav() {
  const lowStock = useLowStockProducts() ?? [];

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Mobile navigation">
      {MOBILE_NAV_ITEMS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <div style={{ position: 'relative' }}>
            <Icon size={20} />
            {to === '/reorder' && lowStock.length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -8,
                  background: 'var(--clr-peach-action)',
                  color: '#FFFFFF',
                  borderRadius: 10,
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  padding: '1px 5px',
                  lineHeight: 1.2,
                }}
              >
                {lowStock.length}
              </span>
            )}
          </div>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
