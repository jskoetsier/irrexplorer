import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import Spinner from '../common/spinner';
import { Link } from 'react-router-dom';
import TableFooter from '../common/tableFooter';

interface SetExpansionTableProps {
  query: string;
  objectClass: 'as-set' | 'route-set';
}

interface SubSet {
  name: string;
  source: string;
  depth: number;
  path: string[];
  members: string[];
}

export default function SetExpansionTable({ query, objectClass }: SetExpansionTableProps) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [subSets, setSubSets] = useState<SubSet[]>([]);
  const [apiCallUrl, setApiCallUrl] = useState('');

  const load = useCallback(async () => {
    setHasLoaded(false);
    setSubSets([]);
    setApiCallUrl('');

    const { data, url } = await api.getSetExpansion(query);
    if (data) {
      setHasLoaded(true);
      setSubSets(Array.isArray(data) ? data : []);
      setApiCallUrl(url || '');
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  if (!hasLoaded) {
    return (
      <div className="flex justify-center items-center py-lg">
        <Spinner />
      </div>
    );
  }

  if (!subSets.length) {
    return (
      <div className="text-center py-lg font-data-mono text-xs text-on-surface-variant/40 bg-[#1e2024]/10 rounded-lg border border-[#3d4a3d]/20">
        No {objectClass} subsets found or resolved.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-[#3d4a3d]/20 bg-[#0f1115]">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-[#0c0e12] border-b border-[#3d4a3d]/30">
              <th className="px-lg py-2.5 font-label-caps text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Set Identifier</th>
              <th className="px-lg py-2.5 font-label-caps text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Source DB</th>
              <th className="px-lg py-2.5 font-label-caps text-[10px] text-on-surface-variant font-bold uppercase tracking-wider text-center">Depth</th>
              <th className="px-lg py-2.5 font-label-caps text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Resolution Path</th>
              <th className="px-lg py-2.5 font-label-caps text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Resolved Members</th>
            </tr>
          </thead>
          <tbody className="font-data-mono text-xs divide-y divide-[#3d4a3d]/10">
            {subSets.map(({ name, source, depth, path, members }) => (
              <tr key={name + path.join()} className="zebra-row hover:bg-[#333539]/10 transition-colors">
                <td className="px-lg py-3">
                  <Link to={`/${objectClass}/${name}`} className="text-primary hover:underline font-bold font-data-mono">
                    {name}
                  </Link>
                </td>
                <td className="px-lg py-3 text-secondary font-semibold">{source}</td>
                <td className="px-lg py-3 text-center">
                  <span className="bg-[#1e2024] text-on-surface px-2 py-0.5 rounded border border-[#3d4a3d]/20 text-[10px]">
                    {depth}
                  </span>
                </td>
                <td className="px-lg py-3 text-on-surface-variant text-[11px]">
                  {path.map((p, idx) => (
                    <span key={idx} className="inline-flex items-center">
                      {idx > 0 && <span className="text-primary/70 mx-1">➜</span>}
                      <span>{p}</span>
                    </span>
                  ))}
                </td>
                <td className="px-lg py-3">
                  <div className="flex flex-wrap gap-1 max-w-md">
                    {members.map((member, idx) => (
                      <Link
                        key={idx}
                        to={`/query/${member}`}
                        className="text-secondary hover:underline font-semibold bg-[#1e2024]/50 border border-[#3d4a3d]/10 px-1.5 py-0.5 rounded text-[10px]"
                      >
                        {member}
                      </Link>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[10px] text-on-surface-variant/40 italic font-body-sm pl-1">
        Expansion depth is limited beyond 1000 total {objectClass} objects.
      </div>
      {apiCallUrl && <TableFooter url={apiCallUrl} />}
    </div>
  );
}
