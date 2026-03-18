import type {
  ApiResult,
  CleanQueryResult,
  SuccessResult,
  QueryCategory,
  AutocompleteResult,
  SearchResult,
  Bookmark,
  PopularQuery,
  TrendingQuery,
  FilterOptions,
  AdvancedSearchFilters,
  PrefixData,
  ASNPrefixesResponse,
  SetExpansionResult,
  SetMemberOfResult,
} from '../types';

import axios from 'axios';

let source = axios.CancelToken.source();

const apiUrl = import.meta.env.VITE_BACKEND || `${window.location.origin}/api`;

axios.defaults.headers.common = {
  'Accept': 'application/json',
};

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const expectedError =
      error.message === 'cancel' ||
      (error.response && error.response.status >= 400 && error.response.status < 500);
    if (!expectedError) {
      console.log('Unexpected HTTP error', error);
    }
    return Promise.reject(error);
  }
);

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
    if (axios.isAxiosError(exc) && exc.response) {
      return { error: 'Error: unable to reach API: ' + exc.response.data, data: null, url: '' };
    }
    return { error: 'Error: unable to reach API', data: null, url: '' };
  }
}

export async function cleanQuery(query: string): Promise<CleanQueryResult> {
  try {
    const response = await axios.get<CleanQueryResult>(`${apiUrl}/clean_query/${query}`);
    return response.data;
  } catch (exc: unknown) {
    if (axios.isAxiosError(exc) && exc.response) {
      return { cleanedValue: '', category: 'prefix' as QueryCategory, error: 'Error: unable to reach API: ' + exc.response.data };
    }
    return { cleanedValue: '', category: 'prefix' as QueryCategory, error: 'Error: unable to reach API' };
  }
}

async function performRequest<T>(url: string): Promise<ApiResult<T>> {
  try {
    const response = await axios.get<T>(url, { cancelToken: source.token });
    return { data: response.data, url };
  } catch {
    return { data: null, url };
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
  await source.cancel('cancel');
  source = axios.CancelToken.source();
}

export async function autocomplete(query: string, limit = 10): Promise<ApiResult<AutocompleteResult[]>> {
  try {
    const response = await axios.get<AutocompleteResult[]>(`${apiUrl}/autocomplete/${query}?limit=${limit}`);
    return { data: response.data, url: `${apiUrl}/autocomplete/${query}` };
  } catch {
    return { data: null, url: null };
  }
}

export async function addSearchHistory(query: string, queryType: QueryCategory): Promise<void> {
  try {
    await axios.post(`${apiUrl}/search-history`, { query, query_type: queryType });
  } catch (exc) {
    console.error('Failed to add search history', exc);
  }
}

export async function getSearchHistory(limit = 20): Promise<ApiResult<SearchResult[]>> {
  try {
    const response = await axios.get<SearchResult[]>(`${apiUrl}/search-history?limit=${limit}`);
    return { data: response.data, url: `${apiUrl}/search-history` };
  } catch {
    return { data: null, url: null };
  }
}

export async function clearSearchHistory(): Promise<SuccessResult> {
  try {
    await axios.delete(`${apiUrl}/search-history/clear`);
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function addBookmark(query: string, queryType: QueryCategory, name = ''): Promise<SuccessResult> {
  try {
    await axios.post(`${apiUrl}/bookmarks`, { query, query_type: queryType, name });
    return { success: true };
  } catch (exc: unknown) {
    if (axios.isAxiosError(exc)) {
      return { success: false, error: exc.response?.data?.error || 'Failed to add bookmark' };
    }
    return { success: false, error: 'Failed to add bookmark' };
  }
}

export async function getBookmarks(): Promise<ApiResult<Bookmark[]>> {
  try {
    const response = await axios.get<Bookmark[]>(`${apiUrl}/bookmarks`);
    return { data: response.data, url: `${apiUrl}/bookmarks` };
  } catch {
    return { data: null, url: null };
  }
}

export async function deleteBookmark(bookmarkId: number): Promise<SuccessResult> {
  try {
    await axios.delete(`${apiUrl}/bookmarks/${bookmarkId}`);
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function getPopularQueries(limit = 10, days = 7): Promise<ApiResult<PopularQuery[]>> {
  try {
    const response = await axios.get<PopularQuery[]>(`${apiUrl}/popular?limit=${limit}&days=${days}`);
    return { data: response.data, url: `${apiUrl}/popular` };
  } catch {
    return { data: null, url: null };
  }
}

export async function getTrendingQueries(limit = 10): Promise<ApiResult<TrendingQuery[]>> {
  try {
    const response = await axios.get<TrendingQuery[]>(`${apiUrl}/trending?limit=${limit}`);
    return { data: response.data, url: `${apiUrl}/trending` };
  } catch {
    return { data: null, url: null };
  }
}

export async function advancedSearch(query: string, filters: AdvancedSearchFilters = { type: 'all', status: 'all', search: '' }): Promise<ApiResult<unknown>> {
  try {
    const params = new URLSearchParams({ q: query });
    if (filters.type && filters.type !== 'all') params.append('type', filters.type);
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);

    const response = await axios.get(`${apiUrl}/advanced-search?${params.toString()}`);
    return { data: response.data, url: `${apiUrl}/advanced-search` };
  } catch (exc: unknown) {
    if (axios.isAxiosError(exc)) {
      return { data: null, url: null, error: exc.response?.data?.error || 'Search failed' };
    }
    return { data: null, url: null, error: 'Search failed' };
  }
}

export async function getFilterOptions(): Promise<ApiResult<FilterOptions>> {
  try {
    const response = await axios.get<FilterOptions>(`${apiUrl}/filter-options`);
    return { data: response.data, url: `${apiUrl}/filter-options` };
  } catch {
    return { data: null, url: null };
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
  addSearchHistory,
  getSearchHistory,
  clearSearchHistory,
  addBookmark,
  getBookmarks,
  deleteBookmark,
  getPopularQueries,
  getTrendingQueries,
  advancedSearch,
  getFilterOptions,
};

export default api;
