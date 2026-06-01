import { useEffect } from 'react';
import QueryForm from './common/queryForm';
import { getWebsiteStructuredData, setSeo } from '../utils/seo';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    setSeo({
      title: 'IRRExplorer | IRR, BGP, and RPKI Lookup',
      description:
        'Look up prefixes, ASNs, AS-SETs, and route-sets with IRR, BGP, RPKI, RDAP, PeeringDB, and Looking Glass data.',
      path: '/',
      structuredData: getWebsiteStructuredData(),
    });
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

      {/* System Status Banner */}
      <section className="bg-[#1a1c20] border border-[#3d4a3d]/20 p-md flex items-center justify-between rounded-xl select-none">
        <div className="flex items-center gap-md">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(75,226,119,0.6)]"></span>
          <span className="font-data-mono text-xs text-on-surface font-bold tracking-wider uppercase">SYSTEM STATUS: OPTIMAL</span>
        </div>
        <div className="flex items-center gap-sm font-data-mono text-[10px] text-on-surface-variant">
          <span>ALL INTEGRATED BACKENDS OPERATIONAL</span>
          <span className="material-symbols-outlined text-primary text-sm animate-pulse" data-icon="check_circle">check_circle</span>
        </div>
      </section>
    </div>
  );
}
