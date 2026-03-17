import { useEffect, useState } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { getPrefixAllocationData } from '../../services/visualizationService';
import Spinner from '../common/spinner';
import './visualization.css';

interface AllocationItem {
  name: string;
  asn?: number;
  prefix_count: number;
  total_ips: number;
}

interface AllocationData {
  rir_allocations: AllocationItem[];
  top_asns: AllocationItem[];
  timestamp: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: AllocationItem }[];
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="viz-tooltip">
        <p>
          <strong>{data.name || `AS${data.asn}`}</strong>
        </p>
        <p>Prefix Count: {data.prefix_count?.toLocaleString()}</p>
        <p>Total IPs: {data.total_ips?.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

export default function PrefixAllocation() {
  const [allocationData, setAllocationData] = useState<AllocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'rir' | 'asn'>('rir');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const allocation = await getPrefixAllocationData();
        setAllocationData(allocation as unknown as AllocationData);
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

  if (!allocationData?.rir_allocations) {
    return null;
  }

  const currentData = activeView === 'rir' ? allocationData.rir_allocations : allocationData.top_asns?.slice(0, 50) || [];

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
                <p className="stat-value">{allocationData.top_asns?.length || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
