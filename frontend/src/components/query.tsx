import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';

import QueryForm from './common/queryForm';
import AdvancedSearchFilters from './advancedSearchFilters';
import ExportButtons from './exportButtons';
import logo from '../logo.png';
import api from '../services/api';
import PrefixQuery from './prefixQuery';
import ASNQuery from './asnQuery';
import SetQuery from './setQuery';
import type { QueryCategory, AdvancedSearchFilters as Filters } from '../types';

export default function Query() {
  const { query, query1, query2, category } = useParams();
  const navigate = useNavigate();
  const [cleanQuery, setCleanQuery] = useState('');
  const [queryCategory, setQueryCategory] = useState<QueryCategory>('prefix');
  const [reducedColour, setReducedColour] = useState(false);
  const [filterWarningError, setFilterWarningError] = useState(false);
  const [filters, setFilters] = useState<Filters>({ type: 'all', status: 'all', search: '' });

  const queryInput = () => query ?? (query1 && query2 ? `${query1}/${query2}` : '');

  const cleanAndNavigate = useCallback(async () => {
    const inputQuery = queryInput();
    if (!inputQuery) return;

    const cleanResult = await api.cleanQuery(inputQuery);
    if (cleanResult.error) {
      navigate('/');
    } else if (cleanResult.category !== category) {
      navigate(`/${cleanResult.category}/${cleanResult.cleanedValue}`, { replace: true });
    } else {
      setCleanQuery(cleanResult.cleanedValue);
      setQueryCategory(cleanResult.category);
      document.title = 'IRR explorer: ' + cleanResult.cleanedValue;
      api.addSearchHistory(cleanResult.cleanedValue, cleanResult.category);
    }
  }, [query, query1, query2, category, navigate]);

  useEffect(() => {
    cleanAndNavigate();
  }, [cleanAndNavigate]);

  const ContentComponent = (() => {
    switch (queryCategory) {
      case 'prefix':
        return PrefixQuery;
      case 'asn':
        return ASNQuery;
      case 'as-set':
      case 'route-set':
        return SetQuery;
      default:
        return null;
    }
  })();

  return (
    <div className="m-2 m-lg-4">
      <div className="row d-flex align-items-center mb-5">
        <div className="col-lg-1">
          <Link to="/">
            <img className="logo-small" src={logo} alt="IRR explorer" />
          </Link>
        </div>
        <div className="col-lg-5 offset-lg-1">
          <QueryForm />
        </div>
        <form className="text-end">
          <input
            type="checkbox"
            id="reducedColour"
            className="me-2"
            checked={reducedColour}
            onChange={(e) => setReducedColour(e.target.checked)}
          />
          <label htmlFor="reducedColour" className="me-4">Reduced colour mode</label>
          <input
            type="checkbox"
            id="filterWarningError"
            className="me-2"
            checked={filterWarningError}
            onChange={(e) => setFilterWarningError(e.target.checked)}
          />
          <label htmlFor="filterWarningError">Show only error/warning</label>
        </form>
      </div>
      <AdvancedSearchFilters onFilterChange={setFilters} />
      {cleanQuery && (
        <div className="mb-3">
          <ExportButtons query={cleanQuery} queryType={queryCategory} />
        </div>
      )}
      {cleanQuery && ContentComponent && (
        <ContentComponent
          query={cleanQuery}
          reducedColour={reducedColour}
          filterWarningError={filterWarningError}
          queryCategory={queryCategory}
          filters={filters}
        />
      )}
    </div>
  );
}
