import React, {Component} from 'react';
import api from '../services/api';
import './advancedSearchFilters.css';

class AdvancedSearchFilters extends Component {
    constructor(props) {
        super(props);
        this.state = {
            showFilters: false,
            resourceType: 'all',
            status: 'all',
            searchWithin: '',
            filterOptions: null,
        };
    }

    async componentDidMount() {
        const result = await api.getFilterOptions();
        if (result.data) {
            this.setState({filterOptions: result.data});
        }
    }

    toggleFilters = () => {
        this.setState({showFilters: !this.state.showFilters});
    };

    handleFilterChange = (filterName, value) => {
        this.setState({[filterName]: value}, () => {
            if (this.props.onFilterChange) {
                this.props.onFilterChange({
                    type: this.state.resourceType,
                    status: this.state.status,
                    search: this.state.searchWithin
                });
            }
        });
    };

    clearFilters = () => {
        this.setState({
            resourceType: 'all',
            status: 'all',
            searchWithin: ''
        }, () => {
            if (this.props.onFilterChange) {
                this.props.onFilterChange({
                    type: 'all',
                    status: 'all',
                    search: ''
                });
            }
        });
    };

    render() {
        const {showFilters, resourceType, status, searchWithin, filterOptions} = this.state;

        if (!filterOptions) {
            return null;
        }

        const hasActiveFilters = resourceType !== 'all' || status !== 'all' || searchWithin;

        return (
            <div className="advanced-search-filters">
                <div className="filter-toggle">
                    <button
                        className={`btn-filter-toggle ${hasActiveFilters ? 'active' : ''}`}
                        onClick={this.toggleFilters}
                    >
                        <span className="filter-icon">⚙</span>
                        Advanced Filters
                        {hasActiveFilters && <span className="badge">{
                            [resourceType !== 'all', status !== 'all', searchWithin].filter(Boolean).length
                        }</span>}
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
                                    onChange={(e) => this.handleFilterChange('resourceType', e.target.value)}
                                    className="filter-select"
                                >
                                    {filterOptions.resource_types.map(type => (
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
                                    onChange={(e) => this.handleFilterChange('status', e.target.value)}
                                    className="filter-select"
                                >
                                    {filterOptions.statuses.map(s => (
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
                                    onChange={(e) => this.handleFilterChange('searchWithin', e.target.value)}
                                    placeholder="Filter results..."
                                    className="filter-input"
                                />
                            </div>

                            {hasActiveFilters && (
                                <div className="filter-group">
                                    <div className="label-spacer">&nbsp;</div>
                                    <button
                                        className="btn-clear-filters"
                                        onClick={this.clearFilters}
                                    >
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
}

export default AdvancedSearchFilters;
