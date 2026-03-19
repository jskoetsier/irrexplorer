import { useMemo, useRef, useState, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

import Spinner from '../common/spinner';
import { findIrrSourceColumns, sortPrefixesDataBy } from '../../utils/prefixData';
import PrefixTableHeader from './prefixTableHeader';
import WhoisModal, { WhoisModalHandle } from './whoisModal';
import TableFooter from '../common/tableFooter';
import type { PrefixData, RPKIStatus } from '../../types';
import VirtualPrefixTableRow from './VirtualPrefixTableRow';

interface VirtualPrefixTableProps {
  prefixesData: PrefixData[];
  hasLoaded: boolean;
  reducedColour?: boolean;
  filterWarningError?: boolean;
  apiCallUrl?: string;
  defaultSortSmallestFirst?: boolean;
}

const ROW_HEIGHT = 48; // Height of each table row in pixels
const MAX_TABLE_HEIGHT = 600; // Maximum table height before scrolling

export default function VirtualPrefixTable({
  prefixesData,
  hasLoaded,
  reducedColour,
  filterWarningError,
  apiCallUrl,
  defaultSortSmallestFirst,
}: VirtualPrefixTableProps) {
  const whoisModalRef = useRef<WhoisModalHandle>(null);
  const [sortKey, setSortKey] = useState(defaultSortSmallestFirst ? 'prefixSmallestFirst' : 'prefix');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const irrSourceColumns = useMemo(() => {
    return findIrrSourceColumns(prefixesData);
  }, [prefixesData]);

  const sortedPrefixesData = useMemo(() => {
    return sortPrefixesDataBy(prefixesData, sortKey, sortOrder);
  }, [prefixesData, sortKey, sortOrder]);

  // Filter data if needed
  const filteredData = useMemo(() => {
    if (!filterWarningError) return sortedPrefixesData;
    return sortedPrefixesData.filter(
      ({ categoryOverall }) => categoryOverall === 'danger' || categoryOverall === 'warning'
    );
  }, [sortedPrefixesData, filterWarningError]);

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

  const renderTableContent = () => {
    if (!hasLoaded) {
      return (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner />
        </div>
      );
    }
    if (!filteredData.length) {
      return (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          No prefixes were found or query was too large to execute.
        </div>
      );
    }

    const tableHeight = Math.min(filteredData.length * ROW_HEIGHT, MAX_TABLE_HEIGHT);

    return (
      <AutoSizer disableHeight>
        {({ width }) => (
          <List
            height={tableHeight}
            itemCount={filteredData.length}
            itemSize={ROW_HEIGHT}
            width={width}
            itemData={{
              data: filteredData,
              irrSourceColumns,
              reducedColour: reducedColour ?? false,
              handleIrrRouteSelect,
            }}
          >
            {VirtualPrefixTableRow}
          </List>
        )}
      </AutoSizer>
    );
  };

  return (
    <>
      <div className="table-responsive">
        <table className="table table-sm mb-0 table-fixed table-striped">
          <PrefixTableHeader
            irrSourceColumns={irrSourceColumns}
            onSort={handleSort}
            reducedColour={reducedColour ?? false}
          />
        </table>
        {renderTableContent()}
        <table className="table table-sm mb-5 table-fixed">
          <TableFooter url={apiCallUrl} />
        </table>
      </div>
      <WhoisModal ref={whoisModalRef} />
    </>
  );
}
