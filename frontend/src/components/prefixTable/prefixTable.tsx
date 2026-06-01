import { useMemo, useRef, useState, useCallback } from 'react';

import Spinner from '../common/spinner';
import PrefixTableBody from './prefixTableBody';
import { findIrrSourceColumns, sortPrefixesDataBy } from '../../utils/prefixData';
import PrefixTableHeader from './prefixTableHeader';
import WhoisModal, { WhoisModalHandle } from './whoisModal';
import TableFooter from '../common/tableFooter';
import type { PrefixData, RPKIStatus } from '../../types';

interface PrefixTableProps {
  prefixesData: PrefixData[];
  hasLoaded: boolean;
  reducedColour?: boolean;
  filterWarningError?: boolean;
  apiCallUrl?: string;
  defaultSortSmallestFirst?: boolean;
}

const INITIAL_ROW_LIMIT = 500;

export default function PrefixTable({
  prefixesData,
  hasLoaded,
  reducedColour,
  filterWarningError,
  apiCallUrl,
  defaultSortSmallestFirst,
}: PrefixTableProps) {
  const whoisModalRef = useRef<WhoisModalHandle>(null);
  const [sortKey, setSortKey] = useState(defaultSortSmallestFirst ? 'prefixSmallestFirst' : 'prefix');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showAllRows, setShowAllRows] = useState(false);

  const irrSourceColumns = useMemo(() => {
    return findIrrSourceColumns(prefixesData);
  }, [prefixesData]);

  const sortedPrefixesData = useMemo(() => {
    return sortPrefixesDataBy(prefixesData, sortKey, sortOrder);
  }, [prefixesData, sortKey, sortOrder]);

  const displayData = useMemo(() => {
    if (showAllRows || sortedPrefixesData.length <= INITIAL_ROW_LIMIT) {
      return sortedPrefixesData;
    }
    return sortedPrefixesData.slice(0, INITIAL_ROW_LIMIT);
  }, [sortedPrefixesData, showAllRows]);

  const handleSort = useCallback(({ key, order }: { key: string; order: 'asc' | 'desc' }) => {
    setSortKey(key);
    setSortOrder(order);
  }, []);

  const handleIrrRouteSelect = useCallback(
    (prefix: string, asn: number, sourceName: string, rpslText: string, rpkiStatus: RPKIStatus) => {
      whoisModalRef.current?.openWithContent(prefix, asn, sourceName, rpslText, rpkiStatus);
    },
    []
  );

  const renderTablePlaceholder = (placeholder: React.ReactNode) => {
    const totalColumns = 5 + irrSourceColumns.length + (reducedColour ? 1 : 0);
    return (
      <tbody>
        <tr>
          <td colSpan={totalColumns} className="text-center py-8">
            {placeholder}
          </td>
        </tr>
      </tbody>
    );
  };

  const renderTableContent = () => {
    if (!hasLoaded) return renderTablePlaceholder(<Spinner />);
    if (!prefixesData.length)
      return renderTablePlaceholder(<span className="text-xs text-on-surface-variant font-data-mono">No prefixes were found.</span>);
    return (
      <PrefixTableBody
        irrSourceColumns={irrSourceColumns}
        prefixesData={displayData}
        reducedColour={reducedColour ?? false}
        filterWarningError={filterWarningError ?? false}
        handleIrrRouteSelect={handleIrrRouteSelect}
      />
    );
  };

  const hasMoreRows = sortedPrefixesData.length > INITIAL_ROW_LIMIT && !showAllRows;

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto relative w-full rounded-lg border border-[#3d4a3d]/20 bg-[#0f1115]">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <PrefixTableHeader
            irrSourceColumns={irrSourceColumns}
            onSort={handleSort}
            reducedColour={reducedColour ?? false}
          />
          {renderTableContent()}
        </table>
      </div>

      {hasMoreRows && (
        <div className="text-center mt-md">
          <button
            onClick={() => setShowAllRows(true)}
            className="px-4 py-2 border border-[#3d4a3d]/40 rounded-lg text-xs font-label-caps font-bold hover:bg-[#333539]/30 hover:border-primary/50 text-on-surface-variant hover:text-on-surface transition-all select-none"
          >
            Show all {sortedPrefixesData.length.toLocaleString()} rows (currently showing {INITIAL_ROW_LIMIT})
          </button>
        </div>
      )}

      {apiCallUrl && (
        <div className="mt-2 text-right">
          <TableFooter url={apiCallUrl} />
        </div>
      )}
      <WhoisModal ref={whoisModalRef} />
    </div>
  );
}
