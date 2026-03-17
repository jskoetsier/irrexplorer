import { useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort, faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons';

interface PrefixTableHeaderProps {
  irrSourceColumns: string[];
  onSort: (sort: { key: string; order: 'asc' | 'desc' }) => void;
  reducedColour?: boolean;
}

export default function PrefixTableHeader({ irrSourceColumns, onSort, reducedColour }: PrefixTableHeaderProps) {
  const [sortColumn, setSortColumn] = useState({ key: 'prefix', order: 'asc' as 'asc' | 'desc' });

  const handleSort = useCallback(
    (key: string) => {
      const newSortColumn = { ...sortColumn };
      if (newSortColumn.key === key) {
        newSortColumn.order = newSortColumn.order === 'asc' ? 'desc' : 'asc';
      } else {
        newSortColumn.key = key;
        newSortColumn.order = 'asc';
      }
      setSortColumn(newSortColumn);
      onSort(newSortColumn);
    },
    [sortColumn, onSort]
  );

  const renderCell = (label: string, cellSortKey: string | null) => {
    if (!cellSortKey) return <th key={label}>{label}</th>;

    const { key: currentKey, order } = sortColumn;

    let sortIcon = faSort;
    if (cellSortKey === currentKey && order === 'asc') sortIcon = faSortDown;
    if (cellSortKey === currentKey && order === 'desc') sortIcon = faSortUp;

    return (
      <th
        key={cellSortKey}
        scope="col"
        className="clickable nowrap"
        tabIndex={0}
        onClick={() => handleSort(cellSortKey)}
        onKeyDown={() => handleSort(cellSortKey)}
      >
        {label} <FontAwesomeIcon icon={sortIcon} />
      </th>
    );
  };

  return (
    <thead>
      <tr>
        {renderCell('Prefix', 'prefix')}
        {renderCell('RIR', 'rir')}
        {renderCell('BGP', 'bgpOrigins')}
        {renderCell('RPKI', 'rpkiRoutes')}
        {irrSourceColumns.map((sourceName) => renderCell(sourceName, `irrRoutes.${sourceName}`))}
        {reducedColour && renderCell('', null)}
        {renderCell('Advice', 'messages')}
      </tr>
    </thead>
  );
}
