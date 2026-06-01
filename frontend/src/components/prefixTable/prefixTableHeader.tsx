import { useState, useCallback } from 'react';

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
    if (!cellSortKey) {
      return (
        <th key={label} className="px-4 py-3 bg-[#0c0e12] border-b border-[#3d4a3d]/30 text-on-surface-variant font-label-caps text-[10px] uppercase font-bold tracking-wider">
          {label}
        </th>
      );
    }

    const { key: currentKey, order } = sortColumn;
    const isActive = cellSortKey === currentKey;

    return (
      <th
        key={cellSortKey}
        scope="col"
        onClick={() => handleSort(cellSortKey)}
        className="px-4 py-3 bg-[#0c0e12] border-b border-[#3d4a3d]/30 text-on-surface-variant font-label-caps text-[10px] uppercase font-bold tracking-wider cursor-pointer hover:text-on-surface select-none transition-colors"
      >
        <div className="flex items-center gap-1">
          <span>{label}</span>
          <span className={`material-symbols-outlined text-[14px] leading-none transition-transform duration-150 ${
            isActive ? (order === 'asc' ? 'text-primary rotate-180' : 'text-primary') : 'text-on-surface-variant/30'
          }`}>
            arrow_downward
          </span>
        </div>
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
