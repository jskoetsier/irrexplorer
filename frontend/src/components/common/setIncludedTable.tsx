import { useState, useEffect, useCallback } from 'react';
import { orderBy } from 'lodash';
import Spinner from '../common/spinner';
import api from '../../services/api';
import { Link } from 'react-router-dom';
import TableFooter from './tableFooter';

interface SetIncludedTableProps {
  query: string;
  objectClass: 'as-set' | 'route-set';
}

interface SetRow {
  setName: string;
  irrNames: string[];
}

export default function SetIncludedTable({ query, objectClass }: SetIncludedTableProps) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [irrsSeen, setIrrsSeen] = useState<string[]>([]);
  const [rows, setRows] = useState<SetRow[]>([]);
  const [apiCallUrl, setApiCallUrl] = useState('');

  const loadSetData = useCallback(async () => {
    setHasLoaded(false);
    setIrrsSeen([]);
    setRows([]);
    setApiCallUrl('');

    const response = await api.getSetMemberOf(query, objectClass);
    if (response.data) {
      const rawData = response.data as unknown as { setsPerIrr?: Record<string, string[]>; irrsSeen?: string[] };
      const irrsPerSet: Record<string, string[]> = {};
      if (rawData.setsPerIrr) {
        for (const [irrName, setNames] of Object.entries(rawData.setsPerIrr)) {
          for (const setName of setNames) {
            const existingEntries = irrsPerSet[setName] || [];
            irrsPerSet[setName] = [...existingEntries, irrName];
          }
        }
      }

      const newRows: SetRow[] = [];
      for (const [setName, irrNames] of Object.entries(irrsPerSet)) {
        newRows.push({ setName, irrNames });
      }

      setRows(orderBy(newRows, ['setName']));
      setIrrsSeen(rawData.irrsSeen || []);
      setHasLoaded(true);
      setApiCallUrl(response.url || '');
    }
  }, [query, objectClass]);

  useEffect(() => {
    loadSetData();
  }, [loadSetData]);

  if (!hasLoaded) {
    return (
      <div className="flex justify-center items-center py-lg">
        <Spinner />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="text-center py-lg font-data-mono text-xs text-on-surface-variant/40 bg-[#1e2024]/10 rounded-lg border border-[#3d4a3d]/20">
        No covering {objectClass}s were resolved.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-[#3d4a3d]/20 bg-[#0f1115]">
        <table className="w-full text-left border-collapse min-w-[300px]">
          <thead>
            <tr className="bg-[#0c0e12] border-b border-[#3d4a3d]/30">
              <th className="px-lg py-2.5 font-label-caps text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Set Object Name</th>
              {irrsSeen.map((irrName) => (
                <th key={irrName} className="px-lg py-2.5 font-label-caps text-[10px] text-on-surface-variant font-bold uppercase tracking-wider text-center">{irrName}</th>
              ))}
            </tr>
          </thead>
          <tbody className="font-data-mono text-xs divide-y divide-[#3d4a3d]/10">
            {rows.map(({ setName, irrNames: irrNamesForRow }) => (
              <tr key={setName} className="zebra-row hover:bg-[#333539]/10 transition-colors">
                <td className="px-lg py-3">
                  <Link to={`/${objectClass}/${setName}`} className="text-primary hover:underline font-bold font-data-mono">
                    {setName}
                  </Link>
                </td>
                {irrsSeen.map((seenIrr) => (
                  <td key={seenIrr} className="px-lg py-3 text-center">
                    {irrNamesForRow.includes(seenIrr) ? (
                      <span className="material-symbols-outlined text-primary text-sm leading-none" title={`Present in ${seenIrr}`}>
                        check_circle
                      </span>
                    ) : (
                      <span className="text-on-surface-variant/10 text-[10px] font-bold">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {apiCallUrl && <TableFooter url={apiCallUrl} />}
    </div>
  );
}
