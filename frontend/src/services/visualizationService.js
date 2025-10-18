import axios from 'axios';
import config from '../config.json';

const API_BASE = config.api_url;

export const getPrefixAllocationData = async () => {
  const response = await axios.get(`${API_BASE}/api/viz/prefix-allocation`);
  return response.data;
};

export const getASNRelationships = async (asn) => {
  const response = await axios.get(`${API_BASE}/api/viz/asn-relationships/${asn}`);
  return response.data;
};

export const getHistoricalTimeline = async (days = 30) => {
  const response = await axios.get(`${API_BASE}/api/viz/timeline`, {
    params: { days }
  });
  return response.data;
};

export const getRIRDistribution = async () => {
  const response = await axios.get(`${API_BASE}/api/viz/rir-distribution`);
  return response.data;
};

export const getPrefixSizeDistribution = async () => {
  const response = await axios.get(`${API_BASE}/api/viz/prefix-distribution`);
  return response.data;
};
