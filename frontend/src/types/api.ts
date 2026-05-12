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

export interface ApiResult<T> {
  data: T | null;
  url: string | null;
  error?: string;
  statusCode?: number;
}

export interface AutocompleteResult {
  query: string;
  type: QueryCategory;
  label: string;
}
