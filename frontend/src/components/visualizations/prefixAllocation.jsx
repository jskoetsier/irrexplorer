import React, { useEffect, useState } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { getPrefixAllocationData, getPrefixSizeDistribution } from '../../services/visualizationService';
import Spinner from '../common/spinner';
import './visualization.css';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="viz-tooltip">
        <p><strong>{data.name || `AS${data.asn}`}</strong></p>
        <p>Prefix Count: {data.prefix_count?.toLocaleString()}</p>
        <p>Total IPs: {data.total_ips?.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

const PrefixAllocation = () => {
  const [allocationData, setAllocationData] = useState(null);
  const [distributionData, setDistributionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('rir');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allocation, distribution] = await Promise.all([
        getPrefixAllocationData(),
        getPrefixSizeDistribution()
      ]);
      setAllocationData(allocation);
      setDistributionData(distribution);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="visualization-container">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="visualization-container">
        <div className="alert alert-danger">Error loading data: {error}</div>
      </div>
    );
  }

  const currentData = activeView === 'rir'
    ? allocationData.rir_allocations
    : allocationData.top_asns.slice(0, 50);

  return (
    <div className="visualization-container">
      <div className="viz-header">
        <h2>Prefix Allocation Map</h2>
        <p className="text-muted">Interactive visualization of prefix allocations by RIR and ASN</p>
      </div>

      <div className="viz-controls">
        <div className="btn-group" role="group">
          <button
            type="button"
            className={`btn btn-sm ${activeView === 'rir' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setActiveView('rir')}
          >
            By RIR
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeView === 'asn' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setActiveView('asn')}
          >
            Top 50 ASNs
          </button>
        </div>
      </div>

      <div className="viz-content">
        <div className="treemap-container">
          <ResponsiveContainer width="100%" height={500}>
            <Treemap
              data={currentData}
              dataKey="total_ips"
              nameKey={activeView === 'rir' ? 'name' : 'asn'}
              stroke="#fff"
              fill="#8884d8"
              content={<CustomizedContent activeView={activeView} />}
            >
              <Tooltip content={<CustomTooltip />} />
            </Treemap>
          </ResponsiveContainer>
        </div>

        <div className="viz-stats">
          <h4>Statistics</h4>
          <div className="row">
            <div className="col-md-6">
              <div className="stat-card">
                <h5>Total RIRs</h5>
                <p className="stat-value">{allocationData.rir_allocations.length}</p>
              </div>
            </div>
            <div className="col-md-6">
              <div className="stat-card">
                <h5>Total ASNs (Top 100)</h5>
                <p className="stat-value">{allocationData.top_asns.length}</p>
              </div>
            </div>
          </div>

          {activeView === 'rir' && (
            <div className="data-table">
              <h5>RIR Breakdown</h5>
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>RIR</th>
                    <th>Prefixes</th>
                    <th>Total IPs</th>
                  </tr>
                </thead>
                <tbody>
                  {allocationData.rir_allocations.map((rir) => (
                    <tr key={rir.name}>
                      <td><strong>{rir.name}</strong></td>
                      <td>{rir.prefix_count.toLocaleString()}</td>
                      <td>{rir.total_ips.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="viz-footer">
        <small className="text-muted">
          Last updated: {new Date(allocationData.timestamp).toLocaleString()}
        </small>
      </div>
    </div>
  );
};

const CustomizedContent = ({ activeView, root, depth, x, y, width, height, index, colors, name }) => {
  const fontSize = width < 100 ? 10 : 12;
  const showText = width > 50 && height > 30;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: depth < 2 ? colors[Math.floor((index / root.children.length) * 6)] : 'none',
          stroke: '#fff',
          strokeWidth: 2 / (depth + 1e-10),
          strokeOpacity: 1 / (depth + 1e-10),
        }}
      />
      {showText && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          fill="#fff"
          fontSize={fontSize}
          fontWeight="bold"
        >
          {activeView === 'rir' ? name : `AS${name}`}
        </text>
      )}
    </g>
  );
};

export default PrefixAllocation;
