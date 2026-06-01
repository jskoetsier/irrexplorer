import { useState, useEffect, useCallback } from 'react';
import {
  getLookingGlassPrefix,
  getLookingGlassAsn,
  getRdapIp,
  getRdapAsn,
  getPeeringDbAsn,
} from '../../services/dataSourceService';
import Spinner from '../common/spinner';

interface DataSourcesModalProps {
  query: string;
  type: 'prefix' | 'asn';
  onClose: () => void;
}

interface RouteData {
  prefix?: string;
  origin?: number;
  peers?: string[];
  as_path?: number[];
  origin_asn?: number;
  next_hop?: string;
  communities?: string[];
}

interface RdapData {
  asn?: number;
  name?: string;
  country?: string;
  type?: string;
  rir?: string;
  handle?: string;
  registration_date?: string;
  last_changed_date?: string;
  status?: string[];
  entities?: { handle: string; name: string; roles: string[]; email?: string }[];
  start_address?: string;
  end_address?: string;
}

interface PeeringDbData {
  asn: number;
  name: string;
  aka?: string;
  website?: string;
  looking_glass?: string;
  irr_as_set?: string;
  policy_general?: string;
  info_traffic?: string;
  info_prefixes4?: number;
  info_prefixes6?: number;
  facilities?: { name: string; city: string; country: string }[];
  ix_connections?: { name: string; ipaddr4?: string; ipaddr6?: string; speed?: string; is_rs_peer?: boolean }[];
}

