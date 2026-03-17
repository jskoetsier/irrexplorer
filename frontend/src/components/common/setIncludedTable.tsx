import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle } from '@fortawesome/free-regular-svg-icons';
import { orderBy } from 'lodash';
import Spinner from './spinner';
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

  const renderTablePlaceholder = (placeholder: React.ReactNode) => (
    <tbody>
      <tr>
        <td className="text-center">{placeholder}</td>
      </tr>
    </tbody>
  );

  const renderTableContent = () => {
    if (!hasLoaded) return renderTablePlaceholder(<Spinner />);
    if (!rows.length) return renderTablePlaceholder(`No ${objectClass}s were found.`);

    return (
      <>
        <thead>
          <tr>
            <th key="name">Name</th>
            {irrsSeen.map((irrName) => (
              <th key={irrName}>{irrName}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ setName, irrNames: irrNamesForRow }) => (
            <tr key={setName}>
              <td key="name">
                <Link to={`/${objectClass}/${setName}`}>{setName}</Link>
              </td>
              {irrsSeen.map((seenIrr) => (
                <td key={seenIrr} className="text-center">
                  {irrNamesForRow.includes(seenIrr) ? (
                    <FontAwesomeIcon icon={faCheckCircle} title={`Present in ${seenIrr}`} />
                  ) : (
                    ''
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <TableFooter url={apiCallUrl} />
      </>
    );
  };

  return (
    <div className="table-responsive">
      <table style={{ width: 'auto' }} className="table mb-5 table-fixed">
        {renderTableContent()}
      </table>
    </div>
  );
}
