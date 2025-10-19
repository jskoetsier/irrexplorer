import React, { useState, useEffect, useCallback } from 'react';
import bgpAuthService from '../../services/bgpAuthService';
import './bgpalerter.css';

function BGPalerter() {
    const [isAuthenticated, setIsAuthenticated] = useState(!!bgpAuthService.getAuthToken());
    const [currentUser, setCurrentUser] = useState(bgpAuthService.getCurrentUser());
    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    // Auth form state
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    
    // Dashboard state
    const [stats, setStats] = useState(null);
    const [monitoredAsns, setMonitoredAsns] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [userEmails, setUserEmails] = useState([]);
    const [alertConfigs, setAlertConfigs] = useState([]);
    
    // Form state
    const [newAsn, setNewAsn] = useState('');
    const [newAsnDescription, setNewAsnDescription] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newAlertChannel, setNewAlertChannel] = useState('email');
    const [newAlertConfig, setNewAlertConfig] = useState({});

    const loadDashboardData = useCallback(async () => {
        if (!isAuthenticated) return;
        
        setLoading(true);
        setError('');

        // Load user stats
        const statsRes = await bgpAuthService.getUserStats();
        if (statsRes.success) {
            setStats(statsRes.data);
        }

        // Load monitored ASNs
        const asnsRes = await bgpAuthService.getMonitoredAsns();
        if (asnsRes.success) {
            setMonitoredAsns(asnsRes.data || []);
        }

        // Load alerts
        const alertsRes = await bgpAuthService.getAlerts({ limit: 50 });
        if (alertsRes.success) {
            setAlerts(alertsRes.data || []);
        }

        // Load user emails
        const emailsRes = await bgpAuthService.getUserEmails();
        if (emailsRes.success) {
            setUserEmails(emailsRes.data || []);
        }

        // Load alert configurations
        const configsRes = await bgpAuthService.getAlertConfigs();
        if (configsRes.success) {
            setAlertConfigs(configsRes.data || []);
        }

        setLoading(false);
    }, [isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated) {
            loadDashboardData();
        }
    }, [isAuthenticated, loadDashboardData]);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        let result;
        if (isRegisterMode) {
            result = await bgpAuthService.register(email, password, fullName);
        } else {
            result = await bgpAuthService.login(email, password);
        }

        if (result.success) {
            setCurrentUser(result.data.user);
            setIsAuthenticated(true);
            setEmail('');
            setPassword('');
            setFullName('');
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    const handleLogout = () => {
        bgpAuthService.logout();
        setIsAuthenticated(false);
        setCurrentUser(null);
        setMonitoredAsns([]);
        setAlerts([]);
        setUserEmails([]);
        setAlertConfigs([]);
        setStats(null);
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

        const result = await bgpAuthService.addMonitoredAsn(parseInt(newAsn), newAsnDescription);
        if (result.success) {
            setSuccess(`AS${newAsn} added successfully!`);
            setNewAsn('');
            setNewAsnDescription('');
            await loadDashboardData();
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    const handleDeleteAsn = async (asnId, asn) => {
        if (!window.confirm(`Are you sure you want to stop monitoring AS${asn}?`)) {
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        const result = await bgpAuthService.deleteMonitoredAsn(asnId);
        if (result.success) {
            setSuccess(`AS${asn} removed from monitoring`);
            await loadDashboardData();
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    const handleAddEmail = async (e) => {
        e.preventDefault();
        if (!newEmail) return;

        setLoading(true);
        setError('');
        setSuccess('');

        const result = await bgpAuthService.addUserEmail(newEmail);
        if (result.success) {
            setSuccess(`Email ${newEmail} added successfully!`);
            setNewEmail('');
            await loadDashboardData();
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    const handleDeleteEmail = async (emailId, email) => {
        if (!window.confirm(`Remove ${email}?`)) return;

        setLoading(true);
        const result = await bgpAuthService.deleteUserEmail(emailId);
        if (result.success) {
            setSuccess(`Email removed successfully`);
            await loadDashboardData();
        } else {
            setError(result.error);
        }
        setLoading(false);
    };

    const handleAddAlertConfig = async (e) => {
        e.preventDefault();
        
        let config = {};
        if (newAlertChannel === 'email') {
            if (!newAlertConfig.email) {
                setError('Email address is required');
                return;
            }
            config = { email: newAlertConfig.email };
        } else if (newAlertChannel === 'slack') {
            if (!newAlertConfig.webhook_url) {
                setError('Slack webhook URL is required');
                return;
            }
            config = { webhook_url: newAlertConfig.webhook_url };
        } else if (newAlertChannel === 'telegram') {
            if (!newAlertConfig.bot_token || !newAlertConfig.chat_id) {
                setError('Telegram bot token and chat ID are required');
                return;
            }
            config = { bot_token: newAlertConfig.bot_token, chat_id: newAlertConfig.chat_id };
        } else if (newAlertChannel === 'webhook') {
            if (!newAlertConfig.url) {
                setError('Webhook URL is required');
                return;
            }
            config = { url: newAlertConfig.url };
        }

        setLoading(true);
        setError('');
        setSuccess('');

        const result = await bgpAuthService.addAlertConfig(newAlertChannel, config);
        if (result.success) {
            setSuccess('Alert configuration added successfully!');
            setNewAlertConfig({});
            await loadDashboardData();
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    const handleDeleteAlertConfig = async (configId, channelType) => {
        if (!window.confirm(`Remove ${channelType} alert configuration?`)) return;

        setLoading(true);
        const result = await bgpAuthService.deleteAlertConfig(configId);
        if (result.success) {
            setSuccess('Alert configuration removed');
            await loadDashboardData();
        } else {
            setError(result.error);
        }
        setLoading(false);
    };

    const handleAcknowledgeAlert = async (alertId) => {
        setLoading(true);
        const result = await bgpAuthService.acknowledgeAlert(alertId);
        if (result.success) {
            setSuccess('Alert acknowledged');
            await loadDashboardData();
        } else {
            setError(result.error);
        }
        setLoading(false);
    };

    if (!isAuthenticated) {
        return (
            <div className="bgpalerter-container">
                <div className="login-container">
                    <h2>{isRegisterMode ? 'Create Account' : 'Sign In'}</h2>
                    <p style={{ textAlign: 'center', marginBottom: '30px', color: '#7f8c8d' }}>
                        {isRegisterMode 
                            ? 'Register to start monitoring BGP changes for your ASNs'
                            : 'Sign in to manage your BGP monitoring'}
                    </p>
                    {error && <div className="error-message">{error}</div>}
                    <form onSubmit={handleAuth}>
                        {isRegisterMode && (
                            <div className="form-group">
                                <label htmlFor="full-name-input">Full Name (Optional)</label>
                                <input
                                    id="full-name-input"
                                    type="text"
                                    className="form-input"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="John Doe"
                                />
                            </div>
                        )}
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
                        <div className="form-group">
                            <label htmlFor="password-input">Password</label>
                            <input
                                id="password-input"
                                type="password"
                                className="form-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength="8"
                            />
                            {isRegisterMode && (
                                <small style={{ color: '#7f8c8d', display: 'block', marginTop: '5px' }}>
                                    Minimum 8 characters
                                </small>
                            )}
                        </div>
                        <button 
                            type="submit" 
                            className="btn btn-primary" 
                            style={{ width: '100%' }}
                            disabled={loading}
                        >
                            {loading ? 'Please wait...' : (isRegisterMode ? 'Register' : 'Sign In')}
                        </button>
                    </form>
                    <div className="login-footer">
                        <button 
                            onClick={() => {
                                setIsRegisterMode(!isRegisterMode);
                                setError('');
                            }}
                            style={{ background: 'none', border: 'none', color: '#3498db', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            {isRegisterMode ? 'Already have an account? Sign in' : "Don't have an account? Register"}
                        </button>
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
                    <span className="user-email">{currentUser?.email}</span>
                    {currentUser?.is_admin && <span className="badge-admin">Admin</span>}
                </div>
                <button onClick={handleLogout} className="btn btn-secondary">
                    Logout
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
                    Alerts ({stats?.unacknowledged_alerts || 0})
                </button>
                <button 
                    className={`tab ${activeTab === 'emails' ? 'active' : ''}`}
                    onClick={() => setActiveTab('emails')}
                >
                    Notification Emails ({userEmails.length})
                </button>
                <button 
                    className={`tab ${activeTab === 'channels' ? 'active' : ''}`}
                    onClick={() => setActiveTab('channels')}
                >
                    Alert Channels ({alertConfigs.length})
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            {activeTab === 'dashboard' && stats && (
                <>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <h3>Monitored ASNs</h3>
                            <div className="stat-value">{stats.monitored_asns}</div>
                        </div>
                        <div className="stat-card warning">
                            <h3>Unacknowledged</h3>
                            <div className="stat-value">{stats.unacknowledged_alerts}</div>
                        </div>
                        <div className="stat-card danger">
                            <h3>Critical Alerts</h3>
                            <div className="stat-value">{stats.alerts_by_severity?.critical || 0}</div>
                        </div>
                        <div className="stat-card success">
                            <h3>Active Channels</h3>
                            <div className="stat-value">{stats.active_notification_channels}</div>
                        </div>
                    </div>

                    <div className="content-section">
                        <div className="section-header">
                            <h2>Recent Alerts</h2>
                        </div>
                        {alerts.length > 0 ? (
                            <div className="alerts-list">
                                {alerts.slice(0, 5).map((alert) => (
                                    <div key={alert.id} className={`alert-item ${alert.severity || 'medium'}`}>
                                        <div className="alert-header">
                                            <div>
                                                <div className="alert-type">{alert.alert_type}</div>
                                                <div style={{ fontSize: '14px', color: '#7f8c8d', marginTop: '5px' }}>
                                                    AS{alert.asn} {alert.prefix && `- ${alert.prefix}`}
                                                </div>
                                            </div>
                                            <div className="alert-time">
                                                {new Date(alert.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="alert-message">{alert.message}</div>
                                        {!alert.is_acknowledged && (
                                            <button 
                                                onClick={() => handleAcknowledgeAlert(alert.id)}
                                                className="btn btn-primary"
                                                style={{ marginTop: '10px' }}
                                            >
                                                Acknowledge
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon">✓</div>
                                <h3>No Alerts</h3>
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
                            value={newAsnDescription}
                            onChange={(e) => setNewAsnDescription(e.target.value)}
                            disabled={loading}
                        />
                        <button type="submit" className="btn btn-success" disabled={loading}>
                            {loading ? 'Adding...' : 'Add ASN'}
                        </button>
                    </form>

                    {monitoredAsns.length > 0 ? (
                        <div className="monitored-asns-list">
                            {monitoredAsns.map((asn) => (
                                <div key={asn.id} className="asn-item">
                                    <div className="asn-info">
                                        <div className="asn-number">AS{asn.asn}</div>
                                        <div className="asn-description">
                                            {asn.description || 'No description'}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteAsn(asn.id, asn.asn)}
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
                        <h2>All Alerts</h2>
                    </div>

                    {alerts.length > 0 ? (
                        <div className="alerts-list">
                            {alerts.map((alert) => (
                                <div key={alert.id} className={`alert-item ${alert.severity || 'medium'} ${alert.is_acknowledged ? 'acknowledged' : ''}`}>
                                    <div className="alert-header">
                                        <div>
                                            <div className="alert-type">
                                                {alert.alert_type}
                                                {alert.is_acknowledged && <span style={{ marginLeft: '10px', color: '#27ae60' }}>✓ Acknowledged</span>}
                                            </div>
                                            <div style={{ fontSize: '14px', color: '#7f8c8d', marginTop: '5px' }}>
                                                AS{alert.asn} {alert.prefix && `- ${alert.prefix}`}
                                            </div>
                                        </div>
                                        <div className="alert-time">
                                            {new Date(alert.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="alert-message">{alert.message}</div>
                                    {!alert.is_acknowledged && (
                                        <button 
                                            onClick={() => handleAcknowledgeAlert(alert.id)}
                                            className="btn btn-primary"
                                            style={{ marginTop: '10px' }}
                                        >
                                            Acknowledge
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">✓</div>
                            <h3>No Alerts</h3>
                            <p>Add ASNs to receive alerts when BGP anomalies are detected</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'emails' && (
                <div className="content-section">
                    <div className="section-header">
                        <h2>Notification Emails</h2>
                    </div>

                    <form onSubmit={handleAddEmail} className="add-asn-form">
                        <input
                            type="email"
                            className="form-input"
                            placeholder="email@example.com"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            disabled={loading}
                        />
                        <button type="submit" className="btn btn-success" disabled={loading}>
                            Add Email
                        </button>
                    </form>

                    {userEmails.length > 0 ? (
                        <div className="monitored-asns-list">
                            {userEmails.map((emailObj) => (
                                <div key={emailObj.id} className="asn-item">
                                    <div className="asn-info">
                                        <div className="asn-number">
                                            {emailObj.email}
                                            {emailObj.is_primary && <span className="badge-primary">Primary</span>}
                                            {emailObj.is_verified && <span className="badge-verified">✓</span>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteEmail(emailObj.id, emailObj.email)}
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
                            <div className="empty-state-icon">📧</div>
                            <h3>No Notification Emails</h3>
                            <p>Add email addresses to receive alert notifications</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'channels' && (
                <div className="content-section">
                    <div className="section-header">
                        <h2>Alert Channels</h2>
                    </div>

                    <form onSubmit={handleAddAlertConfig} className="add-asn-form">
                        <select 
                            className="form-input"
                            value={newAlertChannel}
                            onChange={(e) => {
                                setNewAlertChannel(e.target.value);
                                setNewAlertConfig({});
                            }}
                        >
                            <option value="email">Email</option>
                            <option value="slack">Slack</option>
                            <option value="telegram">Telegram</option>
                            <option value="webhook">Webhook</option>
                        </select>

                        {newAlertChannel === 'email' && (
                            <input
                                type="email"
                                className="form-input"
                                placeholder="Email address"
                                value={newAlertConfig.email || ''}
                                onChange={(e) => setNewAlertConfig({...newAlertConfig, email: e.target.value})}
                            />
                        )}

                        {newAlertChannel === 'slack' && (
                            <input
                                type="url"
                                className="form-input"
                                placeholder="Slack webhook URL"
                                value={newAlertConfig.webhook_url || ''}
                                onChange={(e) => setNewAlertConfig({...newAlertConfig, webhook_url: e.target.value})}
                            />
                        )}

                        {newAlertChannel === 'telegram' && (
                            <>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Bot token"
                                    value={newAlertConfig.bot_token || ''}
                                    onChange={(e) => setNewAlertConfig({...newAlertConfig, bot_token: e.target.value})}
                                />
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Chat ID"
                                    value={newAlertConfig.chat_id || ''}
                                    onChange={(e) => setNewAlertConfig({...newAlertConfig, chat_id: e.target.value})}
                                />
                            </>
                        )}

                        {newAlertChannel === 'webhook' && (
                            <input
                                type="url"
                                className="form-input"
                                placeholder="Webhook URL"
                                value={newAlertConfig.url || ''}
                                onChange={(e) => setNewAlertConfig({...newAlertConfig, url: e.target.value})}
                            />
                        )}

                        <button type="submit" className="btn btn-success" disabled={loading}>
                            Add Channel
                        </button>
                    </form>

                    {alertConfigs.length > 0 ? (
                        <div className="monitored-asns-list">
                            {alertConfigs.map((config) => (
                                <div key={config.id} className="asn-item">
                                    <div className="asn-info">
                                        <div className="asn-number">
                                            {config.channel_type.toUpperCase()}
                                            {config.is_enabled ? (
                                                <span className="badge-enabled">Enabled</span>
                                            ) : (
                                                <span className="badge-disabled">Disabled</span>
                                            )}
                                        </div>
                                        <div className="asn-description">
                                            {config.channel_type === 'email' && config.config?.email}
                                            {config.channel_type === 'slack' && 'Slack webhook configured'}
                                            {config.channel_type === 'telegram' && 'Telegram bot configured'}
                                            {config.channel_type === 'webhook' && config.config?.url}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteAlertConfig(config.id, config.channel_type)}
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
                            <div className="empty-state-icon">📢</div>
                            <h3>No Alert Channels</h3>
                            <p>Configure channels to receive BGP alerts via Email, Slack, Telegram, or Webhooks</p>
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
