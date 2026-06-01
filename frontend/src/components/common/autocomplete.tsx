import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import type { QueryCategory } from '../../types';

interface AutocompleteProps {
  value: string;
  placeholder?: string;
  onInputChange?: (value: string) => void;
  onSelect?: (query: string, type: QueryCategory) => void;
  disabled?: boolean;
}

interface Suggestion {
  query: string;
  type: QueryCategory;
  popularity?: number;
}

export default function Autocomplete({
  value,
  placeholder,
  onInputChange,
  onSelect,
  disabled,
}: AutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInputChange = useCallback(
    async (inputValue: string) => {
      onInputChange?.(inputValue);

      if (inputValue.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        const result = await api.autocomplete(inputValue, 10);
        if (result.data) {
          const data = result.data as { suggestions?: Suggestion[] };
          if (data.suggestions) {
            setSuggestions(data.suggestions);
            setShowSuggestions(true);
            setSelectedIndex(-1);
          }
        }
      }, 300);
    },
    [onInputChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(Math.min(selectedIndex + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(Math.max(selectedIndex - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (suggestion: Suggestion) => {
    onSelect?.(suggestion.query, suggestion.type);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <span className="material-symbols-outlined absolute left-4 text-on-surface-variant/70 text-lg pointer-events-none">search</span>
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          className="block w-full pl-12 pr-32 py-3 bg-[#1a1c20] border border-[#3d4a3d] rounded-lg text-sm text-[#e2e2e8] placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-all font-data-mono"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-[#1e2024] border border-[#3d4a3d] rounded-lg shadow-2xl max-h-64 overflow-y-auto z-[1000] mt-1.5 divide-y divide-[#3d4a3d]/20">
          {suggestions.map((suggestion, idx) => (
            <div
              key={idx}
              role="button"
              tabIndex={0}
              className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${
                idx === selectedIndex
                  ? 'bg-[#333539] text-primary'
                  : 'hover:bg-[#1a1c20] text-[#e2e2e8]'
              }`}
              onClick={() => selectSuggestion(suggestion)}
              onKeyPress={(e) => e.key === 'Enter' && selectSuggestion(suggestion)}
            >
              <span className="font-data-mono text-sm">{suggestion.query}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                  {suggestion.type}
                </span>
                {suggestion.popularity && suggestion.popularity > 1 && (
                  <span className="text-xs text-on-surface-variant/50">
                    ({suggestion.popularity})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
