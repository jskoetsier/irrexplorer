import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [headerSearch, setHeaderSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const isHome = location.pathname === '/';

  const handleHeaderSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headerSearch.trim()) return;

    setIsSearching(true);
    const cleanResult = await api.cleanQuery(headerSearch.trim());
    setIsSearching(false);
    if (!cleanResult.error) {
      setHeaderSearch('');
      navigate(`/${cleanResult.category}/${cleanResult.cleanedValue}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#111317] text-[#e2e2e8] font-body-base">
      {/* TopAppBar */}
      <header className="bg-surface border-b border-outline-variant fixed top-0 w-full z-50 flex items-center justify-between px-md h-14 bg-[#111317]">
        <div className="flex items-center gap-md">
          <Link to="/" className="flex items-center gap-md hover:opacity-90">
            <span className="material-symbols-outlined text-primary text-xl" data-icon="terminal">terminal</span>
            <h1 className="font-data-mono-bold text-data-mono-bold text-primary text-[15px] font-bold tracking-tight">IRR Explorer</h1>
          </Link>
          <nav className="hidden md:flex items-center gap-lg ml-md">
            <Link
              to="/"
              className={`font-label-caps text-label-caps transition-colors duration-200 ${
                isHome ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              EXPLORE
            </Link>
            <Link
              to="/status/"
              className={`font-label-caps text-label-caps transition-colors duration-200 ${
                location.pathname === '/status/' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              STATUS
            </Link>
          </nav>
        </div>

        {/* Header Search - hidden on home page, visible on other pages */}
        {!isHome && (
          <form onSubmit={handleHeaderSearchSubmit} className="hidden md:flex items-center relative max-w-xs w-full mx-md">
            <span className="material-symbols-outlined absolute left-3 text-on-surface-variant text-[18px]">search</span>
            <input
              type="text"
              value={headerSearch}
              onChange={(e) => setHeaderSearch(e.target.value)}
              placeholder="Search AS, Prefix, or Object..."
              disabled={isSearching}
              className="w-full bg-[#1a1c20] border border-[#3d4a3d] rounded-lg pl-9 pr-4 py-1 text-xs focus:outline-none focus:border-primary transition-all text-on-surface placeholder:text-on-surface-variant/40"
            />
          </form>
        )}

        <div className="flex items-center gap-sm">
          <Link to="/status/" className="p-sm text-on-surface-variant hover:text-on-surface transition-colors flex items-center">
            <span className="material-symbols-outlined" data-icon="settings">settings</span>
          </Link>
          <div className="w-8 h-8 rounded-full bg-surface-container-highest border border-outline-variant flex items-center justify-center bg-[#333539]">
            <span className="material-symbols-outlined text-xs text-on-surface-variant" data-icon="person">person</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-14 min-h-[calc(100vh-3.5rem)]">
        {/* Side Navigation Bar (Desktop) */}
        <aside className="hidden lg:flex flex-col h-[calc(100vh-3.5rem)] w-64 fixed left-0 bg-[#1a1c20] border-r border-[#3d4a3d]/40 pt-md pb-lg z-40">
          <div className="px-lg mb-md">
            <div className="flex items-center gap-sm mb-base p-1 bg-[#1e2024]/40 rounded-lg border border-[#3d4a3d]/20">
              <img
                alt="System Operator Profile"
                className="w-8 h-8 rounded-full border border-primary/30"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCdis4vrQ2kPCA3ocszFMWGYljWFaRVbYUi_fpT1eM5CHMg-gs7nhPmdB2PgTbemRmW10PHK2w0IlSfcXDfQSthXHtjvX3bCU49uaWxeXOynBkk0skPnZZ-v7IibwhQupegZMf-ywVDUdYn9VMAwYFw7ffsnX3hzUA7FURBasxLZq7ppZ1B235pIX1wK5sj2AsKo4qgQc8gBAOdEHTz789p2Jum4iGhY7sgdutJzEJibArix3g_lQYwiWsQQPtuJldM3hB3xM5J6F8"
              />
              <div>
                <p className="text-label-caps font-label-caps text-on-surface uppercase tracking-wider text-[11px]">Network Ops</p>
                <p className="text-[10px] text-primary font-data-mono animate-pulse">Active Session</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-sm">
            <Link
              to="/"
              className={`flex items-center gap-md px-md py-2.5 rounded-lg transition-all font-label-caps text-label-caps ${
                isHome
                  ? 'bg-primary/10 text-primary border-l-2 border-primary'
                  : 'text-on-surface-variant hover:bg-[#333539]/30 hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" data-icon="dashboard">dashboard</span>
              <span>Dashboard</span>
            </Link>

            <Link
              to="/status/"
              className={`flex items-center gap-md px-md py-2.5 rounded-lg transition-all font-label-caps text-label-caps ${
                location.pathname === '/status/'
                  ? 'bg-primary/10 text-primary border-l-2 border-primary'
                  : 'text-on-surface-variant hover:bg-[#333539]/30 hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" data-icon="database">database</span>
              <span>System Status</span>
            </Link>

            {/* Premium design links to examples or placeholder actions */}
            <div className="pt-4 px-md">
              <span className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest font-label-caps">REDESIGNED VIEWS</span>
            </div>

            <Link
              to="/asn/AS200132"
              className="flex items-center gap-md px-md py-2.5 text-on-surface-variant hover:bg-[#333539]/30 hover:text-on-surface rounded-lg transition-all font-label-caps text-label-caps"
            >
              <span className="material-symbols-outlined text-[20px]" data-icon="analytics">analytics</span>
              <span>AS200132 Report</span>
            </Link>

            <Link
              to="/prefix/103.155.12.0/24"
              className="flex items-center gap-md px-md py-2.5 text-on-surface-variant hover:bg-[#333539]/30 hover:text-on-surface rounded-lg transition-all font-label-caps text-label-caps"
            >
              <span className="material-symbols-outlined text-[20px]" data-icon="language">language</span>
              <span>Prefix Query</span>
            </Link>

            <Link
              to="/as-set/AS-CYBERLINK"
              className="flex items-center gap-md px-md py-2.5 text-on-surface-variant hover:bg-[#333539]/30 hover:text-on-surface rounded-lg transition-all font-label-caps text-label-caps"
            >
              <span className="material-symbols-outlined text-[20px]" data-icon="hub">hub</span>
              <span>AS Set Expand</span>
            </Link>
          </nav>

          <div className="px-md mt-auto pt-md border-t border-[#3d4a3d]/20 space-y-2">
            <div className="bg-[#111317] p-3 rounded-lg border border-[#3d4a3d]/30">
              <span className="text-[10px] font-data-mono text-primary font-bold block mb-1">SYSTEM STATE</span>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
                <span className="text-xs text-on-surface font-semibold">ALL ENGINES ONLINE</span>
              </div>
            </div>
            <a
              href="https://github.com/sebas/irrexplorer"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-md py-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]" data-icon="help">help</span>
              <span className="font-label-caps text-label-caps">Documentation</span>
            </a>
          </div>
        </aside>

        {/* Main Content Canvas */}
        <main className="flex-1 lg:ml-64 p-4 md:p-6 lg:p-8 overflow-y-auto bg-[#0f1115] pb-24 md:pb-8">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* BottomNavBar (Mobile Only) */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center py-2 bg-[#1e2024] md:hidden border-t border-[#3d4a3d]/30">
        <Link
          to="/"
          className={`flex flex-col items-center justify-center px-4 py-1 transition-transform active:scale-95 ${
            isHome ? 'text-primary' : 'text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined" data-icon="search">search</span>
          <span className="font-label-caps text-[9px] uppercase tracking-wider mt-0.5">Explore</span>
        </Link>
        <Link
          to="/status/"
          className={`flex flex-col items-center justify-center px-4 py-1 transition-transform active:scale-95 ${
            location.pathname === '/status/' ? 'text-primary' : 'text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined" data-icon="database">database</span>
          <span className="font-label-caps text-[9px] uppercase tracking-wider mt-0.5">Status</span>
        </Link>
        <Link
          to="/asn/AS200132"
          className={`flex flex-col items-center justify-center px-4 py-1 transition-transform active:scale-95 ${
            location.pathname.startsWith('/asn/') ? 'text-primary' : 'text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined" data-icon="analytics">analytics</span>
          <span className="font-label-caps text-[9px] uppercase tracking-wider mt-0.5">ASN</span>
        </Link>
      </nav>
    </div>
  );
}
