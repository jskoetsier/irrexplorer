import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface LookingGlassRoute {
  prefix: string;
  origin_asn: number;
  as_path: number[];
  next_hop: string;
  peer: string;
}

export interface LookingGlassPeer {
  name: string;
  ip: string;
  asn: number;
}

export interface RdapResult {
  handle: string;
  name: string;
  type: string;
  country: string;
  remarks: string[];
  links: { rel: string; href: string }[];
}

export interface PeeringDbAsn {
  asn: number;
  name: string;
  website: string;
  network_type: string;
  info_prefixes4: number;
  info_prefixes6: number;
  traffic_levels: string;
}

export interface PeeringDbFacility {
  id: number;
  name: string;
  city: string;
  country: string;
}

export interface PeeringDbIx {
  id: number;
  name: string;
  city: string;
  country: string;
  ipaddr4: string;
  ipaddr6: string;
}

export const getLookingGlassPrefix = async (prefix: string): Promise<LookingGlassRoute[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/datasources/lg/prefix/${encodeURIComponent(prefix)}`);
  return response.data;
};

export const getLookingGlassAsn = async (asn: string | number): Promise<LookingGlassRoute[]> => {
  const cleanAsn = asn.toString().replace(/^AS/i, '');
  const response = await axios.get(`${API_BASE_URL}/api/datasources/lg/asn/${cleanAsn}`);
  return response.data;
};

export const getLookingGlassRoute = async (prefix: string, peer: string | null = null): Promise<LookingGlassRoute> => {
  const url = peer
    ? `${API_BASE_URL}/api/datasources/lg/route/${encodeURIComponent(prefix)}?peer=${peer}`
    : `${API_BASE_URL}/api/datasources/lg/route/${encodeURIComponent(prefix)}`;
  const response = await axios.get(url);
  return response.data;
};

export const getLookingGlassPeers = async (): Promise<LookingGlassPeer[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/datasources/lg/peers`);
  return response.data;
};

export const getRdapIp = async (ip: string, rir: string | null = null): Promise<RdapResult> => {
  const url = rir
    ? `${API_BASE_URL}/api/datasources/rdap/ip/${encodeURIComponent(ip)}?rir=${rir}`
    : `${API_BASE_URL}/api/datasources/rdap/ip/${encodeURIComponent(ip)}`;
  const response = await axios.get(url);
  return response.data;
};

export const getRdapAsn = async (asn: string | number, rir: string | null = null): Promise<RdapResult> => {
  const cleanAsn = asn.toString().replace(/^AS/i, '');
  const url = rir
    ? `${API_BASE_URL}/api/datasources/rdap/asn/${cleanAsn}?rir=${rir}`
    : `${API_BASE_URL}/api/datasources/rdap/asn/${cleanAsn}`;
  const response = await axios.get(url);
  return response.data;
};

export const getRdapDomain = async (domain: string): Promise<RdapResult> => {
  const response = await axios.get(`${API_BASE_URL}/api/datasources/rdap/domain/${encodeURIComponent(domain)}`);
  return response.data;
};

export const getPeeringDbAsn = async (asn: string | number): Promise<PeeringDbAsn> => {
  const cleanAsn = asn.toString().replace(/^AS/i, '');
  const response = await axios.get(`${API_BASE_URL}/api/datasources/peeringdb/asn/${cleanAsn}`);
  return response.data;
};

export const getPeeringDbFacility = async (facilityId: string | number): Promise<PeeringDbFacility> => {
  const response = await axios.get(`${API_BASE_URL}/api/datasources/peeringdb/facility/${facilityId}`);
  return response.data;
};

export const getPeeringDbIx = async (ixId: string | number): Promise<PeeringDbIx> => {
  const response = await axios.get(`${API_BASE_URL}/api/datasources/peeringdb/ix/${ixId}`);
  return response.data;
};

export const searchPeeringDb = async (query: string): Promise<(PeeringDbAsn | PeeringDbFacility | PeeringDbIx)[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/datasources/peeringdb/search?q=${encodeURIComponent(query)}`);
  return response.data;
};
