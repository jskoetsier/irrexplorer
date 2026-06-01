package analysis

import (
	"context"
	"net/netip"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

// NewStore wraps an existing connection pool. The caller owns the pool's lifecycle.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

type RPKIDashboardRow struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}

type HijackEntry struct {
	Prefix     string `json:"prefix"`
	ASN        int64  `json:"asn"`
	RPKIStatus string `json:"rpki_status"`
}

type PrefixOverlapEntry struct {
	Prefix      string `json:"prefix"`
	ContainedBy string `json:"contained_by"`
	ASN         int64  `json:"asn"`
}

func (s *Store) RPKIDashboard(ctx context.Context) ([]RPKIDashboardRow, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT rpki_status, COUNT(*) as count
		FROM bgp
		WHERE rpki_status IS NOT NULL
		GROUP BY rpki_status
		ORDER BY count DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []RPKIDashboardRow
	for rows.Next() {
		var r RPKIDashboardRow
		if err := rows.Scan(&r.Status, &r.Count); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if results == nil {
		results = []RPKIDashboardRow{}
	}
	return results, nil
}

func (s *Store) HijackDetection(ctx context.Context) ([]HijackEntry, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT prefix::text, asn, rpki_status
		FROM bgp
		WHERE rpki_status = 'INVALID'
		ORDER BY prefix
		LIMIT 1000
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []HijackEntry
	for rows.Next() {
		var e HijackEntry
		if err := rows.Scan(&e.Prefix, &e.ASN, &e.RPKIStatus); err != nil {
			return nil, err
		}
		results = append(results, e)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if results == nil {
		results = []HijackEntry{}
	}
	return results, nil
}

type ROACoverageRow struct {
	Prefix     string `json:"prefix"`
	ASN        int64  `json:"asn"`
	RPKIStatus string `json:"rpki_status"`
}

func (s *Store) ROACoverage(ctx context.Context) ([]ROACoverageRow, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT prefix::text, asn, COALESCE(rpki_status, 'NOT_FOUND')
		FROM bgp
		WHERE rpki_status IN ('VALID', 'INVALID') OR rpki_status IS NULL
		ORDER BY prefix
		LIMIT 5000
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []ROACoverageRow
	for rows.Next() {
		var r ROACoverageRow
		if err := rows.Scan(&r.Prefix, &r.ASN, &r.RPKIStatus); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if results == nil {
		results = []ROACoverageRow{}
	}
	return results, nil
}

func (s *Store) PrefixOverlap(ctx context.Context, prefix netip.Prefix) ([]PrefixOverlapEntry, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT a.prefix::text, b.prefix::text, a.asn
		FROM bgp a, bgp b
		WHERE a.prefix << b.prefix::cidr AND b.prefix = $1::cidr
		LIMIT 500
	`, prefix.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []PrefixOverlapEntry
	for rows.Next() {
		var e PrefixOverlapEntry
		if err := rows.Scan(&e.Prefix, &e.ContainedBy, &e.ASN); err != nil {
			return nil, err
		}
		results = append(results, e)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if results == nil {
		results = []PrefixOverlapEntry{}
	}
	return results, nil
}
