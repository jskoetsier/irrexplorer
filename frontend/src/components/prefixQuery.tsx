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

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Report for prefix {query}</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowDataSources(true)}
          style={{ height: 'fit-content' }}
        >
          <i className="fas fa-external-link-alt"></i> External Data Sources
        </button>
      </div>
      <PrefixTableExplanation />
      <h2 className="h3 mt-4">Directly overlapping prefixes of {query}</h2>
      <hr />
      <PrefixTable
        prefixesData={directOverlapPrefixes.data}
        hasLoaded={directOverlapPrefixes.hasLoaded}
        apiCallUrl={directOverlapPrefixes.apiCallUrl}
        reducedColour={reducedColour}
        filterWarningError={filterWarningError}
      />

      {leastSpecificPrefix && (
        <>
          <h2 className="h3 mt-4">All overlaps of least specific match {leastSpecificPrefix}</h2>
          <hr />
          <PrefixTable
            prefixesData={leastSpecificOverlapPrefixes.data}
            hasLoaded={leastSpecificOverlapPrefixes.hasLoaded}
            apiCallUrl={leastSpecificOverlapPrefixes.apiCallUrl}
            reducedColour={reducedColour}
            filterWarningError={filterWarningError}
            defaultSortSmallestFirst
          />
        </>
      )}

      {showDataSources && (
        <DataSourcesModal query={query} type="prefix" onClose={() => setShowDataSources(false)} />
      )}
    </>
  );
}
