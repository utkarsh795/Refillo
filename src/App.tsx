import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { BottomNav } from './components/ui/BottomNav';
import { Sidebar } from './components/ui/Sidebar';
import { Home } from './pages/Home';
import { Products } from './pages/Products';
import { Reorder } from './pages/Reorder';
import { StaleItems } from './pages/StaleItems';
import { Settings } from './pages/Settings';
import { seedDemoData } from './db/seed';
import { WifiOff } from 'lucide-react';

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online',  on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="offline-banner">
      <WifiOff size={13} />
      Offline — all features still work
    </div>
  );
}

function InstallPrompt() {
  const [prompt, setPrompt]       = useState<any>(null);
  const [dismissed, setDismissed] = useState(
    () => !!localStorage.getItem('installDismissed')
  );

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!prompt || dismissed) return null;

  return (
    <div className="install-prompt" style={{ margin: '0 16px', marginTop: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Install Refillo</div>
        <p>Add to home screen — works fully offline!</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          className="btn btn-primary"
          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          onClick={() => { prompt.prompt(); setDismissed(true); }}
        >
          Install
        </button>
        <button
          className="btn btn-ghost"
          style={{ padding: '4px 12px', fontSize: '0.75rem' }}
          onClick={() => { setDismissed(true); localStorage.setItem('installDismissed', '1'); }}
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

        {/* Main content */}
        <div className="main-content">
          <InstallPrompt />
          <Routes>
            <Route path="/"          element={<Home />} />
            <Route path="/products"  element={<Products />} />
            <Route path="/reorder"   element={<Reorder />} />
            <Route path="/stale"     element={<StaleItems />} />
            <Route path="/settings"  element={<Settings />} />
          </Routes>
        </div>
      </div>

      {/* Bottom nav — visible on <900px via CSS */}
      <BottomNav />
    </div>
  );
}
