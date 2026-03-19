package analysis

import (
	"context"
	"net/netip"

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
	return &Store{pool: pool}, nil
}

type RPKIDashboardRow struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}

type HijackEntry struct {
	Prefix string `json:"prefix"`
	ASN    int    `json:"asn"`
	Status string `json:"rpki_status"`
}

type PrefixOverlapEntry struct {
	Prefix      string `json:"prefix"`
	ContainedBy string `json:"contained_by"`
	ASN         int    `json:"asn"`
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
		if err := rows.Scan(&e.Prefix, &e.ASN, &e.Status); err != nil {
			return nil, err
		}
		results = append(results, e)
	}
	if results == nil {
		results = []HijackEntry{}
	}
	return results, nil
}

type ROACoverageRow struct {
	Prefix     string `json:"prefix"`
	ASN        int    `json:"asn"`
	RPKIStatus string `json:"rpki_status"`
	// IRRFound is not populated by the DB query (requires cross-referencing IRRd GraphQL).
	// It defaults to false; a follow-up can enrich this via the irrd client.
}

type IRRConsistencyRow struct {
	Prefix     string `json:"prefix"`
	ASN        int    `json:"asn"`
	RPKIStatus string `json:"rpki_status"`
}

// ROACoverage returns prefixes in BGP grouped by RPKI status for ROA coverage analysis.
func (s *Store) ROACoverage(ctx context.Context) ([]ROACoverageRow, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT prefix::text, asn, COALESCE(rpki_status, 'NOT_FOUND')
		FROM bgp
		WHERE rpki_status IN ('VALID', 'INVALID', 'NOT_FOUND')
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
	if results == nil {
		results = []ROACoverageRow{}
	}
	return results, nil
}

// IRRConsistency returns BGP routes where RPKI and IRR status diverge.
func (s *Store) IRRConsistency(ctx context.Context) ([]IRRConsistencyRow, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT prefix::text, asn, rpki_status
		FROM bgp
		WHERE rpki_status = 'INVALID'
		ORDER BY prefix
		LIMIT 2000
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []IRRConsistencyRow
	for rows.Next() {
		var r IRRConsistencyRow
		if err := rows.Scan(&r.Prefix, &r.ASN, &r.RPKIStatus); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	if results == nil {
		results = []IRRConsistencyRow{}
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
	if results == nil {
		results = []PrefixOverlapEntry{}
	}
	return results, nil
}
