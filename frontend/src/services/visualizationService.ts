import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface PrefixAllocationData {
  rir: string;
  count: number;
  percentage: number;
}

export interface ASNRelationshipData {
  asn: number;
  name: string;
  connections: { asn: number; weight: number }[];
}

export interface TimelineData {
  date: string;
  queries: number;
  unique_users: number;
}

export interface RIRDistributionData {
  rir: string;
  prefixes: number;
  asns: number;
  space_covered: string;
}

export interface PrefixSizeDistribution {
  prefix_length: number;
  count: number;
}

export const getPrefixAllocationData = async (): Promise<PrefixAllocationData[]> => {
  const response = await axios.get(`${API_BASE}/api/viz/prefix-allocation`);
  return response.data;
};

export const getASNRelationships = async (asn: string | number): Promise<ASNRelationshipData> => {
  const response = await axios.get(`${API_BASE}/api/viz/asn-relationships/${asn}`);
  return response.data;
};

export const getHistoricalTimeline = async (days = 30): Promise<TimelineData[]> => {
  const response = await axios.get(`${API_BASE}/api/viz/timeline`, {
    params: { days },
  });
  return response.data;
};

export const getRIRDistribution = async (): Promise<RIRDistributionData[]> => {
  const response = await axios.get(`${API_BASE}/api/viz/rir-distribution`);
  return response.data;
};

export const getPrefixSizeDistribution = async (): Promise<PrefixSizeDistribution[]> => {
  const response = await axios.get(`${API_BASE}/api/viz/prefix-distribution`);
  return response.data;
};
