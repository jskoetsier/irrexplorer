import axios from "axios";

let apiUrl = process.env.REACT_APP_BACKEND;
if (!apiUrl) {
    apiUrl = window.location.origin + "/api";
}

// Auth token management
let authToken = localStorage.getItem('bgpalerter_token');

export function setAuthToken(token) {
    authToken = token;
    if (token) {
        localStorage.setItem('bgpalerter_token', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        localStorage.removeItem('bgpalerter_token');
        delete axios.defaults.headers.common['Authorization'];
    }
}

export function getAuthToken() {
    return authToken;
}

export function getCurrentUser() {
    return localStorage.getItem('bgpalerter_email');
}

export function setCurrentUser(email) {
    if (email) {
        localStorage.setItem('bgpalerter_email', email);
    } else {
        localStorage.removeItem('bgpalerter_email');
    }
}

// Initialize auth token if exists
if (authToken) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
}

// BGPalerter Status
export async function getBgpalerterStatus() {
    try {
        const response = await axios.get(`${apiUrl}/bgpalerter/status`);
        return { data: response.data, success: true };
    } catch (exc) {
        return {
            data: null,
            success: false,
            error: exc.response?.data?.error || 'Failed to get BGPalerter status'
        };
    }
}

// Monitored ASNs
export async function getMonitoredAsns(email = null) {
    try {
        const params = email ? `?email=${email}` : '';
        const response = await axios.get(`${apiUrl}/bgpalerter/monitored-asns${params}`);
        return { data: response.data, success: true };
    } catch (exc) {
        return {
            data: null,
            success: false,
            error: exc.response?.data?.error || 'Failed to get monitored ASNs'
        };
    }
}

export async function addMonitoredAsn(asn, email, description = '') {
    try {
        const response = await axios.post(`${apiUrl}/bgpalerter/monitored-asns`, {
            asn,
            email,
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

export async function deleteMonitoredAsn(asn, email) {
    try {
        await axios.delete(`${apiUrl}/bgpalerter/monitored-asns/${asn}?email=${email}`);
        return { success: true };
    } catch (exc) {
        return {
            success: false,
            error: exc.response?.data?.error || 'Failed to delete monitored ASN'
        };
    }
}

// Alerts
export async function getAlerts(params = {}) {
    try {
        const queryParams = new URLSearchParams();
        if (params.email) queryParams.append('email', params.email);
        if (params.asn) queryParams.append('asn', params.asn);
        if (params.severity) queryParams.append('severity', params.severity);
        if (params.limit) queryParams.append('limit', params.limit);

        const response = await axios.get(`${apiUrl}/bgpalerter/alerts?${queryParams.toString()}`);
        return { data: response.data, success: true };
    } catch (exc) {
        return {
            data: null,
            success: false,
            error: exc.response?.data?.error || 'Failed to get alerts'
        };
    }
}

const bgpalerterService = {
    setAuthToken,
    getAuthToken,
    getCurrentUser,
    setCurrentUser,
    getBgpalerterStatus,
    getMonitoredAsns,
    addMonitoredAsn,
    deleteMonitoredAsn,
    getAlerts,
};

export default bgpalerterService;
