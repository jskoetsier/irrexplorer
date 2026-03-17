import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import './autocomplete.css';
import type { QueryCategory } from '../../types';

interface AutocompleteProps {
  value: string;
  placeholder?: string;
  onInputChange?: (value: string) => void;
  onSelect?: (query: string, type: QueryCategory) => void;
}

interface Suggestion {
  query: string;
  type: QueryCategory;
  popularity?: number;
}

export default function Autocomplete({ value, placeholder, onInputChange, onSelect }: AutocompleteProps) {
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
    <div className="autocomplete-container">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        className="form-control"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="autocomplete-suggestions">
          {suggestions.map((suggestion, idx) => (
            <div
              key={idx}
              role="button"
              tabIndex={0}
              className={`autocomplete-suggestion ${idx === selectedIndex ? 'selected' : ''}`}
              onClick={() => selectSuggestion(suggestion)}
              onKeyPress={(e) => e.key === 'Enter' && selectSuggestion(suggestion)}
            >
              <span className="suggestion-query">{suggestion.query}</span>
              <span className="suggestion-type">{suggestion.type}</span>
              {suggestion.popularity && suggestion.popularity > 1 && (
                <span className="suggestion-popularity">({suggestion.popularity})</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
