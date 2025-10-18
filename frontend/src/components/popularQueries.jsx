import React, {Component} from 'react';
import {navigate} from '@reach/router';
import api from '../services/api';
import './popularQueries.css';

class PopularQueries extends Component {
    constructor(props) {
        super(props);
        this.state = {
            popularQueries: [],
            trendingQueries: [],
            activeTab: 'popular',
            loading: true,
        };
    }

    componentDidMount() {
        this.loadQueries();
    }

    async loadQueries() {
        this.setState({loading: true});

        const [popularResult, trendingResult] = await Promise.all([
            api.getPopularQueries(10, 7),
            api.getTrendingQueries(10)
        ]);

        this.setState({
            popularQueries: popularResult.data?.popular_queries || [],
            trendingQueries: trendingResult.data?.trending_queries || [],
            loading: false,
        });
    }

    handleQueryClick = (query, type) => {
        const category = type === 'asn' ? 'asn' : type === 'prefix' ? 'prefix' : 'as-set';
        navigate(`/${category}/${query}`);
    };

    render() {
        const {popularQueries, trendingQueries, activeTab, loading} = this.state;
        const queries = activeTab === 'popular' ? popularQueries : trendingQueries;

        if (loading) {
            return (
                <div className="popular-queries-container">
                    <h3>Loading...</h3>
                </div>
            );
        }

        if (queries.length === 0) {
            return null;
        }

        return (
            <div className="popular-queries-container">
                <div className="popular-queries-tabs">
                    <button
                        className={`tab ${activeTab === 'popular' ? 'active' : ''}`}
                        onClick={() => this.setState({activeTab: 'popular'})}
                    >
                        Popular Queries
                    </button>
                    <button
                        className={`tab ${activeTab === 'trending' ? 'active' : ''}`}
                        onClick={() => this.setState({activeTab: 'trending'})}
                    >
                        Trending Now
                    </button>
                </div>
                <div className="popular-queries-list">
                    {queries.map((item, idx) => (
                        <div
                            key={idx}
                            role="button"
                            tabIndex={0}
                            className="popular-query-item"
                            onClick={() => this.handleQueryClick(item.query, item.type)}
                            onKeyPress={(e) => e.key === 'Enter' && this.handleQueryClick(item.query, item.type)}
                        >
                            <span className="query-text">{item.query}</span>
                            <span className="query-type">{item.type}</span>
                            {activeTab === 'popular' && item.count && (
                                <span className="query-count">{item.count} queries</span>
                            )}
                            {activeTab === 'trending' && item.recent_count && (
                                <span className="query-count">{item.recent_count} recent</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }
}

export default PopularQueries;