export default function DataSourcesModal({ query, type, onClose }: DataSourcesModalProps) {
  const [activeTab, setActiveTab] = useState<'looking-glass' | 'rdap' | 'peeringdb'>('looking-glass');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RouteData | RdapData | PeeringDbData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(
    async (tab: 'looking-glass' | 'rdap' | 'peeringdb') => {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        let result;
        if (tab === 'looking-glass') {
          if (type === 'asn') {
            result = await getLookingGlassAsn(query);
          } else {
            result = await getLookingGlassPrefix(query);
          }
        } else if (tab === 'rdap') {
          if (type === 'asn') {
            result = await getRdapAsn(query);
          } else {
            const ip = query.split('/')[0];
            result = await getRdapIp(ip);
          }
        } else if (tab === 'peeringdb') {
          if (type === 'asn') {
            result = await getPeeringDbAsn(query);
          }
        }

        if (result) {
          setData(result as RouteData | RdapData | PeeringDbData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    },
    [query, type]
  );

  useEffect(() => {
    if (query) {
      loadData(activeTab);
    }
  }, [query, activeTab, loadData]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const renderLookingGlassData = () => {
    if (!data) return null;

    if (type === 'asn') {
      const lgData = data as RouteData & { as_name?: string; total_prefixes?: number; prefixes?: RouteData[] };
      return (
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-on-surface bg-[#111317] border border-[#3d4a3d]/20 px-3 py-2 rounded font-data-mono">
            AS{query} - {lgData.as_name || 'Unknown'}
          </h4>
          <div className="space-y-2">
            <h5 className="font-label-caps text-xs text-primary font-bold tracking-wider uppercase">Announced Prefixes ({lgData.total_prefixes || 0})</h5>
            {lgData.prefixes && lgData.prefixes.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-[#3d4a3d]/20 bg-[#0f1115]">
                <table className="w-full text-left border-collapse text-xs font-data-mono">
                  <thead>
                    <tr className="bg-[#0c0e12] border-b border-[#3d4a3d]/30 text-on-surface-variant uppercase text-[10px] font-bold">
                      <th className="px-4 py-2">Prefix</th>
                      <th className="px-4 py-2">Origin</th>
                      <th className="px-4 py-2 text-center">Peers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3d4a3d]/10">
                    {lgData.prefixes.slice(0, 20).map((prefix, idx) => (
                      <tr key={idx} className="hover:bg-[#333539]/20 transition-colors">
                        <td className="px-4 py-2 text-primary font-bold">{prefix.prefix}</td>
                        <td className="px-4 py-2">AS{prefix.origin}</td>
                        <td className="px-4 py-2 text-center text-on-surface-variant">{prefix.peers?.length || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant font-data-mono italic">No prefixes registered.</p>
            )}
          </div>
        </div>
      );
    }

    const lgData = data as { total_routes?: number; routes?: RouteData[] };
    return (
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-on-surface bg-[#111317] border border-[#3d4a3d]/20 px-3 py-2 rounded font-data-mono">
          Prefix: {query}
        </h4>
        <div className="space-y-2">
          <h5 className="font-label-caps text-xs text-primary font-bold tracking-wider uppercase">BGP Routes ({lgData.total_routes || 0})</h5>
          {lgData.routes && lgData.routes.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-[#3d4a3d]/20 bg-[#0f1115]">
              <table className="w-full text-left border-collapse text-xs font-data-mono">
                <thead>
                  <tr className="bg-[#0c0e12] border-b border-[#3d4a3d]/30 text-on-surface-variant uppercase text-[10px] font-bold">
                    <th className="px-4 py-2">AS Path</th>
                    <th className="px-4 py-2">Origin ASN</th>
                    <th className="px-4 py-2">Next Hop</th>
                    <th className="px-4 py-2">Communities</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3d4a3d]/10">
                  {lgData.routes.map((route, idx) => (
                    <tr key={idx} className="hover:bg-[#333539]/20 transition-colors">
                      <td className="px-4 py-2.5 text-secondary font-bold font-data-mono">
                        {route.as_path ? route.as_path.join(' ➜ ') : 'N/A'}
                      </td>
                      <td className="px-4 py-2.5 text-primary">AS{route.origin_asn}</td>
                      <td className="px-4 py-2.5 text-on-surface-variant">{route.next_hop}</td>
                      <td className="px-4 py-2.5 text-on-surface-variant max-w-xs truncate">{route.communities?.join(', ') || 'None'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-on-surface-variant font-data-mono italic">No routes resolved.</p>
          )}
        </div>
      </div>
    );
  };

  const renderRdapData = () => {
    if (!data) return null;

    const rdapData = data as RdapData;

    if (type === 'asn') {
      return (
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-on-surface bg-[#111317] border border-[#3d4a3d]/20 px-3 py-2 rounded font-data-mono">
            AS{rdapData.asn} Registration Data
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#111317]/50 p-4 rounded-xl border border-[#3d4a3d]/20 text-xs">
            <div className="space-y-2">
              <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
                <span className="text-on-surface-variant">Name:</span>
                <span className="font-semibold text-on-surface">{rdapData.name || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
                <span className="text-on-surface-variant">Country:</span>
                <span className="font-semibold text-on-surface font-data-mono">{rdapData.country || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
                <span className="text-on-surface-variant">Type:</span>
                <span className="font-semibold text-on-surface uppercase">{rdapData.type || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
                <span className="text-on-surface-variant">RIR Handle:</span>
                <span className="font-semibold text-primary font-data-mono">{rdapData.rir?.toUpperCase() || 'N/A'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
                <span className="text-on-surface-variant">Object Handle:</span>
                <span className="font-semibold text-on-surface font-data-mono">{rdapData.handle || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
                <span className="text-on-surface-variant">Registration:</span>
                <span className="font-semibold text-on-surface font-data-mono">{rdapData.registration_date || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
                <span className="text-on-surface-variant">Last Changed:</span>
                <span className="font-semibold text-secondary font-data-mono">{rdapData.last_changed_date || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
                <span className="text-on-surface-variant">Status:</span>
                <span className="font-semibold text-on-surface">{rdapData.status?.join(', ') || 'N/A'}</span>
              </div>
            </div>
          </div>
          
          {rdapData.entities && rdapData.entities.length > 0 && (
            <div className="space-y-2">
              <h5 className="font-label-caps text-xs text-primary font-bold tracking-wider uppercase">Associated Entities</h5>
              <div className="overflow-x-auto rounded-lg border border-[#3d4a3d]/20 bg-[#0f1115]">
                <table className="w-full text-left border-collapse text-xs font-data-mono">
                  <thead>
                    <tr className="bg-[#0c0e12] border-b border-[#3d4a3d]/30 text-on-surface-variant uppercase text-[10px] font-bold">
                      <th className="px-4 py-2">Handle</th>
                      <th className="px-4 py-2">Organization Name</th>
                      <th className="px-4 py-2">Roles</th>
                      <th className="px-4 py-2">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3d4a3d]/10">
                    {rdapData.entities.map((entity, idx) => (
                      <tr key={idx} className="hover:bg-[#333539]/20 transition-colors">
                        <td className="px-4 py-2 text-primary font-bold">{entity.handle}</td>
                        <td className="px-4 py-2 text-on-surface">{entity.name}</td>
                        <td className="px-4 py-2">
                          <span className="bg-[#1e2024] px-2 py-0.5 rounded border border-[#3d4a3d]/20 font-bold uppercase tracking-wider text-[10px]">
                            {entity.roles?.join(', ') || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-on-surface-variant">{entity.email || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-on-surface bg-[#111317] border border-[#3d4a3d]/20 px-3 py-2 rounded font-data-mono">
          IP Registration Data
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#111317]/50 p-4 rounded-xl border border-[#3d4a3d]/20 text-xs">
          <div className="space-y-2">
            <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
              <span className="text-on-surface-variant">Range Allocation:</span>
              <span className="font-semibold text-primary font-data-mono">{rdapData.start_address} - {rdapData.end_address}</span>
            </div>
            <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
              <span className="text-on-surface-variant">Organization Name:</span>
              <span className="font-semibold text-on-surface">{rdapData.name || 'N/A'}</span>
            </div>
            <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
              <span className="text-on-surface-variant">Country:</span>
              <span className="font-semibold text-on-surface font-data-mono">{rdapData.country || 'N/A'}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
              <span className="text-on-surface-variant">Allocation Type:</span>
              <span className="font-semibold text-on-surface uppercase">{rdapData.type || 'N/A'}</span>
            </div>
            <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
              <span className="text-on-surface-variant">Responsible RIR:</span>
              <span className="font-semibold text-primary font-data-mono">{rdapData.rir?.toUpperCase() || 'N/A'}</span>
            </div>
            <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
              <span className="text-on-surface-variant">Status Flags:</span>
              <span className="font-semibold text-on-surface font-data-mono">{rdapData.status?.join(', ') || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPeeringDbData = () => {
    if (!data || type !== 'asn') return null;

    const pdbData = data as PeeringDbData;

    return (
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-on-surface bg-[#111317] border border-[#3d4a3d]/20 px-3 py-2 rounded font-data-mono">
          AS{pdbData.asn} - {pdbData.name}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#111317]/50 p-4 rounded-xl border border-[#3d4a3d]/20 text-xs">
          <div className="space-y-2">
            <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
              <span className="text-on-surface-variant">Aliases (AKA):</span>
              <span className="font-semibold text-on-surface">{pdbData.aka || 'N/A'}</span>
            </div>
            <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
              <span className="text-on-surface-variant">Website:</span>
              {pdbData.website ? (
                <a href={pdbData.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">
                  {pdbData.website}
                </a>
              ) : (
                <span className="text-on-surface font-semibold">N/A</span>
              )}
            </div>
            <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
              <span className="text-on-surface-variant">Looking Glass:</span>
              {pdbData.looking_glass ? (
                <a href={pdbData.looking_glass} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">
                  {pdbData.looking_glass}
                </a>
              ) : (
                <span className="text-on-surface font-semibold">N/A</span>
              )}
            </div>
            <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
              <span className="text-on-surface-variant">IRR AS-SET:</span>
              <span className="font-semibold text-secondary font-data-mono">{pdbData.irr_as_set || 'N/A'}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
              <span className="text-on-surface-variant">Peering Policy:</span>
              <span className="font-semibold text-on-surface uppercase">{pdbData.policy_general || 'N/A'}</span>
            </div>
            <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
              <span className="text-on-surface-variant">Est. Traffic Volume:</span>
              <span className="font-semibold text-on-surface">{pdbData.info_traffic || 'N/A'}</span>
            </div>
            <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
              <span className="text-on-surface-variant">IPv4 Route Limits:</span>
              <span className="font-semibold text-on-surface font-data-mono">{pdbData.info_prefixes4 || 'N/A'}</span>
            </div>
            <div className="flex justify-between border-b border-[#3d4a3d]/10 pb-1">
              <span className="text-on-surface-variant">IPv6 Route Limits:</span>
              <span className="font-semibold text-on-surface font-data-mono">{pdbData.info_prefixes6 || 'N/A'}</span>
            </div>
          </div>
        </div>

        {pdbData.facilities && pdbData.facilities.length > 0 && (
          <div className="space-y-2">
            <h5 className="font-label-caps text-xs text-primary font-bold tracking-wider uppercase">Connected Facilities ({pdbData.facilities.length})</h5>
            <div className="overflow-x-auto rounded-lg border border-[#3d4a3d]/20 bg-[#0f1115]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0c0e12] border-b border-[#3d4a3d]/30 text-on-surface-variant uppercase text-[10px] font-bold">
                    <th className="px-4 py-2">Facility Name</th>
                    <th className="px-4 py-2">City</th>
                    <th className="px-4 py-2">Country</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3d4a3d]/10 font-data-mono text-[11px]">
                  {pdbData.facilities.slice(0, 10).map((facility, idx) => (
                    <tr key={idx} className="hover:bg-[#333539]/20 transition-colors">
                      <td className="px-4 py-2 text-on-surface font-semibold">{facility.name}</td>
                      <td className="px-4 py-2 text-on-surface-variant">{facility.city}</td>
                      <td className="px-4 py-2 text-on-surface-variant uppercase">{facility.country}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {pdbData.ix_connections && pdbData.ix_connections.length > 0 && (
          <div className="space-y-2">
            <h5 className="font-label-caps text-xs text-primary font-bold tracking-wider uppercase">IX Peering Connections ({pdbData.ix_connections.length})</h5>
            <div className="overflow-x-auto rounded-lg border border-[#3d4a3d]/20 bg-[#0f1115]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0c0e12] border-b border-[#3d4a3d]/30 text-on-surface-variant uppercase text-[10px] font-bold">
                    <th className="px-4 py-2">Exchange Name</th>
                    <th className="px-4 py-2">IPv4 Address</th>
                    <th className="px-4 py-2">IPv6 Address</th>
                    <th className="px-4 py-2 text-center">Port Speed</th>
                    <th className="px-4 py-2 text-center">Route Server</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3d4a3d]/10 font-data-mono text-[11px]">
                  {pdbData.ix_connections.slice(0, 10).map((ix, idx) => (
                    <tr key={idx} className="hover:bg-[#333539]/20 transition-colors">
                      <td className="px-4 py-2 text-on-surface font-semibold">{ix.name}</td>
                      <td className="px-4 py-2 text-primary">{ix.ipaddr4 || '—'}</td>
                      <td className="px-4 py-2 text-secondary">{ix.ipaddr6 || '—'}</td>
                      <td className="px-4 py-2 text-center text-on-surface-variant font-bold">{ix.speed || 'N/A'}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                          ix.is_rs_peer ? 'bg-[#22c55e]/10 text-primary border-primary/20' : 'bg-transparent text-on-surface-variant border-[#3d4a3d]/30'
                        }`}>
                          {ix.is_rs_peer ? 'Yes' : 'No'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto outline-none select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={handleOverlayClick}
      ></div>

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl mx-4 my-6 z-50 animate-in zoom-in-95 duration-150">
        <div className="relative flex flex-col w-full bg-[#1e2024] border border-[#3d4a3d]/40 rounded-xl shadow-2xl overflow-hidden text-[#e2e2e8]">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#3d4a3d]/20 bg-[#1e2024]">
            <h3 className="font-headline-md text-base font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">database</span>
              <span>External Sources - {query}</span>
            </h3>
            <button
              onClick={onClose}
              className="text-on-surface-variant hover:text-on-surface p-1 hover:bg-[#333539]/30 rounded transition-all flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-lg leading-none">close</span>
            </button>
          </div>

          {/* Redesigned Premium Tab Buttons */}
          <div className="flex border-b border-[#3d4a3d]/20 bg-[#1a1c20]/60 px-6 gap-2">
            <button
              onClick={() => setActiveTab('looking-glass')}
              className={`py-3 px-4 text-xs font-label-caps font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeTab === 'looking-glass' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              BGP Looking Glass
            </button>
            <button
              onClick={() => setActiveTab('rdap')}
              className={`py-3 px-4 text-xs font-label-caps font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeTab === 'rdap' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              RDAP Registration
            </button>
            {type === 'asn' && (
              <button
                onClick={() => setActiveTab('peeringdb')}
                className={`py-3 px-4 text-xs font-label-caps font-bold uppercase tracking-wider transition-all border-b-2 ${
                  activeTab === 'peeringdb' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                PeeringDB Registry
              </button>
            )}
          </div>

          {/* Body */}
          <div className="relative p-6 flex-auto max-h-[60vh] overflow-y-auto bg-[#0f1115]/50">
            {loading ? (
              <div className="flex justify-center items-center py-xl">
                <Spinner />
              </div>
            ) : error ? (
              <div className="bg-red-950/20 border-l-4 border-red-500 p-4 rounded-r text-red-400 font-semibold text-xs font-data-mono">
                Error retrieving API data: {error}
              </div>
            ) : (
              <div className="animate-in fade-in duration-200">
                {activeTab === 'looking-glass' && renderLookingGlassData()}
                {activeTab === 'rdap' && renderRdapData()}
                {activeTab === 'peeringdb' && renderPeeringDbData()}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-6 py-3 border-t border-[#3d4a3d]/20 bg-[#1e2024]/40">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-[#3d4a3d]/30 hover:bg-[#333539]/30 rounded-lg text-xs font-label-caps font-bold text-on-surface uppercase tracking-wider transition-colors"
            >
              Close Details
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
