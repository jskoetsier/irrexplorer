import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import api from '../../services/api';
import Spinner from './spinner';
import Autocomplete from './autocomplete';
import type { QueryCategory } from '../../types';

export default function QueryForm() {
  const [search, setSearch] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    await api.cancelAllRequests();
    event.preventDefault();
    if (!search) return;

    setIsSearching(true);
    const cleanResult = await api.cleanQuery(search);
    if (cleanResult.error) {
      setValidationError(cleanResult.error);
      setIsSearching(false);
    } else {
      navigate(`/${cleanResult.category}/${cleanResult.cleanedValue}`);
    }
  };

  const handleSearchChange = (value: string) => {
    setValidationError('');
    setSearch(value);
  };

  const handleAutocompleteSelect = async (query: string, type: QueryCategory) => {
    setSearch(query);
    setIsSearching(true);
    navigate(`/${type}/${query}`);
  };

  return (
    <form className="row" onSubmit={handleSearchSubmit}>
      <div className="col-sm-10">
        <label className="visually-hidden" htmlFor="search">Search input</label>
        <div className="input-group has-validation">
          <Autocomplete
            value={search}
            placeholder="Prefix, IP, ASN or AS/route-set"
            onInputChange={handleSearchChange}
            onSelect={handleAutocompleteSelect}
          />
          <div className="invalid-feedback">
            {validationError}
          </div>
        </div>
      </div>

      <div className="col-sm-2">
        <button type="submit" className="btn btn-success btn-lg" disabled={!search || isSearching}>
          {isSearching ? <Spinner /> : 'Search'}
        </button>
      </div>
      {!isSearching && <Link to="/status/">Data source status</Link>}
    </form>
  );
}
