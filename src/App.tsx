import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { BottomNav } from './components/ui/BottomNav';
import { Sidebar } from './components/ui/Sidebar';
import { TopBar } from './components/ui/TopBar';
import { Home } from './pages/Home';
import { Products } from './pages/Products';
import { RecordSale } from './pages/RecordSale';
import { Reorder } from './pages/Reorder';
import { History } from './pages/History';
import { Reports } from './pages/Reports';
import { StaleItems } from './pages/StaleItems';
import { Settings } from './pages/Settings';
import { seedDemoData } from './db/seed';
import { WifiOff } from 'lucide-react';

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="offline-banner">
      <WifiOff size={13} />
      Operating 100% Offline — All inventory and sales features are active
    </div>
  );
}

function InstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(
    () => !!localStorage.getItem('installDismissed')
  );

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!prompt || dismissed) return null;

  return (
    <div className="install-prompt" style={{ margin: '12px 16px 0' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--clr-primary)' }}>
          Install KiranaSaathi
        </div>
        <p>Add to your phone or desktop home screen — works fully offline!</p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary"
          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          onClick={() => {
            prompt.prompt();
            setDismissed(true);
          }}
        >
          Install
        </button>
        <button
          className="btn btn-ghost"
          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
          onClick={() => {
            setDismissed(true);
            localStorage.setItem('installDismissed', '1');
          }}
        >
          Later
        </button>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    seedDemoData().catch(console.error);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <OfflineBanner />

      <div className="app-layout">
        {/* Sidebar — visible on ≥900px via CSS */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="main-content">
          <TopBar />
          <InstallPrompt />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<Products />} />
            <Route path="/sale" element={<RecordSale />} />
            <Route path="/reorder" element={<Reorder />} />
            <Route path="/history" element={<History />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/stale" element={<StaleItems />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>

      {/* Bottom Nav — visible on <900px via CSS */}
      <BottomNav />
    </div>
  );
}
