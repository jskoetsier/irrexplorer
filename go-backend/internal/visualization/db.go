package visualization

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

// NewStore wraps an existing connection pool. The caller owns the pool's lifecycle.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
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
	Source int64 `json:"source"`
	Target int64 `json:"target"`
	Weight int   `json:"weight"`
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
	return s.PrefixAllocation(ctx)
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
func (s *Store) ASNRelationships(ctx context.Context, asn int64) ([]ASNEdge, error) {
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

