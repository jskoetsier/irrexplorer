import { useState, useEffect, useCallback } from 'react';
import PrefixTableExplanation from './prefixTable/prefixTableExplanation';
import PrefixTable from './prefixTable/prefixTable';
import { findLeastSpecific } from '../utils/prefixData';
import api from '../services/api';
import DataSourcesModal from './dataSources/DataSourcesModal';
import type { PrefixData } from '../types';

interface PrefixQueryProps {
  query: string;
  reducedColour: boolean;
  filterWarningError: boolean;
}

export default function PrefixQuery({ query, reducedColour, filterWarningError }: PrefixQueryProps) {
  const [leastSpecificPrefix, setLeastSpecificPrefix] = useState<string | null>(null);
  const [directOverlapPrefixes, setDirectOverlapPrefixes] = useState<{
    hasLoaded: boolean;
    data: PrefixData[];
    apiCallUrl: string;
  }>({ hasLoaded: false, data: [], apiCallUrl: '' });
  const [leastSpecificOverlapPrefixes, setLeastSpecificOverlapPrefixes] = useState<{
    hasLoaded: boolean;
    data: PrefixData[];
    apiCallUrl: string;
  }>({ hasLoaded: false, data: [], apiCallUrl: '' });
  const [showDataSources, setShowDataSources] = useState(false);

  const loadPrefixesData = useCallback(async () => {
    setLeastSpecificPrefix(null);
    setDirectOverlapPrefixes({ hasLoaded: false, data: [], apiCallUrl: '' });
    setLeastSpecificOverlapPrefixes({ hasLoaded: false, data: [], apiCallUrl: '' });

    const { data, url } = await api.getPrefixesForPrefix(query);
    setDirectOverlapPrefixes({ hasLoaded: true, data: data || [], apiCallUrl: url || '' });

    if (data && data.length > 0) {
      const lsp = findLeastSpecific(query, data);
      setLeastSpecificPrefix(lsp);
      if (lsp) {
        const { data: lspData, url: lspUrl } = await api.getPrefixesForPrefix(lsp);
        setLeastSpecificOverlapPrefixes({ hasLoaded: true, data: lspData || [], apiCallUrl: lspUrl || '' });
      }
    }
  }, [query]);

  useEffect(() => {
    loadPrefixesData();
  }, [loadPrefixesData]);

  // Compute stats for premium cards
  const directCount = directOverlapPrefixes.data.length;
  const isHealthy = directOverlapPrefixes.data.every(p => p.categoryOverall === 'success' || p.categoryOverall === 'info');

  return (
    <div className="space-y-lg animate-in fade-in duration-300">
      {/* Bento Summary Grid */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-md">
        <div className="bg-[#1a1c20] border border-[#3d4a3d]/20 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] font-label-caps text-on-surface-variant/70 uppercase tracking-widest block font-bold mb-2">
            Direct Overlaps
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-data-mono text-primary">
              {directOverlapPrefixes.hasLoaded ? directCount.toLocaleString() : '...'}
            </span>
            <span className="text-[10px] text-on-surface-variant font-data-mono bg-[#111317] border border-[#3d4a3d]/10 px-1.5 py-0.5 rounded">
              RECORDS
            </span>
          </div>
        </div>

        <div className="bg-[#1a1c20] border border-[#3d4a3d]/20 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] font-label-caps text-on-surface-variant/70 uppercase tracking-widest block font-bold mb-2">
            Least Specific Match
          </span>
          <div className="flex items-baseline justify-between overflow-hidden">
            <span className="text-sm font-bold font-data-mono text-secondary truncate max-w-full">
              {leastSpecificPrefix || 'None found'}
            </span>
            <span className="text-[9px] text-secondary font-data-mono bg-secondary/10 border border-secondary/20 px-1 py-0.5 rounded font-bold shrink-0">
              PARENT
            </span>
          </div>
        </div>

        <div className="bg-[#1a1c20] border border-[#3d4a3d]/20 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] font-label-caps text-on-surface-variant/70 uppercase tracking-widest block font-bold mb-2">
            Routing State
          </span>
          <div className="flex items-baseline justify-between">
            <span className={`text-sm font-bold font-data-mono uppercase tracking-wider ${isHealthy ? 'text-primary' : 'text-amber-400'}`}>
              {directOverlapPrefixes.hasLoaded ? (isHealthy ? 'HEALTHY' : 'WARNING') : '...'}
            </span>
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isHealthy ? 'bg-primary' : 'bg-amber-400 animate-pulse'}`}></span>
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

      {/* Accordion Explanation Card */}
      <section>
        <PrefixTableExplanation />
      </section>

      {/* Directly Overlapping Prefixes Table Section */}
      <section className="bg-[#1a1c20] border border-[#3d4a3d]/30 rounded-xl overflow-hidden shadow-2xl">
        <div className="px-lg py-md border-b border-[#3d4a3d]/20 flex justify-between items-center bg-[#1e2024]/80">
          <h2 className="font-headline-md text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
            Directly overlapping prefixes of {query}
          </h2>
        </div>
        <div className="p-sm bg-[#0f1115]">
          <PrefixTable
            prefixesData={directOverlapPrefixes.data}
            hasLoaded={directOverlapPrefixes.hasLoaded}
            apiCallUrl={directOverlapPrefixes.apiCallUrl}
            reducedColour={reducedColour}
            filterWarningError={filterWarningError}
          />
        </div>
      </section>

      {/* Least Specific Overlaps Table Section */}
      {leastSpecificPrefix && (
        <section className="bg-[#1a1c20] border border-[#3d4a3d]/30 rounded-xl overflow-hidden shadow-2xl">
          <div className="px-lg py-md border-b border-[#3d4a3d]/20 flex justify-between items-center bg-[#1e2024]/80">
            <h2 className="font-headline-md text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
              All overlaps of least specific match {leastSpecificPrefix}
            </h2>
          </div>
          <div className="p-sm bg-[#0f1115]">
            <PrefixTable
              prefixesData={leastSpecificOverlapPrefixes.data}
              hasLoaded={leastSpecificOverlapPrefixes.hasLoaded}
              apiCallUrl={leastSpecificOverlapPrefixes.apiCallUrl}
              reducedColour={reducedColour}
              filterWarningError={filterWarningError}
              defaultSortSmallestFirst
            />
          </div>
        </section>
      )}

      {showDataSources && (
        <DataSourcesModal query={query} type="prefix" onClose={() => setShowDataSources(false)} />
      )}
    </div>
  );
}
