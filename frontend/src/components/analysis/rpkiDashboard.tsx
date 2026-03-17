import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getRPKIDashboard, RPKIDashboardData } from '../../services/analysisService';
import Spinner from '../common/spinner';
import './analysis.css';

const STATUS_COLORS: Record<string, string> = {
  valid: '#28a745',
  invalid: '#dc3545',
  not_found: '#ffc107',
  unknown: '#6c757d',
};

interface StatusData {
  count: number;
  percentage: number;
}

interface DashboardResponse extends RPKIDashboardData {
  status_breakdown?: Record<string, StatusData>;
  roa_coverage_by_rir?: { rir: string; valid: number; not_found: number; total_prefixes: number; coverage_percentage: number }[];
  timestamp: string;
  note?: string;
}

export default function RPKIDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await getRPKIDashboard();
        setDashboardData(data as DashboardResponse);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

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
        <div className="alert alert-warning">No data available</div>
      </div>
    );
  }

  const statusBreakdown = dashboardData.status_breakdown || {};
  const roaCoverage = dashboardData.roa_coverage_by_rir || [];

  const pieData = Object.keys(statusBreakdown).map((status) => ({
    name: status.replace('_', ' ').toUpperCase(),
    value: statusBreakdown[status]?.count || 0,
    percentage: statusBreakdown[status]?.percentage || 0,
  }));

  return (
    <div className="analysis-container">
      <div className="analysis-header">
        <h2>RPKI Validation Dashboard</h2>
        <p className="text-muted">Overview of routing status across all BGP routes</p>
        {dashboardData.note && (
          <div className="alert alert-info mt-2">
            <small>
              <i className="fas fa-info-circle me-2"></i>
              {dashboardData.note}
            </small>
          </div>
        )}
      </div>

      <div className="row">
        <div className="col-md-8">
          <div className="analysis-card">
            <h4>Status Distribution</h4>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }: { name: string; percentage: number }) => `${name}: ${percentage}%`}
                  outerRadius={140}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name.toLowerCase().replace(' ', '_')] || '#999'} />
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
                <span className="stat-value">{(dashboardData.total_prefixes || 0).toLocaleString()}</span>
              </div>
              {Object.keys(statusBreakdown).map((status) => (
                <div className="stat-item" key={status}>
                  <span className="stat-label">{status.replace('_', ' ').toUpperCase()}:</span>
                  <span className="stat-value">
                    {(statusBreakdown[status]?.count || 0).toLocaleString()} ({statusBreakdown[status]?.percentage || 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {roaCoverage.length > 0 && (
        <div className="row mt-4">
          <div className="col-md-12">
            <div className="analysis-card">
              <h4>RIR Coverage</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={roaCoverage}>
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
      )}

      <div className="analysis-footer">
        <small className="text-muted">Last updated: {new Date(dashboardData.timestamp).toLocaleString()}</small>
      </div>
    </div>
  );
}
