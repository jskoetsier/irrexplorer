import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './popularQueries.css';
import type { QueryCategory } from '../types';

interface QueryItem {
  query: string;
  type: QueryCategory;
  count?: number;
  recent_count?: number;
}

export default function PopularQueries() {
  const [popularQueries, setPopularQueries] = useState<QueryItem[]>([]);
  const [trendingQueries, setTrendingQueries] = useState<QueryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'popular' | 'trending'>('popular');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadQueries = async () => {
      setLoading(true);

      const [popularResult, trendingResult] = await Promise.all([
        api.getPopularQueries(10, 7),
        api.getTrendingQueries(10),
      ]);

      const popularData = popularResult.data as { popular_queries?: QueryItem[] } | null;
      const trendingData = trendingResult.data as { trending_queries?: QueryItem[] } | null;

      setPopularQueries(popularData?.popular_queries || []);
      setTrendingQueries(trendingData?.trending_queries || []);
      setLoading(false);
    };

    loadQueries();
  }, []);

  const handleQueryClick = useCallback((query: string, type: QueryCategory) => {
    const category = type === 'asn' ? 'asn' : type === 'prefix' ? 'prefix' : 'as-set';
    navigate(`/${category}/${query}`);
  }, []);

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
        <button className={`tab ${activeTab === 'popular' ? 'active' : ''}`} onClick={() => setActiveTab('popular')}>
          Popular Queries
        </button>
        <button className={`tab ${activeTab === 'trending' ? 'active' : ''}`} onClick={() => setActiveTab('trending')}>
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
            onClick={() => handleQueryClick(item.query, item.type)}
            onKeyPress={(e) => e.key === 'Enter' && handleQueryClick(item.query, item.type)}
          >
            <span className="query-text">{item.query}</span>
            <span className="query-type">{item.type}</span>
            {activeTab === 'popular' && item.count && <span className="query-count">{item.count} queries</span>}
            {activeTab === 'trending' && item.recent_count && <span className="query-count">{item.recent_count} recent</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
