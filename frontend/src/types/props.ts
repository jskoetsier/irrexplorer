import type { MessageCategory, RPKIStatus, QueryCategory } from './api';

export interface QueryFormProps {
  initialQuery?: string;
  onQuery?: (query: string) => void;
}

export interface PrefixQueryProps {
  query: string;
  reducedColour: boolean;
  filterWarningError: boolean;
}

export interface ASNQueryProps {
  query: string;
  reducedColour: boolean;
  filterWarningError: boolean;
}

export interface SetQueryProps {
  query: string;
  queryCategory: QueryCategory;
}

export interface PrefixTableProps {
  prefixesData: unknown[];
  hasLoaded: boolean;
  reducedColour: boolean;
  filterWarningError: boolean;
  apiCallUrl: string;
  defaultSortSmallestFirst?: boolean;
}

export interface PrefixTableBodyProps {
  irrSourceColumns: string[];
  prefixesData: unknown[];
  reducedColour: boolean;
  filterWarningError: boolean;
  handleIrrRouteSelect: (prefix: string, asn: number, sourceName: string, rpslText: string, rpkiStatus: RPKIStatus) => void;
}

export interface PrefixTableHeaderProps {
  irrSourceColumns: string[];
  onSort: (sort: { key: string; order: 'asc' | 'desc' }) => void;
  reducedColour: boolean;
}

export interface WhoisModalHandle {
  openWithContent: (prefix: string, asn: number, sourceName: string, rpslText: string, rpkiStatus: RPKIStatus) => void;
}

export interface MessageBadgeProps {
  category: MessageCategory;
  text: string;
  reducedColour: boolean;
}

export interface AsnWithRPKIStatusProps {
  asn: number;
  rpkiStatus: RPKIStatus;
}

export interface SetIncludedTableProps {
  query: string;
  objectClass: 'as-set' | 'route-set';
}

export interface SetExpansionTableProps {
  query: string;
  objectClass: 'as-set' | 'route-set';
}

export interface DataSourcesModalProps {
  query: string;
  type: 'prefix' | 'asn';
  onClose: () => void;
}

export interface ExportButtonsProps {
  query: string;
  queryType: QueryCategory;
}

export interface QueryProps {
  query?: string;
  query1?: string;
  query2?: string;
  category?: QueryCategory;
}

export interface SpinnerProps {
  size?: 'sm' | 'lg';
}

export interface TableFooterProps {
  url?: string;
}

export interface AutocompleteProps {
  onQuerySelect: (query: string) => void;
  placeholder?: string;
}

export interface MetadataProps {
  updateDocumentTitle?: boolean;
}

export interface HomeProps {
  path?: string;
}

export interface StatusProps {
  path?: string;
}
