package navigation

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

type QueryStat struct {
	Query string `json:"query"`
	Count int    `json:"count"`
}

type SearchHistoryEntry struct {
	ID        int       `json:"id"`
	Query     string    `json:"query"`
	CreatedAt time.Time `json:"created_at"`
}

type Bookmark struct {
	ID        int       `json:"id"`
	Query     string    `json:"query"`
	CreatedAt time.Time `json:"created_at"`
}

// NewStore creates a new navigation store with a database connection pool.
func NewStore(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}

	// Test the connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	return &Store{pool: pool}, nil
}

// Autocomplete returns matching queries based on a prefix, ordered by frequency.
func (s *Store) Autocomplete(ctx context.Context, query string) ([]QueryStat, error) {
	rows, err := s.pool.Query(ctx,
		"SELECT query, count FROM query_stats WHERE query ILIKE $1 ORDER BY count DESC LIMIT 10",
		query+"%",
	)
	if err != nil {
		return []QueryStat{}, err
	}
	defer rows.Close()

	var results []QueryStat
	for rows.Next() {
		var qs QueryStat
		if err := rows.Scan(&qs.Query, &qs.Count); err != nil {
			return []QueryStat{}, err
		}
		results = append(results, qs)
	}

	if err := rows.Err(); err != nil {
		return []QueryStat{}, err
	}

	return results, nil
}

// Popular returns the most popular queries overall.
func (s *Store) Popular(ctx context.Context) ([]QueryStat, error) {
	rows, err := s.pool.Query(ctx,
		"SELECT query, count FROM query_stats ORDER BY count DESC LIMIT 20",
	)
	if err != nil {
		return []QueryStat{}, err
	}
	defer rows.Close()

	var results []QueryStat
	for rows.Next() {
		var qs QueryStat
		if err := rows.Scan(&qs.Query, &qs.Count); err != nil {
			return []QueryStat{}, err
		}
		results = append(results, qs)
	}

	if err := rows.Err(); err != nil {
		return []QueryStat{}, err
	}

	return results, nil
}

// Trending returns the most popular queries in the last 24 hours.
func (s *Store) Trending(ctx context.Context) ([]QueryStat, error) {
	rows, err := s.pool.Query(ctx,
		"SELECT query, count FROM query_stats WHERE last_seen >= NOW() - INTERVAL '24 hours' ORDER BY count DESC LIMIT 20",
	)
	if err != nil {
		return []QueryStat{}, err
	}
	defer rows.Close()

	var results []QueryStat
	for rows.Next() {
		var qs QueryStat
		if err := rows.Scan(&qs.Query, &qs.Count); err != nil {
			return []QueryStat{}, err
		}
		results = append(results, qs)
	}

	if err := rows.Err(); err != nil {
		return []QueryStat{}, err
	}

	return results, nil
}

// GetSearchHistory returns the search history for a session, most recent first.
func (s *Store) GetSearchHistory(ctx context.Context, sessionID string) ([]SearchHistoryEntry, error) {
	rows, err := s.pool.Query(ctx,
		"SELECT id, query, created_at FROM search_history WHERE session_id=$1 ORDER BY created_at DESC LIMIT 50",
		sessionID,
	)
	if err != nil {
		return []SearchHistoryEntry{}, err
	}
	defer rows.Close()

	var results []SearchHistoryEntry
	for rows.Next() {
		var entry SearchHistoryEntry
		if err := rows.Scan(&entry.ID, &entry.Query, &entry.CreatedAt); err != nil {
			return []SearchHistoryEntry{}, err
		}
		results = append(results, entry)
	}

	if err := rows.Err(); err != nil {
		return []SearchHistoryEntry{}, err
	}

	return results, nil
}

// AddSearchHistory adds a query to the search history for a session.
func (s *Store) AddSearchHistory(ctx context.Context, sessionID, query string) error {
	_, err := s.pool.Exec(ctx,
		"INSERT INTO search_history (session_id, query, created_at) VALUES ($1, $2, NOW())",
		sessionID, query,
	)
	return err
}

// ClearSearchHistory removes all search history for a session.
func (s *Store) ClearSearchHistory(ctx context.Context, sessionID string) error {
	_, err := s.pool.Exec(ctx,
		"DELETE FROM search_history WHERE session_id=$1",
		sessionID,
	)
	return err
}

// GetBookmarks returns the bookmarks for a session, most recent first.
func (s *Store) GetBookmarks(ctx context.Context, sessionID string) ([]Bookmark, error) {
	rows, err := s.pool.Query(ctx,
		"SELECT id, query, created_at FROM bookmarks WHERE session_id=$1 ORDER BY created_at DESC",
		sessionID,
	)
	if err != nil {
		return []Bookmark{}, err
	}
	defer rows.Close()

	var results []Bookmark
	for rows.Next() {
		var bookmark Bookmark
		if err := rows.Scan(&bookmark.ID, &bookmark.Query, &bookmark.CreatedAt); err != nil {
			return []Bookmark{}, err
		}
		results = append(results, bookmark)
	}

	if err := rows.Err(); err != nil {
		return []Bookmark{}, err
	}

	return results, nil
}

// AddBookmark adds a query to the bookmarks for a session.
func (s *Store) AddBookmark(ctx context.Context, sessionID, query string) error {
	_, err := s.pool.Exec(ctx,
		"INSERT INTO bookmarks (session_id, query, created_at) VALUES ($1, $2, NOW())",
		sessionID, query,
	)
	return err
}

// DeleteBookmark removes a bookmark by ID and session ID.
func (s *Store) DeleteBookmark(ctx context.Context, sessionID string, id int) error {
	_, err := s.pool.Exec(ctx,
		"DELETE FROM bookmarks WHERE id=$1 AND session_id=$2",
		id, sessionID,
	)
	return err
}
