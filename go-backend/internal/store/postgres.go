package store

import (
	"context"
	"net/netip"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/domain"
)

type PostgresStore struct {
	pool *pgxpool.Pool
}

// New wraps an existing connection pool. The caller owns the pool's lifecycle.
func New(pool *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{pool: pool}
}

// QueryPrefixesAny returns BGP and RIR routes that overlap any of the given prefixes
// using a single query per table (unnest + GiST index scan).
func (s *PostgresStore) QueryPrefixesAny(ctx context.Context, prefixes []netip.Prefix) ([]domain.RouteInfo, []domain.RouteInfo, error) {
	if len(prefixes) == 0 {
		return nil, nil, nil
	}

	cidrStrings := make([]string, len(prefixes))
	for i, p := range prefixes {
		cidrStrings[i] = p.String()
	}

	bgpRows, err := s.pool.Query(ctx, `
		WITH qp AS (SELECT unnest($1::cidr[]) AS p)
		SELECT b.prefix::text, b.asn, b.rpki_status
		FROM bgp b, qp
		WHERE b.prefix <<= qp.p OR b.prefix >> qp.p
	`, cidrStrings)
	if err != nil {
		return nil, nil, err
	}
	defer bgpRows.Close()

	var allBGP []domain.RouteInfo
	for bgpRows.Next() {
		var prefixText string
		var asn int64
		var rpkiStatus *string
		if err := bgpRows.Scan(&prefixText, &asn, &rpkiStatus); err != nil {
			return nil, nil, err
		}
		parsed, err := netip.ParsePrefix(prefixText)
		if err != nil {
			continue
		}
		status := ""
		if rpkiStatus != nil {
			status = *rpkiStatus
		}
		allBGP = append(allBGP, domain.RouteInfo{Prefix: parsed.Masked(), ASN: asn, RPKIStatus: status})
	}
	if err := bgpRows.Err(); err != nil {
		return nil, nil, err
	}

	rirRows, err := s.pool.Query(ctx, `
		WITH qp AS (SELECT unnest($1::cidr[]) AS p)
		SELECT r.prefix::text, r.rir::text
		FROM rirstats r, qp
		WHERE r.prefix <<= qp.p OR r.prefix >> qp.p
	`, cidrStrings)
	if err != nil {
		return nil, nil, err
	}
	defer rirRows.Close()

	var allRIR []domain.RouteInfo
	for rirRows.Next() {
		var prefixText string
		var rirName string
		if err := rirRows.Scan(&prefixText, &rirName); err != nil {
			return nil, nil, err
		}
		parsed, err := netip.ParsePrefix(prefixText)
		if err != nil {
			continue
		}
		rir := rirName
		allRIR = append(allRIR, domain.RouteInfo{Prefix: parsed.Masked(), RIR: &rir})
	}
	if err := rirRows.Err(); err != nil {
		return nil, nil, err
	}

	return allBGP, allRIR, nil
}

func (s *PostgresStore) QueryBGPByASN(ctx context.Context, asn int64, limit, offset int) ([]domain.RouteInfo, int, error) {
	var totalCount int
	err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM bgp WHERE asn = $1`, asn).Scan(&totalCount)
	if err != nil {
		return nil, 0, err
	}

	if limit <= 0 || limit > 10000 {
		limit = 10000
	}
	if offset < 0 {
		offset = 0
	}

	rows, err := s.pool.Query(ctx, `
		SELECT prefix::text, asn, rpki_status
		FROM bgp
		WHERE asn = $1
		ORDER BY prefix
		LIMIT $2 OFFSET $3`, asn, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	results := make([]domain.RouteInfo, 0)
	for rows.Next() {
		var prefixText string
		var scannedASN int64
		var rpkiStatus *string
		if err := rows.Scan(&prefixText, &scannedASN, &rpkiStatus); err != nil {
			return nil, 0, err
		}
		parsed, err := netip.ParsePrefix(prefixText)
		if err != nil {
			continue
		}
		status := ""
		if rpkiStatus != nil {
			status = *rpkiStatus
		}
		results = append(results, domain.RouteInfo{Prefix: parsed.Masked(), ASN: scannedASN, RPKIStatus: status})
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return results, totalCount, nil
}

func (s *PostgresStore) GetLastImporterUpdate(ctx context.Context) (*time.Time, error) {
	row := s.pool.QueryRow(ctx, `SELECT last_data_import FROM last_data_import LIMIT 1`)
	var value time.Time
	if err := row.Scan(&value); err != nil {
		return nil, err
	}
	return &value, nil
}

// QueryRIRFreshness returns per-RIR prefix counts from rirstats.
// Missing RIRs indicate a failed or empty import for that source.
func (s *PostgresStore) QueryRIRFreshness(ctx context.Context) (map[string]int64, error) {
	rows, err := s.pool.Query(ctx, `SELECT rir::text, COUNT(*) FROM rirstats GROUP BY rir`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]int64)
	for rows.Next() {
		var rir string
		var count int64
		if err := rows.Scan(&rir, &count); err != nil {
			return nil, err
		}
		result[rir] = count
	}
	return result, rows.Err()
}
