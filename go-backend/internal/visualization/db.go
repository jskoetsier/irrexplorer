package visualization

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Store{pool: pool}, nil
}

type RIRCount struct {
	RIR   string `json:"rir"`
	Count int    `json:"count"`
}

type PrefixLengthCount struct {
	Length int `json:"length"`
	Count  int `json:"count"`
}

type ASNEdge struct {
	Source int `json:"source"`
	Target int `json:"target"`
	Weight int `json:"weight"`
}

type TimelinePoint struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

func (s *Store) PrefixAllocation(ctx context.Context) ([]RIRCount, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT rir::text, COUNT(*) FROM rirstats GROUP BY rir ORDER BY COUNT(*) DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []RIRCount
	for rows.Next() {
		var r RIRCount
		if err := rows.Scan(&r.RIR, &r.Count); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if results == nil {
		results = []RIRCount{}
	}
	return results, nil
}

func (s *Store) RIRDistribution(ctx context.Context) ([]RIRCount, error) {
	return s.PrefixAllocation(ctx) // same query, different semantic context
}

func (s *Store) PrefixDistribution(ctx context.Context) ([]PrefixLengthCount, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT masklen(prefix), COUNT(*) FROM bgp GROUP BY masklen(prefix) ORDER BY masklen(prefix)
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []PrefixLengthCount
	for rows.Next() {
		var r PrefixLengthCount
		if err := rows.Scan(&r.Length, &r.Count); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if results == nil {
		results = []PrefixLengthCount{}
	}
	return results, nil
}

// ASNRelationships returns edges between ASNs based on prefix containment in the BGP table.
// The <<= join captures cases where the queried ASN originates the more-specific prefix;
// it does not capture the symmetric case where it originates the less-specific side.
// A fully bidirectional graph would require a UNION of both containment directions.
func (s *Store) ASNRelationships(ctx context.Context, asn int) ([]ASNEdge, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT a.asn, b.asn, COUNT(*) AS weight
		FROM bgp a
		JOIN bgp b ON a.prefix <<= b.prefix::cidr AND a.asn != b.asn
		WHERE a.asn = $1 OR b.asn = $1
		GROUP BY a.asn, b.asn
		LIMIT 200
	`, asn)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []ASNEdge
	for rows.Next() {
		var e ASNEdge
		if err := rows.Scan(&e.Source, &e.Target, &e.Weight); err != nil {
			return nil, err
		}
		results = append(results, e)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if results == nil {
		results = []ASNEdge{}
	}
	return results, nil
}

func (s *Store) Timeline(ctx context.Context) ([]TimelinePoint, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT date_trunc('day', last_seen)::date::text, COUNT(*)
		FROM query_stats
		GROUP BY date_trunc('day', last_seen)
		ORDER BY 1
		LIMIT 90
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []TimelinePoint
	for rows.Next() {
		var p TimelinePoint
		if err := rows.Scan(&p.Date, &p.Count); err != nil {
			return nil, err
		}
		results = append(results, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if results == nil {
		results = []TimelinePoint{}
	}
	return results, nil
}
