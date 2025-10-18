import React, {Component} from 'react';
import {navigate} from '@reach/router';
import api from '../services/api';
import './searchHistory.css';

class SearchHistory extends Component {
    constructor(props) {
        super(props);
        this.state = {
            history: [],
            bookmarks: [],
            activeTab: 'history',
            loading: true,
        };
    }

    componentDidMount() {
        this.loadData();
    }

    async loadData() {
        this.setState({loading: true});

        const [historyResult, bookmarksResult] = await Promise.all([
            api.getSearchHistory(20),
            api.getBookmarks()
        ]);

        this.setState({
            history: historyResult.data?.history || [],
            bookmarks: bookmarksResult.data?.bookmarks || [],
            loading: false,
        });
    }

    handleQueryClick = (query, type) => {
        const category = type === 'asn' ? 'asn' : type === 'prefix' ? 'prefix' : 'as-set';
        navigate(`/${category}/${query}`);
    };

    handleClearHistory = async () => {
        const result = await api.clearSearchHistory();
        if (result.success) {
            this.setState({history: []});
        }
    };

    handleDeleteBookmark = async (bookmarkId) => {
        const result = await api.deleteBookmark(bookmarkId);
        if (result.success) {
            this.setState({
                bookmarks: this.state.bookmarks.filter(b => b.id !== bookmarkId)
            });
        }
    };

    formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    render() {
        const {history, bookmarks, activeTab, loading} = this.state;
        const items = activeTab === 'history' ? history : bookmarks;

        if (loading) {
            return (
                <div className="search-history-container">
                    <h3>Loading...</h3>
                </div>
            );
        }

        if (history.length === 0 && bookmarks.length === 0) {
            return null;
        }

        return (
            <div className="search-history-container">
                <div className="search-history-tabs">
                    <button
                        className={`tab ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => this.setState({activeTab: 'history'})}
                    >
                        Recent Searches ({history.length})
                    </button>
                    <button
                        className={`tab ${activeTab === 'bookmarks' ? 'active' : ''}`}
                        onClick={() => this.setState({activeTab: 'bookmarks'})}
                    >
                        Bookmarks ({bookmarks.length})
                    </button>
                </div>

                {activeTab === 'history' && history.length > 0 && (
                    <div className="search-history-header">
                        <button
                            className="btn-clear"
                            onClick={this.handleClearHistory}
                        >
                            Clear History
                        </button>
                    </div>
                )}

                <div className="search-history-list">
                    {items.length === 0 ? (
                        <div className="empty-state">
                            {activeTab === 'history'
                                ? 'No search history yet'
                                : 'No bookmarks yet'
                            }
                        </div>
                    ) : (
                        items.map((item) => (
                            <div key={item.id} className="search-history-item">
                                <div
                                    role="button"
                                    tabIndex={0}
                                    className="item-content"
                                    onClick={() => this.handleQueryClick(item.query, item.type)}
                                    onKeyPress={(e) => e.key === 'Enter' && this.handleQueryClick(item.query, item.type)}
                                >
                                    <span className="item-query">{item.name || item.query}</span>
                                    <span className="item-type">{item.type}</span>
                                    <span className="item-time">{this.formatTimestamp(item.timestamp)}</span>
                                </div>
                                {activeTab === 'bookmarks' && (
                                    <button
                                        className="btn-delete"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            this.handleDeleteBookmark(item.id);
                                        }}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    }
}

export default SearchHistory;
