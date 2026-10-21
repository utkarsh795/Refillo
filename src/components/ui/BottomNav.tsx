import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Package, RotateCcw, Clock, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/',        icon: Home,        label: 'Home' },
  { to: '/products',icon: Package,     label: 'Products' },
  { to: '/reorder', icon: RotateCcw,   label: 'Reorder' },
  { to: '/stale',   icon: Clock,       label: 'Stale' },
  { to: '/settings',icon: Settings,    label: 'Settings' },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
