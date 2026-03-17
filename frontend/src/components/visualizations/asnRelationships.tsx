import { useEffect, useState, useCallback, FormEvent } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { getASNRelationships } from '../../services/visualizationService';
import Spinner from '../common/spinner';
import './visualization.css';

interface GraphNode {
  id: number;
  label: string;
  type: 'target' | 'related';
  prefix_count?: number;
  x?: number;
  y?: number;
}

interface GraphEdge {
  source: number | GraphNode;
  target: number | GraphNode;
  weight: number;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  timestamp?: string;
}

interface ASNRelationshipsProps {
  defaultASN?: string;
}

export default function ASNRelationships({ defaultASN }: ASNRelationshipsProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asn, setAsn] = useState(defaultASN || '');
  const [inputValue, setInputValue] = useState(defaultASN || '');

  useEffect(() => {
    if (defaultASN) {
      loadData(defaultASN);
    }
  }, [defaultASN]);

  const loadData = async (targetASN: string) => {
    if (!targetASN) return;

    try {
      setLoading(true);
      setAsn(targetASN);
      const data = await getASNRelationships(targetASN);
      const graphData = data as unknown as { nodes: GraphNode[]; links?: GraphEdge[]; edges?: GraphEdge[]; timestamp?: string };
      setGraphData({ nodes: graphData.nodes || [], edges: graphData.links || graphData.edges || [], timestamp: graphData.timestamp });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanASN = inputValue.replace(/^AS/i, '');
    loadData(cleanASN);
  };

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.id.toString() !== asn) {
        setInputValue(node.id.toString());
        loadData(node.id.toString());
      }
    },
    [asn]
  );

  const nodeCanvasObject = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.label || `AS${node.id}`;
    const fontSize = 12 / globalScale;
    const nodeSize = node.type === 'target' ? 8 : 5;

    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, nodeSize, 0, 2 * Math.PI, false);
    ctx.fillStyle = node.type === 'target' ? '#ff6b6b' : '#4ecdc4';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5 / globalScale;
    ctx.stroke();

    ctx.font = `${fontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#333';
    ctx.fillText(label, node.x || 0, (node.y || 0) + nodeSize + fontSize);
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

      {error && <div className="alert alert-danger mt-3">Error loading data: {error}</div>}

      {graphData && !error && (
        <div className="viz-content">
          <div className="graph-container">
            <ForceGraph2D
              graphData={{ nodes: graphData.nodes, links: graphData.edges }}
              nodeId="id"
              nodeLabel={(node: GraphNode) => `${node.label} (${node.prefix_count || 0} prefixes)`}
              nodeCanvasObject={nodeCanvasObject}
              onNodeClick={handleNodeClick}
              width={800}
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
          </div>
        </div>
      )}
    </div>
  );
}
