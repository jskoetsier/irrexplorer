import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface RPKIDashboardData {
  total_prefixes: number;
  valid_prefixes: number;
  invalid_prefixes: number;
  not_found_prefixes: number;
  coverage_percentage: number;
}

export interface ROACoverageData {
  asn: number;
  total_prefixes: number;
  roa_covered: number;
  coverage_percentage: number;
}

export interface IRRConsistencyData {
  irr_source: string;
  total_routes: number;
  consistent_routes: number;
  inconsistencies: { type: string; count: number }[];
}

export interface HijackDetectionData {
  potential_hijacks: {
    prefix: string;
    origin_asn: number;
    expected_asn: number;
    first_seen: string;
    severity: 'high' | 'medium' | 'low';
  }[];
}

export interface PrefixOverlapData {
  prefix: string;
  overlaps: { prefix: string; asn: number; rir: string }[];
}

export interface ASPathData {
  asn: number;
  paths: { path: number[]; frequency: number }[];
}

export interface WHOISData {
  resource: string;
  name: string;
  country: string;
  created: string;
  updated: string;
  contacts: { role: string; email: string }[];
}

export const getRPKIDashboard = async (): Promise<RPKIDashboardData> => {
  const response = await axios.get(`${API_BASE}/api/analysis/rpki-dashboard`);
  return response.data;
};

export const getROACoverage = async (asn: number | null = null): Promise<ROACoverageData[]> => {
  const params = asn ? { asn } : {};
  const response = await axios.get(`${API_BASE}/api/analysis/roa-coverage`, { params });
  return response.data;
};

export const getIRRConsistency = async (asn: number | null = null): Promise<IRRConsistencyData[]> => {
  const params = asn ? { asn } : {};
  const response = await axios.get(`${API_BASE}/api/analysis/irr-consistency`, { params });
  return response.data;
};

export const getHijackDetection = async (): Promise<HijackDetectionData> => {
  const response = await axios.get(`${API_BASE}/api/analysis/hijack-detection`);
  return response.data;
};

export const getPrefixOverlap = async (prefix: string): Promise<PrefixOverlapData> => {
  const response = await axios.get(`${API_BASE}/api/analysis/prefix-overlap`, {
    params: { prefix },
  });
  return response.data;
};

export const getASPathAnalysis = async (asn: string | number): Promise<ASPathData> => {
  const response = await axios.get(`${API_BASE}/api/analysis/as-path`, {
    params: { asn },
  });
  return response.data;
};

export const getWHOISInfo = async (resource: string): Promise<WHOISData> => {
  const response = await axios.get(`${API_BASE}/api/analysis/whois`, {
    params: { resource },
  });
  return response.data;
};
