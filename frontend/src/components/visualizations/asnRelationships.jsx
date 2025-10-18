import React, { useEffect, useState, useRef, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { getASNRelationships } from '../../services/visualizationService';
import Spinner from '../common/spinner';
import './visualization.css';

const ASNRelationships = ({ defaultASN }) => {
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [asn, setAsn] = useState(defaultASN || '');
  const [inputValue, setInputValue] = useState(defaultASN || '');
  const graphRef = useRef();

  useEffect(() => {
    if (defaultASN) {
      loadData(defaultASN);
    }
  }, [defaultASN]);

  const loadData = async (targetASN) => {
    if (!targetASN) return;

    try {
      setLoading(true);
      setAsn(targetASN);
      const data = await getASNRelationships(targetASN);
      setGraphData(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const cleanASN = inputValue.replace(/^AS/i, '');
    loadData(cleanASN);
  };

  const handleNodeClick = useCallback((node) => {
    if (node.id !== parseInt(asn)) {
      setInputValue(node.id.toString());
      loadData(node.id);
    }
  }, [asn]);

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const label = node.label;
    const fontSize = 12 / globalScale;
    const nodeSize = node.type === 'target' ? 8 : 5;

    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI, false);
    ctx.fillStyle = node.type === 'target' ? '#ff6b6b' : '#4ecdc4';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5 / globalScale;
    ctx.stroke();

    ctx.font = `${fontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#333';
    ctx.fillText(label, node.x, node.y + nodeSize + fontSize);
  }, []);

  const linkCanvasObject = useCallback((link, ctx) => {
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = Math.sqrt(link.weight) * 0.5;
    ctx.beginPath();
    ctx.moveTo(link.source.x, link.source.y);
    ctx.lineTo(link.target.x, link.target.y);
    ctx.stroke();
  }, []);

  if (loading && !graphData) {
    return (
      <div className="visualization-container">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="visualization-container">
      <div className="viz-header">
        <h2>ASN Relationship Graph</h2>
        <p className="text-muted">Network graph showing ASN relationships based on prefix overlaps</p>
      </div>

      <div className="viz-controls">
        <form onSubmit={handleSearch} className="d-flex align-items-center gap-2">
          <div className="input-group">
            <span className="input-group-text">ASN</span>
            <input
              type="text"
              className="form-control"
              placeholder="Enter ASN (e.g., 13335)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Loading...' : 'Visualize'}
          </button>
        </form>
      </div>

      {error && (
        <div className="alert alert-danger mt-3">
          Error loading data: {error}
        </div>
      )}

      {graphData && !error && (
        <>
          <div className="viz-content">
            <div className="graph-container">
              <ForceGraph2D
                ref={graphRef}
                graphData={graphData}
                nodeId="id"
                nodeLabel={(node) => `${node.label} (${node.prefix_count} prefixes)`}
                nodeCanvasObject={nodeCanvasObject}
                linkCanvasObject={linkCanvasObject}
                onNodeClick={handleNodeClick}
                linkDirectionalParticles={2}
                linkDirectionalParticleWidth={2}
                d3VelocityDecay={0.3}
                cooldownTicks={100}
                width={window.innerWidth * 0.9}
                height={600}
              />
            </div>

            <div className="viz-stats mt-4">
              <h4>Network Statistics</h4>
              <div className="row">
                <div className="col-md-4">
                  <div className="stat-card">
                    <h5>Target ASN</h5>
                    <p className="stat-value">AS{asn}</p>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="stat-card">
                    <h5>Related ASNs</h5>
                    <p className="stat-value">{graphData.nodes.length - 1}</p>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="stat-card">
                    <h5>Total Connections</h5>
                    <p className="stat-value">{graphData.edges.length}</p>
                  </div>
                </div>
              </div>

              <div className="data-table mt-3">
                <h5>Top Related ASNs</h5>
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>ASN</th>
                      <th>Shared Prefixes</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {graphData.edges.slice(0, 10).map((edge) => (
                      <tr key={edge.target}>
                        <td><strong>AS{edge.target}</strong></td>
                        <td>{edge.weight}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => {
                              setInputValue(edge.target.toString());
                              loadData(edge.target);
                            }}
                          >
                            Explore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="viz-footer">
            <div className="legend">
              <span className="legend-item">
                <span className="legend-circle" style={{ backgroundColor: '#ff6b6b' }}></span>
                Target ASN
              </span>
              <span className="legend-item">
                <span className="legend-circle" style={{ backgroundColor: '#4ecdc4' }}></span>
                Related ASN
              </span>
            </div>
            <small className="text-muted">
              Last updated: {new Date(graphData.timestamp).toLocaleString()}
            </small>
          </div>
        </>
      )}
    </div>
  );
};

export default ASNRelationships;
