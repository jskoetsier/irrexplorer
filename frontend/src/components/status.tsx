import { useEffect } from 'react';
import Metadata from './common/metadata';
import { Link } from 'react-router-dom';
import { setSeo } from '../utils/seo';

export default function Status() {
  useEffect(() => {
    setSeo({
      title: 'IRRExplorer Status | Data Freshness and Source Health',
      description:
        'Check IRRExplorer data freshness for BGP, RIR statistics, IRRD, and RPKI-backed sources.',
      path: '/status/',
    });
  }, []);

  return (
    <div className="space-y-lg animate-in fade-in duration-300">
      {/* Header section */}
      <section className="border-b border-[#3d4a3d]/20 pb-md flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <div className="flex items-center gap-sm mb-xs">
            <span className="bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider">
              METRIC CONSOLE
            </span>
          </div>
          <h1 className="font-headline-lg text-2xl lg:text-3xl text-on-surface font-bold tracking-tight">
            Data Status & Registry Health
          </h1>
          <p className="text-on-surface-variant font-body-base mt-1 text-sm max-w-xl">
            Real-time monitoring of last processed updates, database synchronization cycles, and active cache statuses.
          </p>
        </div>

        <div className="flex gap-sm">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-4 py-2 border border-[#3d4a3d]/30 hover:bg-[#333539]/30 rounded-lg text-xs font-bold font-label-caps text-on-surface uppercase tracking-wider transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Dashboard
          </Link>
        </div>
      </section>

      {/* Explanation Cards Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-md">
        {/* Core Ingestion Rules */}
        <div className="bg-[#1a1c20] border border-[#3d4a3d]/20 p-md rounded-xl space-y-md">
          <h2 className="font-headline-md text-base font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl" data-icon="hub">hub</span>
            Authoritative Ingest Rules
          </h2>
          <ul className="space-y-sm text-xs text-on-surface-variant list-disc pl-4 font-body-sm leading-relaxed">
            <li>
              <strong>Prefix-to-RIR mapping:</strong> Resolved dynamically from daily <span className="text-secondary">RIRstats</span> dumps.
            </li>
            <li>
              <strong>Prefix-to-DFZ mapping:</strong> Sourced live from the <a href="https://bgp.tools/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">bgp.tools</a> feed.
            </li>
            <li>
              <strong>IRR database mirrors:</strong> Mirrored over high-throughput NRTMv3 sync pipelines using <a href="https://irrd.readthedocs.io/en/stable/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">IRRD v4</a>.
            </li>
            <li>
              <strong>RPKI Route Objects:</strong> Imported dynamically via local validating caches integrated with <span className="text-secondary">IRRD v4</span>.
            </li>
          </ul>
        </div>

        {/* Operational Diagnostics */}
        <div className="bg-[#1a1c20] border border-[#3d4a3d]/20 p-md rounded-xl space-y-md">
          <h2 className="font-headline-md text-base font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl" data-icon="settings">settings</span>
            Diagnostics & Limitations
          </h2>
          <ul className="space-y-sm text-xs text-on-surface-variant list-disc pl-4 font-body-sm leading-relaxed">
            <li>
              The <span className="text-secondary">RIRstats</span> timestamp reflects when IRR explorer imported the dataset, rather than original registry publication times.
            </li>
            <li>
              For dynamic IRR sources, the timestamp represents the last completed processing cycle. For quiet registries that rarely change, long intervals are entirely normal.
            </li>
            <li>
              Validating caches receive updates in less than 5 minute intervals to maintain global routing parity.
            </li>
          </ul>
        </div>
      </section>

      {/* Dynamic Importer Table */}
      <section className="pt-sm">
        <Metadata />
      </section>
    </div>
  );
}
