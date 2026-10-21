import React, { useState, useEffect, useMemo } from 'react';
import { useShopName } from '../../hooks/useDb';
import { Store, Wifi, WifiOff, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  onOpenSaleModal?: () => void;
}

export function TopBar({ onOpenSaleModal }: Props) {
  const shopName = useShopName();
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(new Date());
  }, []);

  return (
    <header className="app-topbar">
      <div className="topbar-branding">
        {/* On mobile: show small KiranaSaathi icon */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--clr-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
          }}
        >
          <Store size={18} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--clr-text)', lineHeight: 1.15 }}>
            {shopName}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{todayStr}</span>
            <span>·</span>
            <span style={{ color: 'var(--clr-primary)', fontWeight: 600 }}>KiranaSaathi</span>
          </div>
        </div>
      </div>

      <div className="topbar-actions">
        {/* Real Online / Offline status badge */}
        <div className={`topbar-status-pill ${online ? '' : 'offline'}`} title={online ? 'Connected to local storage & web' : 'Operating fully offline'}>
          {online ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span>{online ? 'Online' : 'Offline'}</span>
        </div>

        {/* Quick sale button */}
        {onOpenSaleModal ? (
          <button
            className="btn btn-primary"
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            onClick={onOpenSaleModal}
          >
            <ShoppingCart size={14} /> Record Sale
          </button>
        ) : (
          <Link
            to="/sale"
            className="btn btn-primary"
            style={{ padding: '6px 14px', fontSize: '0.8rem', textDecoration: 'none' }}
          >
            <ShoppingCart size={14} /> Record Sale
          </Link>
        )}
      </div>
    </header>
  );
}
