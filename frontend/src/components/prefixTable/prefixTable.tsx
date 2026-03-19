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

// Maximum rows to render initially - helps with performance on large ASNs
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

  // Limit rows for performance on large datasets
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
    return (
      <tbody>
        <tr>
          <td colSpan={5} className="text-center">
            {placeholder}
          </td>
        </tr>
      </tbody>
    );
  };

  const renderTableContent = () => {
    if (!hasLoaded) return renderTablePlaceholder(<Spinner />);
    if (!prefixesData.length)
      return renderTablePlaceholder('No prefixes were found.');
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
    <>
      <div className="table-responsive">
        <table className="table table-sm mb-2 table-fixed table-striped">
          <PrefixTableHeader
            irrSourceColumns={irrSourceColumns}
            onSort={handleSort}
            reducedColour={reducedColour ?? false}
          />
          {renderTableContent()}
          <TableFooter url={apiCallUrl} />
        </table>
        {hasMoreRows && (
          <div className="text-center mb-4">
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => setShowAllRows(true)}
            >
              Show all {sortedPrefixesData.length.toLocaleString()} rows (currently showing {INITIAL_ROW_LIMIT})
            </button>
          </div>
        )}
      </div>
      <WhoisModal ref={whoisModalRef} />
    </>
  );
}
