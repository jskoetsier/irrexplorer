import { useState, useEffect, useCallback } from 'react';
import PrefixTableExplanation from './prefixTable/prefixTableExplanation';
import PrefixTable from './prefixTable/prefixTable';
import api from '../services/api';
import SetIncludedTable from './common/setIncludedTable';
import DataSourcesModal from './dataSources/DataSourcesModal';
import type { PrefixData } from '../types';

interface ASNQueryProps {
  query: string;
  reducedColour: boolean;
  filterWarningError: boolean;
}

export default function ASNQuery({ query, reducedColour, filterWarningError }: ASNQueryProps) {
  const [hasLoadedPrefixes, setHasLoadedPrefixes] = useState(false);
  const [directOriginPrefixes, setDirectOriginPrefixes] = useState<PrefixData[]>([]);
  const [overlapPrefixes, setOverlapPrefixes] = useState<PrefixData[]>([]);
  const [apiCallUrl, setApiCallUrl] = useState('');
  const [showDataSources, setShowDataSources] = useState(false);

  const loadPrefixesData = useCallback(async () => {
    setHasLoadedPrefixes(false);
    setDirectOriginPrefixes([]);
    setOverlapPrefixes([]);
    setApiCallUrl('');

    const { data, url } = await api.getPrefixesForASN(query);
    if (data) {
      setHasLoadedPrefixes(true);
      setDirectOriginPrefixes(data.directOrigin || []);
      setOverlapPrefixes(data.overlaps || []);
      setApiCallUrl(url || '');
    }
  }, [query]);

  useEffect(() => {
    loadPrefixesData();
  }, [loadPrefixesData]);

  // Compute stats for our premium stat counters
  const activeCount = directOriginPrefixes.length;
  const overlapCount = overlapPrefixes.length;
  const validPercent = activeCount > 0
    ? Math.round((directOriginPrefixes.filter(p => p.categoryOverall === 'success').length / activeCount) * 100)
    : 100;

  return (
    <div className="space-y-lg animate-in fade-in duration-300">
      {/* Dynamic Summary Cards Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-md">
        <div className="bg-[#1a1c20] border border-[#3d4a3d]/20 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] font-label-caps text-on-surface-variant/70 uppercase tracking-widest block font-bold mb-2">
            Active Prefixes
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-data-mono text-primary">
              {hasLoadedPrefixes ? activeCount.toLocaleString() : '...'}
            </span>
            <span className="text-[10px] text-on-surface-variant font-data-mono bg-[#111317] border border-[#3d4a3d]/10 px-1.5 py-0.5 rounded">
              ORIGINATED
            </span>
          </div>
        </div>

        <div className="bg-[#1a1c20] border border-[#3d4a3d]/20 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] font-label-caps text-on-surface-variant/70 uppercase tracking-widest block font-bold mb-2">
            RPKI Integrity
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-data-mono text-primary">
              {hasLoadedPrefixes ? `${validPercent}%` : '...'}
            </span>
            <span className="text-[10px] text-primary font-data-mono bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
              VALID ROAS
            </span>
          </div>
        </div>

        <div className="bg-[#1a1c20] border border-[#3d4a3d]/20 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] font-label-caps text-on-surface-variant/70 uppercase tracking-widest block font-bold mb-2">
            Overlapping Alerts
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-data-mono text-secondary">
              {hasLoadedPrefixes ? overlapCount.toLocaleString() : '...'}
            </span>
            <span className="text-[10px] text-secondary font-data-mono bg-secondary/10 border border-secondary/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
              DETECTION
            </span>
          </div>
        </div>

        <div className="bg-[#1a1c20] border border-primary/20 p-4 rounded-xl flex flex-col justify-between hover:border-primary transition-all">
          <span className="text-[10px] font-label-caps text-primary uppercase tracking-widest block font-bold mb-2">
            Registry Sources
          </span>
          <button
            onClick={() => setShowDataSources(true)}
            className="w-full bg-primary hover:bg-[#4ae176] text-[#002109] font-label-caps text-xs font-bold py-2 rounded-lg transition-colors uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-primary/5"
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            <span>External Sources</span>
          </button>
        </div>
      </section>

      {/* Explanation Accordion Card */}
      <section>
        <PrefixTableExplanation />
      </section>

      {/* Originated Prefixes Table Section */}
      <section className="bg-[#1a1c20] border border-[#3d4a3d]/30 rounded-xl overflow-hidden shadow-2xl">
        <div className="px-lg py-md border-b border-[#3d4a3d]/20 flex justify-between items-center bg-[#1e2024]/80">
          <h2 className="font-headline-md text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
            Prefixes originated by {query}
          </h2>
        </div>
        <div className="p-sm bg-[#0f1115]">
          <PrefixTable
            prefixesData={directOriginPrefixes}
            hasLoaded={hasLoadedPrefixes}
            reducedColour={reducedColour}
            filterWarningError={filterWarningError}
            apiCallUrl={apiCallUrl}
          />
        </div>
      </section>

      {/* Overlapping Prefixes Table Section */}
      <section className="bg-[#1a1c20] border border-[#3d4a3d]/30 rounded-xl overflow-hidden shadow-2xl">
        <div className="px-lg py-md border-b border-[#3d4a3d]/20 flex justify-between items-center bg-[#1e2024]/80">
          <h2 className="font-headline-md text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
            Other overlapping prefixes originated by neighbors
          </h2>
        </div>
        <div className="p-sm bg-[#0f1115]">
          <PrefixTable
            prefixesData={overlapPrefixes}
            hasLoaded={hasLoadedPrefixes}
            reducedColour={reducedColour}
            filterWarningError={filterWarningError}
            apiCallUrl={apiCallUrl}
            defaultSortSmallestFirst
          />
        </div>
      </section>

      {/* AS Sets and Route Sets Inclusion */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* AS Sets */}
        <div className="bg-[#1a1c20] border border-[#3d4a3d]/20 rounded-xl overflow-hidden shadow-xl flex flex-col">
          <div className="px-lg py-3 border-b border-[#3d4a3d]/10 bg-[#1e2024]/60 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">hub</span>
            <h2 className="font-headline-md text-xs font-bold text-on-surface uppercase tracking-wider">Inclusion in AS Sets</h2>
          </div>
          <div className="p-md flex-1 bg-[#0f1115]/50">
            <SetIncludedTable query={query} objectClass="as-set" />
          </div>
        </div>

        {/* Route Sets */}
        <div className="bg-[#1a1c20] border border-[#3d4a3d]/20 rounded-xl overflow-hidden shadow-xl flex flex-col">
          <div className="px-lg py-3 border-b border-[#3d4a3d]/10 bg-[#1e2024]/60 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">database</span>
            <h2 className="font-headline-md text-xs font-bold text-on-surface uppercase tracking-wider">Inclusion in Route Sets</h2>
          </div>
          <div className="p-md flex-1 bg-[#0f1115]/50">
            <SetIncludedTable query={query} objectClass="route-set" />
          </div>
        </div>
      </section>

      {showDataSources && (
        <DataSourcesModal query={query} type="asn" onClose={() => setShowDataSources(false)} />
      )}
    </div>
  );
}
