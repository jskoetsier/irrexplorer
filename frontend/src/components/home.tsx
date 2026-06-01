import { useEffect, useState } from 'react';
import QueryForm from './common/queryForm';
import { getWebsiteStructuredData, setSeo } from '../utils/seo';
import { useNavigate } from 'react-router-dom';

interface BgpUpdate {
  asn: string;
  action: string;
  time: string;
}

export default function Home() {
  const navigate = useNavigate();
  const [bgpUpdates, setBgpUpdates] = useState<BgpUpdate[]>([
    { asn: 'AS2906', action: 'Announced 104.16.0.0/12', time: '2s ago' },
    { asn: 'AS13335', action: 'Withdrawn 1.1.1.0/24', time: '12s ago' },
    { asn: 'AS16509', action: 'New Route Object (RIPE)', time: '45s ago' },
    { asn: 'AS3356', action: 'Path Prepended +2', time: '1m ago' },
    { asn: 'AS6939', action: 'Prefix 2602:fed2::/32 Validated', time: '2m ago' },
  ]);

  useEffect(() => {
    setSeo({
      title: 'IRRExplorer | IRR, BGP, and RPKI Lookup',
      description:
        'Look up prefixes, ASNs, AS-SETs, and route-sets with IRR, BGP, RPKI, RDAP, PeeringDB, and Looking Glass data.',
      path: '/',
      structuredData: getWebsiteStructuredData(),
    });
  }, []);

  // Simple auto-rotation for live BGP updates stream
  useEffect(() => {
    const timer = setInterval(() => {
      setBgpUpdates((prev) => {
        const next = [...prev];
        const first = next.shift();
        if (first) next.push(first);
        return next;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleExampleClick = (example: string) => {
    // Navigate directly to the corresponding category
    if (example.startsWith('AS')) {
      navigate(`/asn/${example}`);
    } else {
      navigate(`/prefix/${example}`);
    }
  };

  return (
    <div className="space-y-lg animate-in fade-in duration-300">
      {/* Hero Search Section */}
      <section className="technical-grid border border-[#3d4a3d]/30 py-xl px-md lg:px-xl bg-[#1a1c20]/20 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 blur-[120px] pointer-events-none -z-10"></div>
        <div className="max-w-4xl mx-auto">
          <div className="mb-md">
            <span className="font-label-caps text-[10px] text-primary bg-primary/10 px-sm py-1 border border-primary/20 rounded font-bold uppercase tracking-widest">
              NETWORK REGISTRY LOOKUP
            </span>
          </div>
          <h2 className="font-headline-lg text-2xl lg:text-3xl text-on-surface mb-lg max-w-2xl font-bold tracking-tight leading-snug">
            Query global IRR databases and verify routing assets with precision.
          </h2>
          
          <div className="w-full">
            <QueryForm />
          </div>

          <div className="mt-md flex flex-wrap gap-md text-on-surface-variant font-data-mono text-[11px] items-center">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span>API ENDPOINT ACTIVE</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
              <span>IRR DATA REFRESHED: 4m AGO</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-on-surface font-semibold">EXAMPLE:</span>
              <button
                onClick={() => handleExampleClick('AS15169')}
                className="text-secondary bg-[#1e2024] hover:bg-[#333539] px-2 py-0.5 rounded font-bold transition-all border border-[#3d4a3d]/20 text-[10px]"
              >
                AS15169
              </button>
              <button
                onClick={() => handleExampleClick('8.8.8.0/24')}
                className="text-secondary bg-[#1e2024] hover:bg-[#333539] px-2 py-0.5 rounded font-bold transition-all border border-[#3d4a3d]/20 text-[10px]"
              >
                8.8.8.0/24
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Primary Feature Entry Points */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-md">
        {/* RPKI Validation Card */}
        <div
          onClick={() => handleExampleClick('8.8.8.0/24')}
          className="bg-[#1a1c20] border border-[#3d4a3d]/20 p-md flex flex-col gap-md hover:border-primary/50 transition-colors group cursor-pointer rounded-xl"
        >
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 bg-[#333539]/30 flex items-center justify-center border border-[#3d4a3d]/20 rounded-lg">
              <span className="material-symbols-outlined text-primary text-xl" data-icon="verified_user">verified_user</span>
            </div>
            <div className="flex items-center gap-1.5 font-label-caps text-[9px] font-bold text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              LIVE VALIDATION
            </div>
          </div>
          <div>
            <h3 className="font-headline-md text-base font-bold text-on-surface mb-1">RPKI Validation</h3>
            <p className="text-on-surface-variant font-body-sm text-xs leading-relaxed">
              Real-time prefix validation against global caches. Cross-examine ROAs with BGP announcements.
            </p>
          </div>
          <div className="mt-auto pt-md border-t border-[#3d4a3d]/10 flex justify-between items-center">
            <span className="font-data-mono text-[10px] text-on-surface-variant/60">CACHE: CLOUDFLARE, NTT</span>
            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-sm" data-icon="chevron_right">chevron_right</span>
          </div>
        </div>

        {/* IRR Aggregation Card */}
        <div
          onClick={() => handleExampleClick('AS15169')}
          className="bg-[#1a1c20] border border-[#3d4a3d]/20 p-md flex flex-col gap-md hover:border-primary/50 transition-colors group cursor-pointer rounded-xl"
        >
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 bg-[#333539]/30 flex items-center justify-center border border-[#3d4a3d]/20 rounded-lg">
              <span className="material-symbols-outlined text-primary text-xl" data-icon="database">database</span>
            </div>
            <div className="flex items-center gap-1 font-label-caps text-[9px] font-bold text-on-surface-variant">
              5 SOURCES SYNCED
            </div>
          </div>
          <div>
            <h3 className="font-headline-md text-base font-bold text-on-surface mb-1">IRR Aggregation</h3>
            <p className="text-on-surface-variant font-body-sm text-xs leading-relaxed">
              Cross-referencing RIPE, ARIN, APNIC, LACNIC, and AFRINIC registries for authoritative routing objects.
            </p>
          </div>
          <div className="mt-auto pt-md border-t border-[#3d4a3d]/10 flex justify-between items-center">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-[#3d4a3d] rounded-full"></span>
              <span className="w-1.5 h-1.5 bg-[#3d4a3d] rounded-full"></span>
              <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-sm" data-icon="chevron_right">chevron_right</span>
          </div>
        </div>

        {/* Route Visualizer Card */}
        <div
          onClick={() => navigate('/status/')}
          className="bg-[#1a1c20] border border-[#3d4a3d]/20 p-md flex flex-col gap-md hover:border-primary/50 transition-colors group cursor-pointer relative overflow-hidden rounded-xl"
        >
          <div className="absolute top-0 right-0 p-1 opacity-5 group-hover:opacity-10 transition-opacity">
            <span className="material-symbols-outlined text-7xl" data-icon="hub">hub</span>
          </div>
          <div className="flex justify-between items-start relative z-10">
            <div className="w-10 h-10 bg-[#333539]/30 flex items-center justify-center border border-[#3d4a3d]/20 rounded-lg">
              <span className="material-symbols-outlined text-primary text-xl" data-icon="account_tree">account_tree</span>
            </div>
            <div className="flex items-center gap-1 font-label-caps text-[9px] font-bold text-secondary">
              BETA ACCESS
            </div>
          </div>
          <div className="relative z-10">
            <h3 className="font-headline-md text-base font-bold text-on-surface mb-1">Route Visualizer</h3>
            <p className="text-on-surface-variant font-body-sm text-xs leading-relaxed">
              Interactive mapping of AS relationships and pathing. Visualize upstream/downstream peering topology.
            </p>
          </div>
          <div className="mt-auto pt-md border-t border-[#3d4a3d]/10 flex justify-between items-center relative z-10">
            <span className="font-data-mono text-[10px] text-on-surface-variant/60">TOPOLOGY ENGINE v2.4</span>
            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-sm" data-icon="chevron_right">chevron_right</span>
          </div>
        </div>
      </section>

      {/* Bento Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-md h-auto lg:h-[400px]">
        {/* Latest BGP Updates */}
        <div className="lg:col-span-8 bg-[#0c0e12] border border-[#3d4a3d]/30 p-md relative overflow-hidden rounded-xl flex flex-col min-h-[250px]">
          <div className="flex justify-between items-center mb-md border-b border-[#3d4a3d]/20 pb-sm">
            <h4 className="font-label-caps text-xs text-on-surface-variant font-bold tracking-wider uppercase">LATEST BGP UPDATES</h4>
            <span className="font-data-mono text-[10px] text-primary font-bold">MONITORING 1.2M ROUTES</span>
          </div>
          <div className="space-y-2 font-data-mono text-[12px] overflow-y-auto flex-1 pr-1">
            {bgpUpdates.map((update, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center p-2 border-b border-[#3d4a3d]/10 hover:bg-[#333539]/10 transition-colors rounded"
              >
                <span className="text-secondary font-bold">{update.asn}</span>
                <span className="text-on-surface-variant flex-1 px-4 truncate">{update.action}</span>
                <span className="text-on-surface-variant/40 text-[10px]">{update.time}</span>
              </div>
            ))}
          </div>
          <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-[#0c0e12] to-transparent pointer-events-none"></div>
        </div>

        {/* Reachability Map & Status */}
        <div className="lg:col-span-4 flex flex-col gap-md">
          <div className="flex-1 bg-[#1a1c20] border border-[#3d4a3d]/20 p-md rounded-xl flex flex-col min-h-[200px]">
            <h4 className="font-label-caps text-xs text-on-surface-variant font-bold mb-md uppercase tracking-wider">REACHABILITY MAP</h4>
            <div className="flex-1 bg-[#333539]/20 border border-[#3d4a3d]/20 overflow-hidden rounded-lg aspect-video lg:aspect-auto">
              <img
                alt="Dark network map"
                className="w-full h-full object-cover grayscale brightness-[0.4] contrast-125 hover:brightness-50 transition-all duration-300"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBy-99Ft0NC9ADkdhxBteTWCCsJk4jpYifh5gxT_5sfwr50ys9_hAhKg7DtJ4SEeRlIQB74KzHETPcvVg0T1heF_Z1WXlKfQSEwH-jIRTnnBqeRKOYpUvOKPcDq6aVkgzvDHJ96uQLA_k9pP1ha96pnhur6l1CXI7vDqXsqZF33DKD0sbfYvBdeBdjgu8Tqawko3vq3NmcDc1ZnRNx5wZOWCX8a5yHbwFhy67m9jiKLdiFgR_mxeBbzOcM8Ho5ybTmILK1pnr5mNug"
              />
            </div>
          </div>
          <div className="bg-primary p-4 flex items-center justify-between rounded-xl shadow-lg shadow-primary/5 select-none">
            <span className="font-data-mono-bold text-on-primary font-bold text-xs">SYSTEM STATUS: OPTIMAL</span>
            <span className="material-symbols-outlined text-on-primary text-base animate-pulse">check_circle</span>
          </div>
        </div>
      </section>
    </div>
  );
}
