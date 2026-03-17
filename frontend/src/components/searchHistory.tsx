import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './searchHistory.css';
import type { QueryCategory } from '../types';

interface HistoryItem {
  id: number;
  query: string;
  type: QueryCategory;
  name?: string;
  timestamp: string;
}

export default function SearchHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [bookmarks, setBookmarks] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'history' | 'bookmarks'>('history');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const [historyResult, bookmarksResult] = await Promise.all([
        api.getSearchHistory(20),
        api.getBookmarks(),
      ]);

      setHistory((historyResult.data as unknown as { history?: HistoryItem[] })?.history || []);
      setBookmarks((bookmarksResult.data as unknown as { bookmarks?: HistoryItem[] })?.bookmarks || []);
      setLoading(false);
    };

    loadData();
  }, []);

  const handleQueryClick = useCallback((query: string, type: QueryCategory) => {
    const category = type === 'asn' ? 'asn' : type === 'prefix' ? 'prefix' : 'as-set';
    navigate(`/${category}/${query}`);
  }, []);

  const handleClearHistory = async () => {
    const result = await api.clearSearchHistory();
    if (result.success) {
      setHistory([]);
    }
  };

  const handleDeleteBookmark = async (bookmarkId: number) => {
    const result = await api.deleteBookmark(bookmarkId);
    if (result.success) {
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

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

  const items = activeTab === 'history' ? history : bookmarks;

  return (
    <div className="search-history-container">
      <div className="search-history-tabs">
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Recent Searches ({history.length})
        </button>
        <button
          className={`tab ${activeTab === 'bookmarks' ? 'active' : ''}`}
          onClick={() => setActiveTab('bookmarks')}
        >
          Bookmarks ({bookmarks.length})
        </button>
      </div>

      {activeTab === 'history' && history.length > 0 && (
        <div className="search-history-header">
          <button className="btn-clear" onClick={handleClearHistory}>
            Clear History
          </button>
        </div>
      )}

      <div className="search-history-list">
        {items.length === 0 ? (
          <div className="empty-state">
            {activeTab === 'history' ? 'No search history yet' : 'No bookmarks yet'}
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="search-history-item">
              <div
                role="button"
                tabIndex={0}
                className="item-content"
                onClick={() => handleQueryClick(item.query, item.type)}
                onKeyPress={(e) => e.key === 'Enter' && handleQueryClick(item.query, item.type)}
              >
                <span className="item-query">{item.name || item.query}</span>
                <span className="item-type">{item.type}</span>
                <span className="item-time">{formatTimestamp(item.timestamp)}</span>
              </div>
              {activeTab === 'bookmarks' && (
                <button
                  className="btn-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteBookmark(item.id);
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
