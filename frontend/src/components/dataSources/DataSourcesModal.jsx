import React, { useState, useEffect } from 'react';
import './DataSourcesModal.css';
import {
  getLookingGlassPrefix,
  getLookingGlassAsn,
  getRdapIp,
  getRdapAsn,
  getPeeringDbAsn
} from '../../services/dataSourceService';

const DataSourcesModal = ({ query, type, onClose }) => {
  const [activeTab, setActiveTab] = useState('looking-glass');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (query) {
      loadData(activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeTab]);

  const loadData = async (tab) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      let result;
      if (tab === 'looking-glass') {
        if (type === 'asn') {
          result = await getLookingGlassAsn(query);
        } else if (type === 'prefix') {
          result = await getLookingGlassPrefix(query);
        }
      } else if (tab === 'rdap') {
        if (type === 'asn') {
          result = await getRdapAsn(query);
        } else if (type === 'prefix') {
          // Extract IP from prefix for RDAP
          const ip = query.split('/')[0];
          result = await getRdapIp(ip);
        }
      } else if (tab === 'peeringdb') {
        if (type === 'asn') {
          result = await getPeeringDbAsn(query);
        }
      }

      if (result && result.error) {
        setError(result.error);
      } else {
        setData(result);
      }
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const renderLookingGlassData = () => {
    if (!data) return null;

    if (type === 'asn') {
      return (
        <div className="data-content">
          <h4>AS{query} - {data.as_name || 'Unknown'}</h4>
          <div className="data-section">
            <h5>Announced Prefixes ({data.total_prefixes || 0})</h5>
            {data.prefixes && data.prefixes.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Prefix</th>
                    <th>Origin</th>
                    <th>Peers</th>
                  </tr>
                </thead>
                <tbody>
                  {data.prefixes.slice(0, 20).map((prefix, idx) => (
                    <tr key={idx}>
                      <td><code>{prefix.prefix}</code></td>
                      <td>{prefix.origin}</td>
                      <td>{prefix.peers ? prefix.peers.length : 0}</td>
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
    } else if (type === 'prefix') {
      return (
        <div className="data-content">
          <h4>Prefix: {query}</h4>
          <div className="data-section">
            <h5>BGP Routes ({data.total_routes || 0})</h5>
            {data.routes && data.routes.length > 0 ? (
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
                  {data.routes.map((route, idx) => (
                    <tr key={idx}>
                      <td><code>{route.as_path ? route.as_path.join(' ') : 'N/A'}</code></td>
                      <td>AS{route.origin_asn}</td>
                      <td>{route.next_hop}</td>
                      <td>{route.communities ? route.communities.join(', ') : 'None'}</td>
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
    }
  };

  const renderRdapData = () => {
    if (!data) return null;

    if (type === 'asn') {
      return (
        <div className="data-content">
          <h4>AS{data.asn} Registration Data</h4>
          <div className="data-section">
            <div className="info-grid">
              <div className="info-item">
                <strong>Name:</strong> {data.name || 'N/A'}
              </div>
              <div className="info-item">
                <strong>Country:</strong> {data.country || 'N/A'}
              </div>
              <div className="info-item">
                <strong>Type:</strong> {data.type || 'N/A'}
              </div>
              <div className="info-item">
                <strong>RIR:</strong> {data.rir ? data.rir.toUpperCase() : 'N/A'}
              </div>
              <div className="info-item">
                <strong>Handle:</strong> {data.handle || 'N/A'}
              </div>
              <div className="info-item">
                <strong>Registration Date:</strong> {data.registration_date || 'N/A'}
              </div>
              <div className="info-item">
                <strong>Last Changed:</strong> {data.last_changed_date || 'N/A'}
              </div>
              <div className="info-item">
                <strong>Status:</strong> {data.status ? data.status.join(', ') : 'N/A'}
              </div>
            </div>
          </div>
          {data.entities && data.entities.length > 0 && (
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
                  {data.entities.map((entity, idx) => (
                    <tr key={idx}>
                      <td>{entity.handle}</td>
                      <td>{entity.name}</td>
                      <td>{entity.roles ? entity.roles.join(', ') : 'N/A'}</td>
                      <td>{entity.email || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    } else if (type === 'prefix') {
      return (
        <div className="data-content">
          <h4>IP Registration Data</h4>
          <div className="data-section">
            <div className="info-grid">
              <div className="info-item">
                <strong>Range:</strong> {data.start_address} - {data.end_address}
              </div>
              <div className="info-item">
                <strong>Name:</strong> {data.name || 'N/A'}
              </div>
              <div className="info-item">
                <strong>Country:</strong> {data.country || 'N/A'}
              </div>
              <div className="info-item">
                <strong>Type:</strong> {data.type || 'N/A'}
              </div>
              <div className="info-item">
                <strong>RIR:</strong> {data.rir ? data.rir.toUpperCase() : 'N/A'}
              </div>
              <div className="info-item">
                <strong>Handle:</strong> {data.handle || 'N/A'}
              </div>
              <div className="info-item">
                <strong>Registration Date:</strong> {data.registration_date || 'N/A'}
              </div>
              <div className="info-item">
                <strong>Status:</strong> {data.status ? data.status.join(', ') : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      );
    }
  };

  const renderPeeringDbData = () => {
    if (!data || type !== 'asn') return null;

    return (
      <div className="data-content">
        <h4>AS{data.asn} - {data.name}</h4>
        <div className="data-section">
          <div className="info-grid">
            <div className="info-item">
              <strong>AKA:</strong> {data.aka || 'N/A'}
            </div>
            <div className="info-item">
              <strong>Website:</strong>
              {data.website ? <a href={data.website} target="_blank" rel="noopener noreferrer">{data.website}</a> : 'N/A'}
            </div>
            <div className="info-item">
              <strong>Looking Glass:</strong>
              {data.looking_glass ? <a href={data.looking_glass} target="_blank" rel="noopener noreferrer">{data.looking_glass}</a> : 'N/A'}
            </div>
            <div className="info-item">
              <strong>IRR AS-SET:</strong> {data.irr_as_set || 'N/A'}
            </div>
            <div className="info-item">
              <strong>Policy:</strong> {data.policy_general || 'N/A'}
            </div>
            <div className="info-item">
              <strong>Traffic:</strong> {data.info_traffic || 'N/A'}
            </div>
            <div className="info-item">
              <strong>IPv4 Prefixes:</strong> {data.info_prefixes4 || 'N/A'}
            </div>
            <div className="info-item">
              <strong>IPv6 Prefixes:</strong> {data.info_prefixes6 || 'N/A'}
            </div>
          </div>
        </div>

        {data.facilities && data.facilities.length > 0 && (
          <div className="data-section">
            <h5>Facilities ({data.facilities.length})</h5>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>City</th>
                  <th>Country</th>
                </tr>
              </thead>
              <tbody>
                {data.facilities.slice(0, 10).map((facility, idx) => (
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

        {data.ix_connections && data.ix_connections.length > 0 && (
          <div className="data-section">
            <h5>Internet Exchange Connections ({data.ix_connections.length})</h5>
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
                {data.ix_connections.slice(0, 10).map((ix, idx) => (
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

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  React.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h3>External Data Sources - {query}</h3>
          <button className="close-button" onClick={onClose}>&times;</button>
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

        <div className="modal-body">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default DataSourcesModal;
