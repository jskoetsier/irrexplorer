import React, {Component} from 'react';
import api from '../../services/api';
import './autocomplete.css';

class Autocomplete extends Component {
    constructor(props) {
        super(props);
        this.state = {
            suggestions: [],
            showSuggestions: false,
            selectedIndex: -1,
        };
        this.debounceTimer = null;
    }

    handleInputChange = async (value) => {
        if (this.props.onInputChange) {
            this.props.onInputChange(value);
        }

        if (value.length < 2) {
            this.setState({suggestions: [], showSuggestions: false});
            return;
        }

        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(async () => {
            const result = await api.autocomplete(value, 10);
            if (result.data && result.data.suggestions) {
                this.setState({
                    suggestions: result.data.suggestions,
                    showSuggestions: true,
                    selectedIndex: -1,
                });
            }
        }, 300);
    };

    handleKeyDown = (e) => {
        const {suggestions, selectedIndex, showSuggestions} = this.state;
        
        if (!showSuggestions || suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.setState({
                selectedIndex: Math.min(selectedIndex + 1, suggestions.length - 1)
            });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.setState({
                selectedIndex: Math.max(selectedIndex - 1, -1)
            });
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            this.selectSuggestion(suggestions[selectedIndex]);
        } else if (e.key === 'Escape') {
            this.setState({showSuggestions: false});
        }
    };

    selectSuggestion = (suggestion) => {
        if (this.props.onSelect) {
            this.props.onSelect(suggestion.query, suggestion.type);
        }
        this.setState({showSuggestions: false, selectedIndex: -1});
    };

    render() {
        const {suggestions, showSuggestions, selectedIndex} = this.state;
        const {value, placeholder} = this.props;

        return (
            <div className="autocomplete-container">
                <input
                    type="text"
                    value={value}
                    placeholder={placeholder}
                    onChange={(e) => this.handleInputChange(e.target.value)}
                    onKeyDown={this.handleKeyDown}
                    onBlur={() => setTimeout(() => this.setState({showSuggestions: false}), 200)}
                    className="form-control"
                />
                {showSuggestions && suggestions.length > 0 && (
                    <div className="autocomplete-suggestions">
                        {suggestions.map((suggestion, idx) => (
                            <div
                                key={idx}
                                className={`autocomplete-suggestion ${idx === selectedIndex ? 'selected' : ''}`}
                                onClick={() => this.selectSuggestion(suggestion)}
                            >
                                <span className="suggestion-query">{suggestion.query}</span>
                                <span className="suggestion-type">{suggestion.type}</span>
                                {suggestion.popularity > 1 && (
                                    <span className="suggestion-popularity">({suggestion.popularity})</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }
}

export default Autocomplete;
