import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getRIRDistribution, RIRDistributionData } from '../../services/visualizationService';
import Spinner from '../common/spinner';
import './visualization.css';

const COLORS: Record<string, string> = {
  AFRINIC: '#FF6B6B',
  APNIC: '#4ECDC4',
  ARIN: '#45B7D1',
  LACNIC: '#FFA07A',
  RIPE: '#96CEB4',
};

interface DistributionResponse {
  distribution: (RIRDistributionData & { continent?: string; countries?: string[] })[];
  timestamp: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number }[];
}

export default function RIRDistribution() {
  const [distributionData, setDistributionData] = useState<DistributionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'prefixes' | 'ipv4' | 'ipv6'>('prefixes');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await getRIRDistribution();
        setDistributionData(data as unknown as DistributionResponse);
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

  if (!distributionData?.distribution) {
    return null;
  }

  const pieData = distributionData.distribution.map((rir) => ({
    name: rir.rir,
    value: rir.prefixes,
  }));

  const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="viz-tooltip">
          <p>
            <strong>{payload[0].name}</strong>
          </p>
          <p>Value: {payload[0].value.toLocaleString()}</p>
        </div>
      );
    }
    return null;
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
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={140} fill="#8884d8" dataKey="value" label>
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
                <Tooltip />
                <Legend />
                <Bar dataKey="prefixes" fill="#8884d8" name="Prefixes" />
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
                  <th>Prefixes</th>
                  <th>ASNs</th>
                </tr>
              </thead>
              <tbody>
                {distributionData.distribution.map((rir) => (
                  <tr key={rir.rir}>
                    <td>
                      <span className="rir-badge" style={{ backgroundColor: COLORS[rir.rir] || '#999' }}>
                        {rir.rir}
                      </span>
                    </td>
                    <td>{rir.prefixes.toLocaleString()}</td>
                    <td>{rir.asns.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
