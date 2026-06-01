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
      setLastUpdateImporter(data.last_update?.importer || null);
      const irrEntries = data.last_update?.irr || {};
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

  if (!hasLoaded) {
    return (
      <div className="flex justify-center items-center py-xl bg-[#1e2024]/20 border border-[#3d4a3d]/20 rounded-xl">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="bg-[#1e2024]/40 border border-[#3d4a3d]/30 rounded-xl overflow-hidden shadow-2xl">
      <div className="px-lg py-md border-b border-[#3d4a3d]/20 bg-[#1e2024]/80 flex justify-between items-center">
        <h3 className="font-label-caps text-xs text-on-surface font-bold uppercase tracking-wider">Dynamic Data Mirror Metrics</h3>
        <span className="text-[10px] font-data-mono text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded uppercase tracking-wider font-bold">
          Live sync active
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#0c0e12] border-b border-[#3d4a3d]/30">
              <th className="px-lg py-3 font-label-caps text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Source Registry</th>
              <th className="px-lg py-3 font-label-caps text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Last Processed Update</th>
            </tr>
          </thead>
          <tbody className="font-data-mono text-xs divide-y divide-[#3d4a3d]/10">
            <tr className="hover:bg-[#333539]/10 transition-colors bg-[#0f1115]">
              <td className="px-lg py-3.5 text-on-surface font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                BGP and RIRstats
              </td>
              <td className="px-lg py-3.5 text-secondary">
                {lastUpdateImporter ? renderDate(lastUpdateImporter) : 'N/A'}
              </td>
            </tr>
            {lastUpdateIrr.map(([source, lastUpdate]) => (
              <tr key={source} className="zebra-row hover:bg-[#333539]/10 transition-colors">
                <td className="px-lg py-3.5 text-on-surface font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary/50"></span>
                  {source}
                </td>
                <td className="px-lg py-3.5 text-on-surface-variant">
                  {renderDate(lastUpdate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {apiCallUrl && <TableFooter url={apiCallUrl} />}
    </div>
  );
}
