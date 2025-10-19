import React, { useEffect, useState } from 'react';
import { getHijackDetection } from '../../services/analysisService';
import Spinner from '../common/spinner';
import './analysis.css';

const HijackDetection = () => {
  const [alertData, setAlertData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getHijackDetection();
      setAlertData(data);
      setError(null);
    } catch (err) {
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

  if (!alertData) {
    return null;
  }

  return (
    <div className="analysis-container">
      <div className="analysis-header">
        <h2>BGP Hijack Detection</h2>
        <p className="text-muted">Potential BGP hijacks detected based on RPKI validation</p>
      </div>

      <div className="row">
        <div className="col-md-3">
          <div className="analysis-card">
            <h6 className="text-muted">Total Alerts</h6>
            <h2 className="text-danger">{alertData.total_alerts}</h2>
          </div>
        </div>
        <div className="col-md-3">
          <div className="analysis-card">
            <h6 className="text-muted">High Severity</h6>
            <h2 className="text-danger">{alertData.high_severity}</h2>
          </div>
        </div>
        <div className="col-md-3">
          <div className="analysis-card">
            <h6 className="text-muted">Medium Severity</h6>
            <h2 className="text-warning">{alertData.medium_severity}</h2>
          </div>
        </div>
        <div className="col-md-3">
          <div className="analysis-card">
            <h6 className="text-muted">Low Severity</h6>
            <h2 className="text-info">{alertData.low_severity}</h2>
          </div>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-md-12">
          <div className="analysis-card">
            <h4>Active Alerts</h4>
            {alertData.alerts && alertData.alerts.length > 0 ? (
              <div className="alert-list">
                {alertData.alerts.map((alert, index) => (
                  <div key={index} className={`alert-item ${alert.severity}-severity`}>
                    <h6>
                      <span className={`badge bg-${alert.severity === 'high' ? 'danger' : alert.severity === 'medium' ? 'warning' : 'info'}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      {' '}
                      {alert.prefix}
                    </h6>
                    <p><strong>Announcing ASN:</strong> AS{alert.announcing_asn}</p>
                    <p><strong>Authorized ASN:</strong> AS{alert.authorized_asn}</p>
                    <p className="mb-0">{alert.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="alert alert-success">
                <i className="fas fa-check-circle me-2"></i>
                No hijack alerts detected. All routes appear to be valid.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-md-12">
          <div className="alert alert-info">
            <h6><i className="fas fa-info-circle me-2"></i>About Hijack Detection</h6>
            <p className="mb-0">
              This tool detects potential BGP hijacks by identifying routes with RPKI "invalid" status.
              An invalid status indicates that a prefix is being announced by an ASN that doesn't match
              the ROA (Route Origin Authorization) for that prefix.
            </p>
          </div>
        </div>
      </div>

      <div className="analysis-footer">
        <small className="text-muted">
          Last updated: {new Date(alertData.timestamp).toLocaleString()}
        </small>
      </div>
    </div>
  );
};

export default HijackDetection;
