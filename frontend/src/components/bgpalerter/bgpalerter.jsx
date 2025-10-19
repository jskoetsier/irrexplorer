import React, { useState, useEffect, useCallback } from 'react';
import bgpalerterService from '../../services/bgpalerterService';
import './bgpalerter.css';

function BGPalerter() {
    const [email, setEmail] = useState(bgpalerterService.getCurrentUser() || '');
    const [isLoggedIn, setIsLoggedIn] = useState(!!bgpalerterService.getCurrentUser());
    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Dashboard state
    const [status, setStatus] = useState(null);
    const [monitoredAsns, setMonitoredAsns] = useState([]);
    const [alerts, setAlerts] = useState([]);

    // Form state
    const [newAsn, setNewAsn] = useState('');
    const [newDescription, setNewDescription] = useState('');

    const loadDashboardData = useCallback(async () => {
        setLoading(true);
        setError('');

        // Load status
        const statusRes = await bgpalerterService.getBgpalerterStatus();
        if (statusRes.success) {
            setStatus(statusRes.data);
        }

        // Load monitored ASNs
        const asnsRes = await bgpalerterService.getMonitoredAsns(email);
        if (asnsRes.success) {
            setMonitoredAsns(asnsRes.data || []);
        } else {
            setError(asnsRes.error);
        }

        // Load alerts
        const alertsRes = await bgpalerterService.getAlerts({ email, limit: 50 });
        if (alertsRes.success) {
            setAlerts(alertsRes.data || []);
        }

        setLoading(false);
    }, [email]);

    useEffect(() => {
        if (isLoggedIn) {
            loadDashboardData();
        }
    }, [isLoggedIn, loadDashboardData]);

    const handleLogin = (e) => {
        e.preventDefault();
        if (email.trim()) {
            bgpalerterService.setCurrentUser(email);
            setIsLoggedIn(true);
            setError('');
        } else {
            setError('Please enter a valid email address');
        }
    };

    const handleLogout = () => {
        bgpalerterService.setCurrentUser(null);
        setEmail('');
        setIsLoggedIn(false);
        setMonitoredAsns([]);
        setAlerts([]);
    };

    const handleAddAsn = async (e) => {
        e.preventDefault();
        if (!newAsn) {
            setError('Please enter an ASN');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        const result = await bgpalerterService.addMonitoredAsn(newAsn, email, newDescription);
        if (result.success) {
            setSuccess(`ASN ${newAsn} added successfully!`);
            setNewAsn('');
            setNewDescription('');
            await loadDashboardData();
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    const handleDeleteAsn = async (asn) => {
        if (!window.confirm(`Are you sure you want to stop monitoring AS${asn}?`)) {
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        const result = await bgpalerterService.deleteMonitoredAsn(asn, email);
        if (result.success) {
            setSuccess(`AS${asn} removed from monitoring`);
            await loadDashboardData();
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    if (!isLoggedIn) {
        return (
            <div className="bgpalerter-container">
                <div className="login-container">
                    <h2>BGP Monitoring & Alerting</h2>
                    <p style={{ textAlign: 'center', marginBottom: '30px', color: '#7f8c8d' }}>
                        Enter your email to start monitoring BGP changes for your ASNs
                    </p>
                    {error && <div className="error-message">{error}</div>}
                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label htmlFor="email-input">Email Address</label>
                            <input
                                id="email-input"
                                type="email"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                            Continue
                        </button>
                    </form>
                    <div className="login-footer">
                        <p style={{ fontSize: '14px' }}>
                            Your email is used to identify and group your monitored ASNs.
                            No password required.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bgpalerter-container">
            <div className="bgpalerter-header">
                <h1>BGP Monitoring & Alerting</h1>
                <p>Real-time BGP anomaly detection powered by BGPalerter</p>
            </div>

            <div className="user-section">
                <div className="user-info">
                    <strong>Logged in as:</strong>
                    <span className="user-email">{email}</span>
                </div>
                <button onClick={handleLogout} className="btn btn-secondary">
                    Switch Account
                </button>
            </div>

            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setActiveTab('dashboard')}
                >
                    Dashboard
                </button>
                <button
                    className={`tab ${activeTab === 'asns' ? 'active' : ''}`}
                    onClick={() => setActiveTab('asns')}
                >
                    Monitored ASNs ({monitoredAsns.length})
                </button>
                <button
                    className={`tab ${activeTab === 'alerts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('alerts')}
                >
                    Alerts ({alerts.length})
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            {activeTab === 'dashboard' && (
                <>
                    {status && (
                        <div className="stats-grid">
                            <div className="stat-card">
                                <h3>Monitored ASNs</h3>
                                <div className="stat-value">{monitoredAsns.length}</div>
                            </div>
                            <div className="stat-card warning">
                                <h3>Total Alerts</h3>
                                <div className="stat-value">{alerts.length}</div>
                            </div>
                            <div className="stat-card success">
                                <h3>BGPalerter Status</h3>
                                <div className="stat-value" style={{ fontSize: '18px' }}>
                                    {status.status === 'running' ? '✓ Running' : 'Offline'}
                                </div>
                            </div>
                            <div className="stat-card">
                                <h3>Detection Types</h3>
                                <div style={{ fontSize: '14px', color: '#2c3e50', marginTop: '10px' }}>
                                    {status.config?.hijack_detection && '✓ Hijacks '}
                                    {status.config?.visibility_loss && '✓ Visibility '}
                                    {status.config?.rpki_invalid && '✓ RPKI'}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="content-section">
                        <div className="section-header">
                            <h2>Recent Activity</h2>
                        </div>
                        {alerts.length > 0 ? (
                            <div className="alerts-list">
                                {alerts.slice(0, 5).map((alert, index) => (
                                    <div key={index} className={`alert-item ${alert.severity || 'medium'}`}>
                                        <div className="alert-header">
                                            <div className="alert-type">{alert.alert_type || 'BGP Change'}</div>
                                            <div className="alert-time">{alert.created_at || 'Recently'}</div>
                                        </div>
                                        <div className="alert-message">{alert.message}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon">📊</div>
                                <h3>No Alerts Yet</h3>
                                <p>Add ASNs to start monitoring for BGP anomalies</p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'asns' && (
                <div className="content-section">
                    <div className="section-header">
                        <h2>Monitored ASNs</h2>
                    </div>

                    <form onSubmit={handleAddAsn} className="add-asn-form">
                        <input
                            type="number"
                            className="form-input"
                            placeholder="ASN (e.g., 64512)"
                            value={newAsn}
                            onChange={(e) => setNewAsn(e.target.value)}
                            disabled={loading}
                        />
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Description (optional)"
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            disabled={loading}
                        />
                        <button type="submit" className="btn btn-success" disabled={loading}>
                            {loading ? 'Adding...' : 'Add ASN'}
                        </button>
                    </form>

                    {monitoredAsns.length > 0 ? (
                        <div className="monitored-asns-list">
                            {monitoredAsns.map((asn, index) => (
                                <div key={index} className="asn-item">
                                    <div className="asn-info">
                                        <div className="asn-number">AS{asn.asn}</div>
                                        <div className="asn-description">
                                            {asn.description || 'No description'}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteAsn(asn.asn)}
                                        className="btn btn-danger"
                                        disabled={loading}
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">🔍</div>
                            <h3>No ASNs Monitored</h3>
                            <p>Add your first ASN above to start monitoring</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'alerts' && (
                <div className="content-section">
                    <div className="section-header">
                        <h2>BGP Alerts</h2>
                    </div>

                    {alerts.length > 0 ? (
                        <div className="alerts-list">
                            {alerts.map((alert, index) => (
                                <div key={index} className={`alert-item ${alert.severity || 'medium'}`}>
                                    <div className="alert-header">
                                        <div>
                                            <div className="alert-type">{alert.alert_type || 'BGP Change'}</div>
                                            <div style={{ fontSize: '14px', color: '#7f8c8d', marginTop: '5px' }}>
                                                AS{alert.asn} {alert.prefix && `- ${alert.prefix}`}
                                            </div>
                                        </div>
                                        <div className="alert-time">{alert.created_at || 'Recently'}</div>
                                    </div>
                                    <div className="alert-message">{alert.message}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">✓</div>
                            <h3>No Alerts</h3>
                            <p>
                                {monitoredAsns.length > 0
                                    ? 'All monitored ASNs are healthy. Alerts will appear here when BGP anomalies are detected.'
                                    : 'Add ASNs to the monitoring list to receive alerts.'}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {loading && (
                <div className="loading">
                    <p>Loading...</p>
                </div>
            )}
        </div>
    );
}

export default BGPalerter;
