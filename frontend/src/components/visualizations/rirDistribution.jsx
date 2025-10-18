import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getRIRDistribution } from '../../services/visualizationService';
import Spinner from '../common/spinner';
import './visualization.css';

const COLORS = {
  'AFRINIC': '#FF6B6B',
  'APNIC': '#4ECDC4',
  'ARIN': '#45B7D1',
  'LACNIC': '#FFA07A',
  'RIPE': '#96CEB4'
};

const RIRDistribution = () => {
  const [distributionData, setDistributionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('prefixes');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getRIRDistribution();
      setDistributionData(data);
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

  const pieData = distributionData.distribution.map(rir => ({
    name: rir.rir,
    value: activeView === 'prefixes' ? rir.prefix_count :
           activeView === 'ipv4' ? rir.total_ipv4_ips :
           rir.total_ipv6_ips
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const rirData = distributionData.distribution.find(r => r.rir === data.name);

      return (
        <div className="viz-tooltip">
          <p><strong>{data.name}</strong></p>
          <p>{rirData.continent}</p>
          <p>Prefixes: {rirData.prefix_count.toLocaleString()}</p>
          <p>IPv4: {rirData.ipv4_count.toLocaleString()}</p>
          <p>IPv6: {rirData.ipv6_count.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize="12"
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="visualization-container">
      <div className="viz-header">
        <h2>RIR Distribution</h2>
        <p className="text-muted">Geographical distribution of IP address allocations by Regional Internet Registry</p>
      </div>

      <div className="viz-controls">
        <div className="btn-group" role="group">
          <button
            type="button"
            className={`btn btn-sm ${activeView === 'prefixes' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setActiveView('prefixes')}
          >
            Prefix Count
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeView === 'ipv4' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setActiveView('ipv4')}
          >
            IPv4 Addresses
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeView === 'ipv6' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setActiveView('ipv6')}
          >
            IPv6 Addresses
          </button>
        </div>
      </div>

      <div className="viz-content">
        <div className="row">
          <div className="col-md-6">
            <h4>Distribution Chart</h4>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  outerRadius={140}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#999'} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="col-md-6">
            <h4>Comparison</h4>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={distributionData.distribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="rir" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="ipv4_count" fill="#8884d8" name="IPv4 Prefixes" />
                <Bar dataKey="ipv6_count" fill="#82ca9d" name="IPv6 Prefixes" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="viz-stats mt-4">
          <h4>RIR Details</h4>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>RIR</th>
                  <th>Region</th>
                  <th>Total Prefixes</th>
                  <th>IPv4 Prefixes</th>
                  <th>IPv6 Prefixes</th>
                  <th>IPv4 Addresses</th>
                  <th>IPv6 Addresses</th>
                </tr>
              </thead>
              <tbody>
                {distributionData.distribution.map((rir) => (
                  <tr key={rir.rir}>
                    <td>
                      <span className="rir-badge" style={{ backgroundColor: COLORS[rir.rir] }}>
                        {rir.rir}
                      </span>
                    </td>
                    <td>{rir.continent}</td>
                    <td>{rir.prefix_count.toLocaleString()}</td>
                    <td>{rir.ipv4_count.toLocaleString()}</td>
                    <td>{rir.ipv6_count.toLocaleString()}</td>
                    <td>{rir.total_ipv4_ips.toLocaleString()}</td>
                    <td title={rir.total_ipv6_ips.toExponential(2)}>
                      {rir.total_ipv6_ips > 1e15 ? rir.total_ipv6_ips.toExponential(2) : rir.total_ipv6_ips.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="table-secondary">
                  <td colSpan="2"><strong>Total</strong></td>
                  <td><strong>{distributionData.distribution.reduce((sum, r) => sum + r.prefix_count, 0).toLocaleString()}</strong></td>
                  <td><strong>{distributionData.distribution.reduce((sum, r) => sum + r.ipv4_count, 0).toLocaleString()}</strong></td>
                  <td><strong>{distributionData.distribution.reduce((sum, r) => sum + r.ipv6_count, 0).toLocaleString()}</strong></td>
                  <td><strong>{distributionData.distribution.reduce((sum, r) => sum + r.total_ipv4_ips, 0).toLocaleString()}</strong></td>
                  <td><strong>-</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="rir-info mt-4">
            <h5>About Regional Internet Registries</h5>
            <div className="row">
              {distributionData.distribution.map((rir) => (
                <div className="col-md-6" key={rir.rir}>
                  <div className="info-card" style={{ borderLeft: `4px solid ${COLORS[rir.rir]}` }}>
                    <h6>{rir.rir}</h6>
                    <p className="text-muted mb-1">{rir.continent}</p>
                    <p className="mb-0">
                      <small>Key countries: {rir.countries.join(', ')}</small>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="viz-footer">
        <small className="text-muted">
          Last updated: {new Date(distributionData.timestamp).toLocaleString()}
        </small>
      </div>
    </div>
  );
};

export default RIRDistribution;
