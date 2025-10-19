import axios from "axios";

let apiUrl = process.env.REACT_APP_BACKEND;
if (!apiUrl) {
    apiUrl = window.location.origin + "/api";
}

// Auth token management
let authToken = localStorage.getItem('bgp_auth_token');
let currentUser = null;

export function setAuthToken(token) {
    authToken = token;
    if (token) {
        localStorage.setItem('bgp_auth_token', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        localStorage.removeItem('bgp_auth_token');
        delete axios.defaults.headers.common['Authorization'];
    }
}

export function getAuthToken() {
    return authToken;
}

export function setCurrentUser(user) {
    currentUser = user;
    if (user) {
        localStorage.setItem('bgp_current_user', JSON.stringify(user));
    } else {
        localStorage.removeItem('bgp_current_user');
    }
}

export function getCurrentUser() {
    if (currentUser) return currentUser;
    const stored = localStorage.getItem('bgp_current_user');
    if (stored) {
        try {
            currentUser = JSON.parse(stored);
            return currentUser;
        } catch (e) {
            return null;
        }
    }
    return null;
}

export function logout() {
    setAuthToken(null);
    setCurrentUser(null);
}

// Initialize auth token if exists
if (authToken) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
}

// Authentication
export async function register(email, password, fullName = '') {
    try {
        const response = await axios.post(`${apiUrl}/bgp-auth/register`, {
            email,
            password,
            full_name: fullName
        });

        if (response.data.access_token) {
            setAuthToken(response.data.access_token);
            setCurrentUser(response.data.user);
        }

        return { data: response.data, success: true };
    } catch (exc) {
        return {
            data: null,
            success: false,
            error: exc.response?.data?.error || 'Registration failed'
        };
    }
}

export async function login(email, password) {
    try {
        const response = await axios.post(`${apiUrl}/bgp-auth/login`, {
            email,
            password
        });

        if (response.data.access_token) {
            setAuthToken(response.data.access_token);
            setCurrentUser(response.data.user);
        }

        return { data: response.data, success: true };
    } catch (exc) {
        return {
            data: null,
            success: false,
            error: exc.response?.data?.error || 'Login failed'
        };
    }
}

export async function getMe() {
    try {
        const response = await axios.get(`${apiUrl}/bgp-auth/me`);
        setCurrentUser(response.data);
        return { data: response.data, success: true };
    } catch (exc) {
        return {
            data: null,
            success: false,
            error: exc.response?.data?.error || 'Failed to get user info'
        };
    }
}

export async function changePassword(currentPassword, newPassword) {
    try {
        const response = await axios.post(`${apiUrl}/bgp-auth/change-password`, {
            current_password: currentPassword,
            new_password: newPassword
        });
        return { data: response.data, success: true };
    } catch (exc) {
        return {
            data: null,
            success: false,
            error: exc.response?.data?.error || 'Failed to change password'
        };
    }
}

// User Management
export async function getUserEmails() {
    try {
        const response = await axios.get(`${apiUrl}/bgp-user/emails`);
        return { data: response.data, success: true };
    } catch (exc) {
        return {
            data: null,
            success: false,
            error: exc.response?.data?.error || 'Failed to get emails'
        };
    }
}

export async function addUserEmail(email, isPrimary = false) {
    try {
        const response = await axios.post(`${apiUrl}/bgp-user/emails`, {
            email,
            is_primary: isPrimary
        });
        return { data: response.data, success: true };
    } catch (exc) {
        return {
            data: null,
            success: false,
            error: exc.response?.data?.error || 'Failed to add email'
        };
    }
}

export async function deleteUserEmail(emailId) {
    try {
        await axios.delete(`${apiUrl}/bgp-user/emails/${emailId}`);
        return { success: true };
    } catch (exc) {
        return {
            success: false,
            error: exc.response?.data?.error || 'Failed to delete email'
        };
    }
}

