import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getHistoricalTimeline } from '../../services/visualizationService';
import Spinner from '../common/spinner';
import './visualization.css';

interface TimelineResponse {
  timeline: { date: string; queries: number; unique_users?: number }[];
  top_queries_by_date?: Record<string, { query: string; type: string; count: number }[]>;
  timestamp: string;
}

export default function HistoricalTimeline() {
  const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await getHistoricalTimeline(days);
        setTimelineData(data as unknown as TimelineResponse);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [days]);

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

  if (!timelineData?.timeline?.length) {
    return null;
  }

  const totalQueries = timelineData.timeline.reduce((sum, day) => sum + (day.queries || 0), 0);

  return (
    <div className="visualization-container">
      <div className="viz-header">
        <h2>Historical Timeline</h2>
        <p className="text-muted">Query activity and trends over time</p>
      </div>

      <div className="viz-controls">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="btn-group" role="group">
            {[7, 30, 60, 90].map((d) => (
              <button
                key={d}
                type="button"
                className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setDays(d)}
              >
                {d} Days
              </button>
            ))}
          </div>

          <div className="btn-group" role="group">
            <button
              type="button"
              className={`btn btn-sm ${chartType === 'line' ? 'btn-secondary' : 'btn-outline-secondary'}`}
              onClick={() => setChartType('line')}
            >
              Line Chart
            </button>
            <button
              type="button"
              className={`btn btn-sm ${chartType === 'bar' ? 'btn-secondary' : 'btn-outline-secondary'}`}
              onClick={() => setChartType('bar')}
            >
              Bar Chart
            </button>
          </div>
        </div>
      </div>

      <div className="viz-content">
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            {chartType === 'line' ? (
              <LineChart data={timelineData.timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="queries" stroke="#8884d8" name="Queries" />
              </LineChart>
            ) : (
              <BarChart data={timelineData.timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="queries" fill="#8884d8" name="Queries" />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="viz-stats mt-4">
          <h4>Summary Statistics</h4>
          <div className="row">
            <div className="col-md-4">
              <div className="stat-card">
                <h5>Total Queries</h5>
                <p className="stat-value">{totalQueries.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
