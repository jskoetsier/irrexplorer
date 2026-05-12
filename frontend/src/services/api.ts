import type {
  ApiResult,
  CleanQueryResult,
  QueryCategory,
  AutocompleteResult,
  PrefixData,
  ASNPrefixesResponse,
  SetExpansionResult,
  SetMemberOfResult,
} from '../types';

import axios from 'axios';

let abortController = new AbortController();

const apiUrl = import.meta.env.VITE_BACKEND || `${window.location.origin}/api`;

axios.defaults.headers.common = {
  'Accept': 'application/json',
};

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const expectedError =
      error.name === 'CanceledError' ||
      (error.response && error.response.status >= 400 && error.response.status < 500);
    if (!expectedError) {
      console.log('Unexpected HTTP error', error);
    }
    return Promise.reject(error);
  }
);

function extractAxiosError(exc: unknown): { error: string; statusCode?: number } {
  if (axios.isCancel(exc)) {
    return { error: 'Request cancelled' };
  }

  if (axios.isAxiosError(exc)) {
    if (!exc.response) {
      return { error: 'Network error: unable to reach API' };
    }

    const status = exc.response.status;
    const serverMessage =
      typeof exc.response.data === 'string'
        ? exc.response.data
        : exc.response.data?.error ?? exc.response.data?.detail;

    if (status >= 500) {
      return { error: serverMessage || 'Server error', statusCode: status };
    }
    return { error: serverMessage || `Request failed (${status})`, statusCode: status };
  }

  return { error: 'Unknown error' };
}

export async function getMetadata(): Promise<ApiResult<{
  last_update: {
    irr: Record<string, string>;
    importer: string | null;
  };
}>> {
  try {
    const url = `${apiUrl}/metadata/`;
    const response = await axios.get(url);
    return { data: response.data, url };
  } catch (exc: unknown) {
    return { data: null, url: `${apiUrl}/metadata/`, ...extractAxiosError(exc) };
  }
}

export async function cleanQuery(query: string): Promise<CleanQueryResult> {
  try {
    const response = await axios.get<CleanQueryResult>(`${apiUrl}/clean_query/${query}`);
    return response.data;
  } catch (exc: unknown) {
    const { error } = extractAxiosError(exc);
    return { cleanedValue: '', category: 'prefix' as QueryCategory, error };
  }
}

async function performRequest<T>(url: string): Promise<ApiResult<T>> {
  try {
    const response = await axios.get<T>(url, { signal: abortController.signal });
    return { data: response.data, url };
  } catch (exc: unknown) {
    return { data: null, url, ...extractAxiosError(exc) };
  }
}

export async function getPrefixesForPrefix(prefix: string): Promise<ApiResult<PrefixData[]>> {
  return performRequest<PrefixData[]>(`${apiUrl}/prefixes/prefix/${prefix}`);
}

export async function getPrefixesForASN(asn: string): Promise<ApiResult<ASNPrefixesResponse>> {
  return performRequest<ASNPrefixesResponse>(`${apiUrl}/prefixes/asn/${asn}`);
}

export async function getSetMemberOf(target: string, objectClass: string): Promise<ApiResult<SetMemberOfResult>> {
  return performRequest<SetMemberOfResult>(`${apiUrl}/sets/member-of/${objectClass}/${target}`);
}

export async function getSetExpansion(target: string): Promise<ApiResult<SetExpansionResult>> {
  return performRequest<SetExpansionResult>(`${apiUrl}/sets/expand/${target}`);
}

export async function cancelAllRequests(): Promise<void> {
  abortController.abort();
  abortController = new AbortController();
}

export async function autocomplete(query: string, limit = 10): Promise<ApiResult<AutocompleteResult[]>> {
  const url = `${apiUrl}/autocomplete/${query}?limit=${limit}`;
  try {
    const response = await axios.get<AutocompleteResult[]>(url);
    return { data: response.data, url };
  } catch (exc: unknown) {
    return { data: null, url, ...extractAxiosError(exc) };
  }
}

const api = {
  getMetadata,
  getPrefixesForPrefix,
  getPrefixesForASN,
  cleanQuery,
  getSetMemberOf,
  getSetExpansion,
  cancelAllRequests,
  autocomplete,
};

export default api;
