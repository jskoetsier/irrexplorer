import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import './advancedSearchFilters.css';
import type { AdvancedSearchFilters as Filters, FilterOptions } from '../types';

interface AdvancedSearchFiltersProps {
  onFilterChange?: (filters: Filters) => void;
}

export default function AdvancedSearchFilters({ onFilterChange }: AdvancedSearchFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [resourceType, setResourceType] = useState('all');
  const [status, setStatus] = useState('all');
  const [searchWithin, setSearchWithin] = useState('');
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);

  useEffect(() => {
    const loadFilterOptions = async () => {
      const result = await api.getFilterOptions();
      if (result.data) {
        setFilterOptions(result.data);
      }
    };
    loadFilterOptions();
  }, []);

  const emitFilterChange = useCallback((newFilters: Filters) => {
    onFilterChange?.(newFilters);
  }, [onFilterChange]);

  const handleFilterChange = (filterName: 'resourceType' | 'status' | 'searchWithin', value: string) => {
    let newFilters: Filters;
    if (filterName === 'resourceType') {
      setResourceType(value);
      newFilters = { type: value as Filters['type'], status: status as Filters['status'], search: searchWithin };
    } else if (filterName === 'status') {
      setStatus(value);
      newFilters = { type: resourceType as Filters['type'], status: value as Filters['status'], search: searchWithin };
    } else {
      setSearchWithin(value);
      newFilters = { type: resourceType as Filters['type'], status: status as Filters['status'], search: value };
    }
    emitFilterChange(newFilters);
  };

  const clearFilters = () => {
    setResourceType('all');
    setStatus('all');
    setSearchWithin('');
    emitFilterChange({ type: 'all', status: 'all', search: '' });
  };

  if (!filterOptions) {
    return null;
  }

  const hasActiveFilters = resourceType !== 'all' || status !== 'all' || searchWithin;

  return (
    <div className="advanced-search-filters">
      <div className="filter-toggle">
        <button
          className={`btn-filter-toggle ${hasActiveFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <span className="filter-icon">⚙</span>
          Advanced Filters
          {hasActiveFilters && (
            <span className="badge">
              {[resourceType !== 'all', status !== 'all', searchWithin].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="filter-panel">
          <div className="filter-row">
            <div className="filter-group">
              <label htmlFor="resourceType">Resource Type</label>
              <select
                id="resourceType"
                value={resourceType}
                onChange={(e) => handleFilterChange('resourceType', e.target.value)}
                className="filter-select"
              >
                {filterOptions.types.map((type) => (
                  <option key={type} value={type}>
                    {type === 'all' ? 'All Types' : type.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="validationStatus">Validation Status</label>
              <select
                id="validationStatus"
                value={status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="filter-select"
              >
                {filterOptions.statuses.map((s) => (
                  <option key={s} value={s}>
                    {s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group flex-grow">
              <label htmlFor="searchWithin">Search Within Results</label>
              <input
                id="searchWithin"
                type="text"
                value={searchWithin}
                onChange={(e) => handleFilterChange('searchWithin', e.target.value)}
                placeholder="Filter results..."
                className="filter-input"
              />
            </div>

            {hasActiveFilters && (
              <div className="filter-group">
                <div className="label-spacer">&nbsp;</div>
                <button className="btn-clear-filters" onClick={clearFilters}>
                  Clear All
                </button>
              </div>
            )}
          </div>

          <div className="filter-syntax-help">
            <div className="syntax-title">Query Syntax:</div>
            <div className="syntax-examples">
              <code>type:asn 64512</code>
              <code>status:valid 192.0.2.0/24</code>
              <code>type:prefix status:invalid 10.0.0.0/8</code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
