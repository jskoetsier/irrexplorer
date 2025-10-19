import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getRPKIDashboard } from '../../services/analysisService';
import Spinner from '../common/spinner';
import './analysis.css';

const STATUS_COLORS = {
  valid: '#28a745',
  invalid: '#dc3545',
  not_found: '#ffc107',
  unknown: '#6c757d',
  announced: '#007bff'
};

const RPKIDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getRPKIDashboard();
      console.log('RPKI Dashboard Data:', data);
      setDashboardData(data);
      setError(null);
    } catch (err) {
      console.error('RPKI Dashboard Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="analysis-container">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="analysis-container">
        <div className="alert alert-danger">Error loading data: {error}</div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="analysis-container">
        <div className="alert alert-warning">No data available - dashboardData is null</div>
      </div>
    );
  }

  if (!dashboardData.status_breakdown) {
    return (
      <div className="analysis-container">
        <div className="alert alert-warning">
          No data available - status_breakdown is missing
          <pre>{JSON.stringify(dashboardData, null, 2)}</pre>
        </div>
      </div>
    );
  }

  const pieData = Object.keys(dashboardData.status_breakdown || {}).map(status => ({
    name: status.replace('_', ' ').toUpperCase(),
    value: dashboardData.status_breakdown[status]?.count || 0,
    percentage: dashboardData.status_breakdown[status]?.percentage || 0
  }));

  return (
    <div className="analysis-container">
      <div className="analysis-header">
        <h2>RPKI Validation Dashboard</h2>
        <p className="text-muted">Overview of RPKI validation status across all BGP routes</p>
      </div>

      <div className="row">
        <div className="col-md-8">
          <div className="analysis-card">
            <h4>Validation Status Distribution</h4>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  outerRadius={140}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name.toLowerCase().replace(' ', '_')]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-md-4">
          <div className="analysis-card">
            <h4>Summary Statistics</h4>
            <div className="stats-list">
              <div className="stat-item">
                <span className="stat-label">Total Prefixes:</span>
                <span className="stat-value">{dashboardData.total_prefixes.toLocaleString()}</span>
              </div>
              {Object.keys(dashboardData.status_breakdown || {}).map(status => (
                <div className="stat-item" key={status}>
                  <span className="stat-label">{status.replace('_', ' ').toUpperCase()}:</span>
                  <span className="stat-value">
                    {(dashboardData.status_breakdown[status].count || 0).toLocaleString()}
                    {' '}
                    ({dashboardData.status_breakdown[status].percentage || 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {dashboardData.roa_coverage_by_rir && dashboardData.roa_coverage_by_rir.length > 0 && (
        <>
          <div className="row mt-4">
            <div className="col-md-12">
              <div className="analysis-card">
                <h4>ROA Coverage by RIR</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboardData.roa_coverage_by_rir}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="rir" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="valid" fill="#28a745" name="Announced" />
                    <Bar dataKey="not_found" fill="#ffc107" name="Not Announced" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="row mt-4">
            <div className="col-md-12">
              <div className="analysis-card">
                <h4>RIR Coverage Details</h4>
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>RIR</th>
                        <th>Total Prefixes</th>
                        <th>Announced</th>
                        <th>Not Announced</th>
                        <th>Coverage %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.roa_coverage_by_rir.map(rir => (
                        <tr key={rir.rir}>
                          <td><strong>{rir.rir}</strong></td>
                          <td>{rir.total_prefixes.toLocaleString()}</td>
                          <td><span className="badge bg-success">{rir.valid}</span></td>
                          <td><span className="badge bg-warning text-dark">{rir.not_found}</span></td>
                          <td>{rir.coverage_percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="analysis-footer">
        <small className="text-muted">
          Last updated: {new Date(dashboardData.timestamp).toLocaleString()}
        </small>
      </div>
    </div>
  );
};

export default RPKIDashboard;
