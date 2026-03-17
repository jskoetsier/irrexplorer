import { useState, useEffect, useCallback } from 'react';
import './DataSourcesModal.css';
import {
  getLookingGlassPrefix,
  getLookingGlassAsn,
  getRdapIp,
  getRdapAsn,
  getPeeringDbAsn,
} from '../../services/dataSourceService';

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
        <div className="data-content">
          <h4>
            AS{query} - {lgData.as_name || 'Unknown'}
          </h4>
          <div className="data-section">
            <h5>Announced Prefixes ({lgData.total_prefixes || 0})</h5>
            {lgData.prefixes && lgData.prefixes.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Prefix</th>
                    <th>Origin</th>
                    <th>Peers</th>
                  </tr>
                </thead>
                <tbody>
                  {lgData.prefixes.slice(0, 20).map((prefix, idx) => (
                    <tr key={idx}>
                      <td>
                        <code>{prefix.prefix}</code>
                      </td>
                      <td>{prefix.origin}</td>
                      <td>{prefix.peers?.length || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No prefixes found</p>
            )}
          </div>
        </div>
      );
    }

    const lgData = data as { total_routes?: number; routes?: RouteData[] };
    return (
      <div className="data-content">
        <h4>Prefix: {query}</h4>
        <div className="data-section">
          <h5>BGP Routes ({lgData.total_routes || 0})</h5>
          {lgData.routes && lgData.routes.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>AS Path</th>
                  <th>Origin ASN</th>
                  <th>Next Hop</th>
                  <th>Communities</th>
                </tr>
              </thead>
              <tbody>
                {lgData.routes.map((route, idx) => (
                  <tr key={idx}>
                    <td>
                      <code>{route.as_path ? route.as_path.join(' ') : 'N/A'}</code>
                    </td>
                    <td>AS{route.origin_asn}</td>
                    <td>{route.next_hop}</td>
                    <td>{route.communities?.join(', ') || 'None'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No routes found</p>
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
        <div className="data-content">
          <h4>AS{rdapData.asn} Registration Data</h4>
          <div className="data-section">
            <div className="info-grid">
              <div className="info-item">
                <strong>Name:</strong> {rdapData.name || 'N/A'}
              </div>
              <div className="info-item">
                <strong>Country:</strong> {rdapData.country || 'N/A'}
              </div>
              <div className="info-item">
                <strong>Type:</strong> {rdapData.type || 'N/A'}
              </div>
              <div className="info-item">
                <strong>RIR:</strong> {rdapData.rir?.toUpperCase() || 'N/A'}
              </div>
              <div className="info-item">
                <strong>Handle:</strong> {rdapData.handle || 'N/A'}
              </div>
              <div className="info-item">
                <strong>Registration Date:</strong> {rdapData.registration_date || 'N/A'}
              </div>
              <div className="info-item">
                <strong>Last Changed:</strong> {rdapData.last_changed_date || 'N/A'}
              </div>
              <div className="info-item">
                <strong>Status:</strong> {rdapData.status?.join(', ') || 'N/A'}
              </div>
            </div>
          </div>
          {rdapData.entities && rdapData.entities.length > 0 && (
            <div className="data-section">
              <h5>Entities</h5>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Handle</th>
                    <th>Name</th>
                    <th>Roles</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {rdapData.entities?.map((entity, idx) => (
                    <tr key={idx}>
                      <td>{entity.handle}</td>
                      <td>{entity.name}</td>
                      <td>{entity.roles?.join(', ') || 'N/A'}</td>
                      <td>{entity.email || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="data-content">
        <h4>IP Registration Data</h4>
        <div className="data-section">
          <div className="info-grid">
            <div className="info-item">
              <strong>Range:</strong> {rdapData.start_address} - {rdapData.end_address}
            </div>
            <div className="info-item">
              <strong>Name:</strong> {rdapData.name || 'N/A'}
            </div>
            <div className="info-item">
              <strong>Country:</strong> {rdapData.country || 'N/A'}
            </div>
            <div className="info-item">
              <strong>Type:</strong> {rdapData.type || 'N/A'}
            </div>
            <div className="info-item">
              <strong>RIR:</strong> {rdapData.rir?.toUpperCase() || 'N/A'}
            </div>
            <div className="info-item">
              <strong>Handle:</strong> {rdapData.handle || 'N/A'}
            </div>
            <div className="info-item">
              <strong>Registration Date:</strong> {rdapData.registration_date || 'N/A'}
            </div>
            <div className="info-item">
              <strong>Status:</strong> {rdapData.status?.join(', ') || 'N/A'}
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
      <div className="data-content">
        <h4>
          AS{pdbData.asn} - {pdbData.name}
        </h4>
        <div className="data-section">
          <div className="info-grid">
            <div className="info-item">
              <strong>AKA:</strong> {pdbData.aka || 'N/A'}
            </div>
            <div className="info-item">
              <strong>Website:</strong>{' '}
              {pdbData.website ? (
                <a href={pdbData.website} target="_blank" rel="noopener noreferrer">
                  {pdbData.website}
                </a>
              ) : (
                'N/A'
              )}
            </div>
            <div className="info-item">
              <strong>Looking Glass:</strong>{' '}
              {pdbData.looking_glass ? (
                <a href={pdbData.looking_glass} target="_blank" rel="noopener noreferrer">
                  {pdbData.looking_glass}
                </a>
              ) : (
                'N/A'
              )}
            </div>
            <div className="info-item">
              <strong>IRR AS-SET:</strong> {pdbData.irr_as_set || 'N/A'}
            </div>
            <div className="info-item">
              <strong>Policy:</strong> {pdbData.policy_general || 'N/A'}
            </div>
            <div className="info-item">
              <strong>Traffic:</strong> {pdbData.info_traffic || 'N/A'}
            </div>
            <div className="info-item">
              <strong>IPv4 Prefixes:</strong> {pdbData.info_prefixes4 || 'N/A'}
            </div>
            <div className="info-item">
              <strong>IPv6 Prefixes:</strong> {pdbData.info_prefixes6 || 'N/A'}
            </div>
          </div>
        </div>

        {pdbData.facilities && pdbData.facilities.length > 0 && (
          <div className="data-section">
            <h5>Facilities ({pdbData.facilities.length})</h5>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>City</th>
                  <th>Country</th>
                </tr>
              </thead>
              <tbody>
                {pdbData.facilities.slice(0, 10).map((facility, idx) => (
                  <tr key={idx}>
                    <td>{facility.name}</td>
                    <td>{facility.city}</td>
                    <td>{facility.country}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pdbData.ix_connections && pdbData.ix_connections.length > 0 && (
          <div className="data-section">
            <h5>Internet Exchange Connections ({pdbData.ix_connections.length})</h5>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>IPv4</th>
                  <th>IPv6</th>
                  <th>Speed</th>
                  <th>RS Peer</th>
                </tr>
              </thead>
              <tbody>
                {pdbData.ix_connections.slice(0, 10).map((ix, idx) => (
                  <tr key={idx}>
                    <td>{ix.name}</td>
                    <td>{ix.ipaddr4 || 'N/A'}</td>
                    <td>{ix.ipaddr6 || 'N/A'}</td>
                    <td>{ix.speed || 'N/A'}</td>
                    <td>{ix.is_rs_peer ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return <div className="loading">Loading data...</div>;
    }

    if (error) {
      return <div className="error-message">Error: {error}</div>;
    }

    switch (activeTab) {
      case 'looking-glass':
        return renderLookingGlassData();
      case 'rdap':
        return renderRdapData();
      case 'peeringdb':
        return renderPeeringDbData();
      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick} role="presentation">
      <div className="modal-content" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3>External Data Sources - {query}</h3>
          <button className="close-button" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'looking-glass' ? 'active' : ''}`}
            onClick={() => setActiveTab('looking-glass')}
          >
            BGP Looking Glass
          </button>
          <button
            className={`tab ${activeTab === 'rdap' ? 'active' : ''}`}
            onClick={() => setActiveTab('rdap')}
          >
            RDAP
          </button>
          {type === 'asn' && (
            <button
              className={`tab ${activeTab === 'peeringdb' ? 'active' : ''}`}
              onClick={() => setActiveTab('peeringdb')}
            >
              PeeringDB
            </button>
          )}
        </div>

        <div className="modal-body">{renderContent()}</div>
      </div>
    </div>
  );
}
