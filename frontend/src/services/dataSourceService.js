import axios from 'axios';

// Use relative URL to work with both dev and production
const API_BASE_URL = process.env.REACT_APP_API_URL || '';

/**
 * Service for interacting with external data source APIs
 * (Looking Glass, RDAP, PeeringDB)
 */

// BGP Looking Glass API calls
export const getLookingGlassPrefix = async (prefix) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/datasources/lg/prefix/${encodeURIComponent(prefix)}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching Looking Glass prefix data:', error);
    throw error;
  }
};

export const getLookingGlassAsn = async (asn) => {
  try {
    const cleanAsn = asn.toString().replace(/^AS/i, '');
    const response = await axios.get(`${API_BASE_URL}/api/datasources/lg/asn/${cleanAsn}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching Looking Glass ASN data:', error);
    throw error;
  }
};

export const getLookingGlassRoute = async (prefix, peer = null) => {
  try {
    const url = peer
      ? `${API_BASE_URL}/api/datasources/lg/route/${encodeURIComponent(prefix)}?peer=${peer}`
      : `${API_BASE_URL}/api/datasources/lg/route/${encodeURIComponent(prefix)}`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching Looking Glass route data:', error);
    throw error;
  }
};

export const getLookingGlassPeers = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/datasources/lg/peers`);
    return response.data;
  } catch (error) {
    console.error('Error fetching Looking Glass peers:', error);
    throw error;
  }
};

// RDAP API calls
export const getRdapIp = async (ip, rir = null) => {
  try {
    const url = rir
      ? `${API_BASE_URL}/api/datasources/rdap/ip/${encodeURIComponent(ip)}?rir=${rir}`
      : `${API_BASE_URL}/api/datasources/rdap/ip/${encodeURIComponent(ip)}`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching RDAP IP data:', error);
    throw error;
  }
};

export const getRdapAsn = async (asn, rir = null) => {
  try {
    const cleanAsn = asn.toString().replace(/^AS/i, '');
    const url = rir
      ? `${API_BASE_URL}/api/datasources/rdap/asn/${cleanAsn}?rir=${rir}`
      : `${API_BASE_URL}/api/datasources/rdap/asn/${cleanAsn}`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching RDAP ASN data:', error);
    throw error;
  }
};

export const getRdapDomain = async (domain) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/datasources/rdap/domain/${encodeURIComponent(domain)}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching RDAP domain data:', error);
    throw error;
  }
};

// PeeringDB API calls
export const getPeeringDbAsn = async (asn) => {
  try {
    const cleanAsn = asn.toString().replace(/^AS/i, '');
    const response = await axios.get(`${API_BASE_URL}/api/datasources/peeringdb/asn/${cleanAsn}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching PeeringDB ASN data:', error);
    throw error;
  }
};

export const getPeeringDbFacility = async (facilityId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/datasources/peeringdb/facility/${facilityId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching PeeringDB facility data:', error);
    throw error;
  }
};

export const getPeeringDbIx = async (ixId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/datasources/peeringdb/ix/${ixId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching PeeringDB IX data:', error);
    throw error;
  }
};

export const searchPeeringDb = async (query) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/datasources/peeringdb/search?q=${encodeURIComponent(query)}`);
    return response.data;
  } catch (error) {
    console.error('Error searching PeeringDB:', error);
    throw error;
  }
};
