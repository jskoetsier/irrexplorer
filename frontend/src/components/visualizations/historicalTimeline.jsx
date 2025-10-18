import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { getHistoricalTimeline } from '../../services/visualizationService';
import Spinner from '../common/spinner';
import './visualization.css';

const HistoricalTimeline = () => {
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);
  const [chartType, setChartType] = useState('line');

  useEffect(() => {
    loadData(days);
  }, [days]);

  const loadData = async (numDays) => {
    try {
      setLoading(true);
      const data = await getHistoricalTimeline(numDays);
      setTimelineData(data);
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

  if (!timelineData || !timelineData.timeline || timelineData.timeline.length === 0) {
    return null;
  }

  const totalQueries = timelineData.timeline.reduce((sum, day) => sum + day.total, 0);
  const avgPerDay = Math.round(totalQueries / timelineData.timeline.length);
  const peakDay = timelineData.timeline.reduce((max, day) =>
    day.total > max.total ? day : max, timelineData.timeline[0]);

  const ChartComponent = chartType === 'line' ? LineChart : BarChart;
  const DataComponent = chartType === 'line' ? Line : Bar;

  return (
    <div className="visualization-container">
      <div className="viz-header">
        <h2>Historical Timeline</h2>
        <p className="text-muted">Query activity and trends over time</p>
      </div>

      <div className="viz-controls">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="btn-group" role="group">
            <button
              type="button"
              className={`btn btn-sm ${days === 7 ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setDays(7)}
            >
              7 Days
            </button>
            <button
              type="button"
              className={`btn btn-sm ${days === 30 ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setDays(30)}
            >
              30 Days
            </button>
            <button
              type="button"
              className={`btn btn-sm ${days === 60 ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setDays(60)}
            >
              60 Days
            </button>
            <button
              type="button"
              className={`btn btn-sm ${days === 90 ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setDays(90)}
            >
              90 Days
            </button>
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
            <ChartComponent data={timelineData.timeline} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd' }}
              />
              <Legend />
              <DataComponent type="monotone" dataKey="asn" stackId="1" stroke="#8884d8" fill="#8884d8" name="ASN Queries" />
              <DataComponent type="monotone" dataKey="prefix" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Prefix Queries" />
              <DataComponent type="monotone" dataKey="set" stackId="1" stroke="#ffc658" fill="#ffc658" name="Set Queries" />
            </ChartComponent>
          </ResponsiveContainer>
        </div>

        <div className="viz-stats mt-4">
          <h4>Summary Statistics</h4>
          <div className="row">
            <div className="col-md-3">
              <div className="stat-card">
                <h5>Total Queries</h5>
                <p className="stat-value">{totalQueries.toLocaleString()}</p>
              </div>
            </div>
            <div className="col-md-3">
              <div className="stat-card">
                <h5>Average Per Day</h5>
                <p className="stat-value">{avgPerDay.toLocaleString()}</p>
              </div>
            </div>
            <div className="col-md-3">
              <div className="stat-card">
                <h5>Peak Day</h5>
                <p className="stat-value">{new Date(peakDay.date).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="col-md-3">
              <div className="stat-card">
                <h5>Peak Queries</h5>
                <p className="stat-value">{peakDay.total.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="data-table mt-3">
            <h5>Top Queries by Day</h5>
            <div className="accordion" id="topQueriesAccordion">
              {Object.keys(timelineData.top_queries_by_date)
                .sort()
                .reverse()
                .slice(0, 10)
                .map((date, index) => (
                  <div className="accordion-item" key={date}>
                    <h2 className="accordion-header" id={`heading${index}`}>
                      <button
                        className={`accordion-button ${index !== 0 ? 'collapsed' : ''}`}
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target={`#collapse${index}`}
                        aria-expanded={index === 0}
                        aria-controls={`collapse${index}`}
                      >
                        {new Date(date).toLocaleDateString()} - Top {timelineData.top_queries_by_date[date].length} Queries
                      </button>
                    </h2>
                    <div
                      id={`collapse${index}`}
                      className={`accordion-collapse collapse ${index === 0 ? 'show' : ''}`}
                      aria-labelledby={`heading${index}`}
                      data-bs-parent="#topQueriesAccordion"
                    >
                      <div className="accordion-body">
                        <table className="table table-sm mb-0">
                          <thead>
                            <tr>
                              <th>Query</th>
                              <th>Type</th>
                              <th>Count</th>
                            </tr>
                          </thead>
                          <tbody>
                            {timelineData.top_queries_by_date[date].map((query, qIndex) => (
                              <tr key={qIndex}>
                                <td><code>{query.query}</code></td>
                                <td>
                                  <span className={`badge bg-${query.type === 'asn' ? 'primary' : query.type === 'prefix' ? 'success' : 'warning'}`}>
                                    {query.type}
                                  </span>
                                </td>
                                <td>{query.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      <div className="viz-footer">
        <small className="text-muted">
          Last updated: {new Date(timelineData.timestamp).toLocaleString()}
        </small>
      </div>
    </div>
  );
};

export default HistoricalTimeline;
