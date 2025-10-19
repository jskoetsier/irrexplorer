import axios from 'axios';
import config from '../config.json';

const API_BASE = config.api_url;

export const getRPKIDashboard = async () => {
  const response = await axios.get(`${API_BASE}/api/analysis/rpki-dashboard`);
  return response.data;
};

export const getROACoverage = async (asn = null) => {
  const params = asn ? { asn } : {};
  const response = await axios.get(`${API_BASE}/api/analysis/roa-coverage`, { params });
  return response.data;
};

export const getIRRConsistency = async (asn = null) => {
  const params = asn ? { asn } : {};
  const response = await axios.get(`${API_BASE}/api/analysis/irr-consistency`, { params });
  return response.data;
};

export const getHijackDetection = async () => {
  const response = await axios.get(`${API_BASE}/api/analysis/hijack-detection`);
  return response.data;
};

export const getPrefixOverlap = async (prefix) => {
  const response = await axios.get(`${API_BASE}/api/analysis/prefix-overlap`, {
    params: { prefix }
  });
  return response.data;
};

export const getASPathAnalysis = async (asn) => {
  const response = await axios.get(`${API_BASE}/api/analysis/as-path`, {
    params: { asn }
  });
  return response.data;
};

export const getWHOISInfo = async (resource) => {
  const response = await axios.get(`${API_BASE}/api/analysis/whois`, {
    params: { resource }
  });
  return response.data;
};
