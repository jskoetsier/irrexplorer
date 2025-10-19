import React, { useState } from 'react';
import { getPrefixOverlap } from '../../services/analysisService';
import Spinner from '../common/spinner';
import './analysis.css';

const PrefixOverlap = () => {
  const [overlapData, setOverlapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prefix, setPrefix] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!prefix) {
      setError('Please enter a prefix');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getPrefixOverlap(prefix);
      setOverlapData(data);
    } catch (err) {
      setError(err.message);
      setOverlapData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="analysis-container">
      <div className="analysis-header">
        <h2>Prefix Overlap Analyzer</h2>
        <p className="text-muted">Find overlapping prefixes (exact matches, more-specifics, less-specifics)</p>
      </div>

      <div className="analysis-search-form">
        <form onSubmit={handleSearch}>
          <div className="input-group">
            <span className="input-group-text">Prefix</span>
            <input
              type="text"
              className="form-control"
              placeholder="e.g., 1.1.1.0/24"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="alert alert-danger">{error}</div>
      )}

      {loading && (
        <div className="text-center p-5">
          <Spinner />
        </div>
      )}

      {overlapData && !loading && (
        <>
          <div className="row">
            <div className="col-md-3">
              <div className="analysis-card">
                <h6 className="text-muted">Total Overlaps</h6>
                <h2 className="text-primary">{overlapData.total_overlaps}</h2>
              </div>
            </div>
            <div className="col-md-3">
              <div className="analysis-card">
                <h6 className="text-muted">Exact Matches</h6>
                <h2 className="text-success">{overlapData.exact_matches}</h2>
              </div>
            </div>
            <div className="col-md-3">
              <div className="analysis-card">
                <h6 className="text-muted">More Specifics</h6>
                <h2 className="text-info">{overlapData.more_specifics}</h2>
              </div>
            </div>
            <div className="col-md-3">
              <div className="analysis-card">
                <h6 className="text-muted">Less Specifics</h6>
                <h2 className="text-warning">{overlapData.less_specifics}</h2>
              </div>
            </div>
          </div>

          <div className="row mt-4">
            <div className="col-md-12">
              <div className="analysis-card">
                <div className="overlap-section">
                  <h5><i className="fas fa-equals me-2"></i>Exact Matches ({overlapData.overlaps.exact.length})</h5>
                  {overlapData.overlaps.exact.length > 0 ? (
                    <div className="prefix-list">
                      {overlapData.overlaps.exact.map((item, index) => (
                        <div key={index} className="prefix-item">
                          <code>{item.prefix}</code>
                          <span className="badge bg-secondary">AS{item.asn}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted">No exact matches found</p>
                  )}
                </div>

                <div className="overlap-section mt-4">
                  <h5><i className="fas fa-angle-double-down me-2"></i>More Specific Prefixes ({overlapData.overlaps.more_specific.length})</h5>
                  {overlapData.overlaps.more_specific.length > 0 ? (
                    <div className="prefix-list">
                      {overlapData.overlaps.more_specific.map((item, index) => (
                        <div key={index} className="prefix-item">
                          <code>{item.prefix}</code>
                          <span className="badge bg-info">AS{item.asn}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted">No more specific prefixes found</p>
                  )}
                </div>

                <div className="overlap-section mt-4">
                  <h5><i className="fas fa-angle-double-up me-2"></i>Less Specific Prefixes ({overlapData.overlaps.less_specific.length})</h5>
                  {overlapData.overlaps.less_specific.length > 0 ? (
                    <div className="prefix-list">
                      {overlapData.overlaps.less_specific.map((item, index) => (
                        <div key={index} className="prefix-item">
                          <code>{item.prefix}</code>
                          <span className="badge bg-warning text-dark">AS{item.asn}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted">No less specific prefixes found</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="analysis-footer">
            <small className="text-muted">
              Last updated: {new Date(overlapData.timestamp).toLocaleString()}
            </small>
          </div>
        </>
      )}

      {!overlapData && !loading && !error && (
        <div className="alert alert-info">
          <i className="fas fa-info-circle me-2"></i>
          Enter a prefix to analyze overlapping routes in the BGP table.
        </div>
      )}
    </div>
  );
};

export default PrefixOverlap;
