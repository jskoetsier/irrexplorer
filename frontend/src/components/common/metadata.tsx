import { useState, useEffect, useCallback } from 'react';
import { orderBy } from 'lodash';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';

import Spinner from './spinner';
import api from '../../services/api';
import TableFooter from './tableFooter';

dayjs.extend(relativeTime);
dayjs.extend(utc);

export default function Metadata() {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [apiCallUrl, setApiCallUrl] = useState('');
  const [lastUpdateImporter, setLastUpdateImporter] = useState<string | null>(null);
  const [lastUpdateIrr, setLastUpdateIrr] = useState<[string, string][]>([]);

  const loadData = useCallback(async () => {
    setHasLoaded(false);
    setApiCallUrl('');
    setLastUpdateImporter(null);
    setLastUpdateIrr([]);

    const { data, url } = await api.getMetadata();
    if (data) {
      setHasLoaded(true);
      setApiCallUrl(url || '');
      setLastUpdateImporter(data.sources_last_update?.importer || null);
      const irrEntries = data.sources_last_update?.irr || {};
      setLastUpdateIrr(orderBy(Object.entries(irrEntries)));
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const renderDate = (date: string): string => {
    const dateParsed = dayjs(date);
    const format = 'YYYY-MM-DD HH:mm';
    return `${dateParsed.fromNow()} (${dateParsed.utc().format(format)} UTC)`;
  };

  const renderTablePlaceholder = (placeholder: React.ReactNode) => (
    <tbody>
      <tr>
        <td className="text-center">{placeholder}</td>
      </tr>
    </tbody>
  );

  const renderTableContent = () => {
    if (!hasLoaded) return renderTablePlaceholder(<Spinner />);

    return (
      <>
        <thead>
          <tr>
            <th>Source</th>
            <th>Last update</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>BGP and RIRstats</td>
            <td>{lastUpdateImporter ? renderDate(lastUpdateImporter) : 'N/A'}</td>
          </tr>
          {lastUpdateIrr.map(([source, lastUpdate]) => (
            <tr key={source}>
              <td>{source}</td>
              <td>{renderDate(lastUpdate)}</td>
            </tr>
          ))}
        </tbody>
        <TableFooter url={apiCallUrl} />
      </>
    );
  };

  return (
    <table style={{ width: 'auto' }} className="table table-fixed table-striped">
      {renderTableContent()}
    </table>
  );
}
