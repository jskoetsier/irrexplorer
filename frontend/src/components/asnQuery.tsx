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

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Report for ASN {query}</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowDataSources(true)}
          style={{ height: 'fit-content' }}
        >
          <i className="fas fa-external-link-alt"></i> External Data Sources
        </button>
      </div>
      <PrefixTableExplanation />
      <h2 className="h3 mt-4">Prefixes originated by {query}</h2>
      <hr />
      <PrefixTable
        prefixesData={directOriginPrefixes}
        hasLoaded={hasLoadedPrefixes}
        reducedColour={reducedColour}
        filterWarningError={filterWarningError}
        apiCallUrl={apiCallUrl}
      />
      <h2 className="h3 mt-4">Other prefixes overlapping with prefixes originated by {query}</h2>
      <hr />
      <PrefixTable
        prefixesData={overlapPrefixes}
        hasLoaded={hasLoadedPrefixes}
        reducedColour={reducedColour}
        filterWarningError={filterWarningError}
        apiCallUrl={apiCallUrl}
        defaultSortSmallestFirst
      />
      <h2 className="h3 mt-4">Included in the following AS sets:</h2>
      <hr />
      <SetIncludedTable query={query} objectClass="as-set" />
      <h2 className="h3 mt-4">Included in the following route sets:</h2>
      <hr />
      <SetIncludedTable query={query} objectClass="route-set" />

      {showDataSources && (
        <DataSourcesModal query={query} type="asn" onClose={() => setShowDataSources(false)} />
      )}
    </>
  );
}
