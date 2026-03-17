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

  const irrSourceColumns = useMemo(() => {
    return findIrrSourceColumns(prefixesData);
  }, [prefixesData]);

  const sortedPrefixesData = useMemo(() => {
    return sortPrefixesDataBy(prefixesData, sortKey, sortOrder);
  }, [prefixesData, sortKey, sortOrder]);

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
      return renderTablePlaceholder('No prefixes were found or query was too large to execute.');
    return (
      <PrefixTableBody
        irrSourceColumns={irrSourceColumns}
        prefixesData={sortedPrefixesData}
        reducedColour={reducedColour ?? false}
        filterWarningError={filterWarningError ?? false}
        handleIrrRouteSelect={handleIrrRouteSelect}
      />
    );
  };

  return (
    <>
      <div className="table-responsive">
        <table className="table table-sm mb-5 table-fixed table-striped">
          <PrefixTableHeader
            irrSourceColumns={irrSourceColumns}
            onSort={handleSort}
            reducedColour={reducedColour ?? false}
          />
          {renderTableContent()}
          <TableFooter url={apiCallUrl} />
        </table>
      </div>
      <WhoisModal ref={whoisModalRef} />
    </>
  );
}
