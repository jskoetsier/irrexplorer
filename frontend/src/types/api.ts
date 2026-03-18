export type QueryCategory = 'prefix' | 'asn' | 'as-set' | 'route-set';

export type MessageCategory = 'danger' | 'warning' | 'info' | 'success';

export type RPKIStatus = 'VALID' | 'INVALID' | 'NOT_FOUND' | 'unknown';

export interface CleanQueryResult {
  cleanedValue: string;
  category: QueryCategory;
  error?: string;
}

export interface Metadata {
  url: string;
  error?: string;
  data?: {
    last_update: {
      irr: Record<string, string>;
      importer: string | null;
    };
  };
}

export interface IRRRoute {
  asn: number;
  rpkiStatus: RPKIStatus;
  rpslText: string;
}

export interface RPKIRoute {
  asn: number;
  rpkiMaxLength: number;
}

export interface Message {
  category: MessageCategory;
  text: string;
}

export interface PrefixData {
  prefix: string;
  categoryOverall: MessageCategory;
  rir: string;
  bgpOrigins: number[];
  rpkiRoutes: RPKIRoute[];
  irrRoutes: Record<string, IRRRoute[]>;
  messages: Message[];
  prefixSortKeyIpPrefix?: string;
  prefixSortKeyReverseNetworklenIp?: string;
  goodnessOverall?: number;
}

export interface ASNPrefixesResponse {
  directOrigin: PrefixData[];
  overlaps: PrefixData[];
}

export interface SetExpansionResult {
  number_of_routes: number;
  asns: number[];
  prefixes: string[];
}

export interface SetMemberOfResult {
  as_sets: string[];
  route_sets: string[];
}

export interface SearchResult {
  query: string;
  query_type: QueryCategory;
  timestamp: string;
}

export interface Bookmark {
  id: number;
  query: string;
  query_type: QueryCategory;
  name: string;
  created_at: string;
}

export interface PopularQuery {
  query: string;
  query_type: QueryCategory;
  count: number;
}

export interface TrendingQuery {
  query: string;
  query_type: QueryCategory;
  trend_score: number;
}

export interface AdvancedSearchFilters {
  type: 'all' | 'prefix' | 'asn' | 'as-set' | 'route-set';
  status: 'all' | 'danger' | 'warning' | 'info' | 'success';
  search: string;
}

export interface FilterOptions {
  types: string[];
  statuses: string[];
}

export interface ApiResult<T> {
  data: T | null;
  url: string | null;
  error?: string;
}

export interface SuccessResult {
  success: boolean;
  error?: string;
}

export interface AutocompleteResult {
  query: string;
  type: QueryCategory;
  label: string;
}
