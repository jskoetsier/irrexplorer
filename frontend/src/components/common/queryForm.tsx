import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

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
    event.preventDefault();
    if (!search.trim()) return;

    await api.cancelAllRequests();
    setIsSearching(true);
    const cleanResult = await api.cleanQuery(search.trim());
    if (cleanResult.error) {
      setValidationError(cleanResult.error);
      setIsSearching(false);
    } else {
      setValidationError('');
      setIsSearching(false);
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
    <form className="relative group w-full" onSubmit={handleSearchSubmit}>
      <div className="relative flex items-center w-full">
        <Autocomplete
          value={search}
          placeholder="Prefix, IP, ASN or AS/route-set"
          disabled={isSearching}
          onInputChange={handleSearchChange}
          onSelect={handleAutocompleteSelect}
        />
        
        {/* Absolute Execute Button overlay */}
        <div className="absolute right-1.5 flex items-center z-10">
          <button
            type="submit"
            disabled={!search.trim() || isSearching}
            className="bg-[#22c55e] hover:bg-[#4ae176] text-[#002109] disabled:opacity-50 disabled:hover:bg-[#22c55e] px-4 py-2 font-label-caps text-xs font-bold flex items-center gap-1.5 transition-colors uppercase select-none rounded-lg"
          >
            {isSearching ? (
              <Spinner />
            ) : (
              <>
                <span>EXECUTE</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </>
            )}
          </button>
        </div>
      </div>

      {validationError && (
        <div className="mt-2 text-xs text-red-400 font-data-mono bg-red-950/20 border border-red-900/30 p-2 rounded-lg">
          {validationError}
        </div>
      )}
    </form>
  );
}