export async function getMonitoredAsns() {
    try {
        const response = await axios.get(`${apiUrl}/bgp-user/asns`);
        return { data: response.data, success: true };
    } catch (exc) {
        return {
            data: null,
            success: false,
            error: exc.response?.data?.error || 'Failed to get monitored ASNs'
        };
    }
}

export async function addMonitoredAsn(asn, description = '') {
    try {
        const response = await axios.post(`${apiUrl}/bgp-user/asns`, {
            asn,
            description
        });
        return { data: response.data, success: true };
    } catch (exc) {
        return {
            data: null,
            success: false,
            error: exc.response?.data?.error || 'Failed to add monitored ASN'
        };
    }
}

export async function deleteMonitoredAsn(asnId) {
    try {
        await axios.delete(`${apiUrl}/bgp-user/asns/${asnId}`);
        return { success: true };
    } catch (exc) {
        return {
            success: false,
            error: exc.response?.data?.error || 'Failed to delete monitored ASN'
        };
    }
}

export async function getAlertConfigs() {
    try {
        const response = await axios.get(`${apiUrl}/bgp-user/alert-configs`);
        return { data: response.data, success: true };
    } catch (exc) {
        return {
            data: null,
            success: false,
            error: exc.response?.data?.error || 'Failed to get alert configurations'
        };
    }
}

export async function addAlertConfig(channelType, config, isEnabled = true) {
    try {
        const response = await axios.post(`${apiUrl}/bgp-user/alert-configs`, {
            channel_type: channelType,
            config,
            is_enabled: isEnabled
        });
        return { data: response.data, success: true };
    } catch (exc) {
        return {
            data: null,
            success: false,
            error: exc.response?.data?.error || 'Failed to add alert configuration'
        };
    }
}

export async function deleteAlertConfig(configId) {
    try {
        await axios.delete(`${apiUrl}/bgp-user/alert-configs/${configId}`);
        return { success: true };
    } catch (exc) {
        return {
            success: false,
            error: exc.response?.data?.error || 'Failed to delete alert configuration'
        };
    }
}

export async function getAlerts(params = {}) {
    try {
        const queryParams = new URLSearchParams();
        if (params.asn) queryParams.append('asn', params.asn);
        if (params.severity) queryParams.append('severity', params.severity);
        if (params.acknowledged !== undefined) queryParams.append('acknowledged', params.acknowledged);
        if (params.limit) queryParams.append('limit', params.limit);

        const response = await axios.get(`${apiUrl}/bgp-user/alerts?${queryParams.toString()}`);
        return { data: response.data, success: true };
    } catch (exc) {
        return {
            data: null,
            success: false,
            error: exc.response?.data?.error || 'Failed to get alerts'
        };
    }
}

export async function acknowledgeAlert(alertId) {
    try {
        const response = await axios.post(`${apiUrl}/bgp-user/alerts/${alertId}/acknowledge`);
        return { data: response.data, success: true };
    } catch (exc) {
        return {
            data: null,
            success: false,
            error: exc.response?.data?.error || 'Failed to acknowledge alert'
        };
    }
}

export async function getUserStats() {
    try {
        const response = await axios.get(`${apiUrl}/bgp-user/stats`);
        return { data: response.data, success: true };
    } catch (exc) {
        return {
            data: null,
            success: false,
            error: exc.response?.data?.error || 'Failed to get user statistics'
        };
    }
}

const bgpAuthService = {
    register,
    login,
    logout,
    getMe,
    changePassword,
    setAuthToken,
    getAuthToken,
    getCurrentUser,
    setCurrentUser,
    getUserEmails,
    addUserEmail,
    deleteUserEmail,
    getMonitoredAsns,
    addMonitoredAsn,
    deleteMonitoredAsn,
    getAlertConfigs,
    addAlertConfig,
    deleteAlertConfig,
    getAlerts,
    acknowledgeAlert,
    getUserStats,
};

export default bgpAuthService;
