package store

import (
	"context"
	"net/netip"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sebastiaan/irrexplorer/go-backend/internal/domain"
)

type PostgresStore struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, databaseURL string) (*PostgresStore, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	return &PostgresStore{pool: pool}, nil
}

func (s *PostgresStore) QueryPrefixesAny(ctx context.Context, prefixes []netip.Prefix) ([]domain.RouteInfo, []domain.RouteInfo, error) {
	bgp := make([]domain.RouteInfo, 0)
	rir := make([]domain.RouteInfo, 0)
	for _, prefix := range prefixes {
		rows, err := s.pool.Query(ctx, `
			SELECT prefix::text, asn, rpki_status FROM bgp
			WHERE prefix <<= $1::cidr OR prefix >> $1::cidr
			LIMIT 10000
		`, prefix.String())
		if err != nil {
			return nil, nil, err
		}
		for rows.Next() {
			var prefixText string
			var asn int
			var rpkiStatus *string
			if err := rows.Scan(&prefixText, &asn, &rpkiStatus); err != nil {
				rows.Close()
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
			bgp = append(bgp, domain.RouteInfo{Prefix: parsed.Masked(), ASN: asn, RPKIStatus: status})
		}
		rows.Close()

		rirRows, err := s.pool.Query(ctx, `
			SELECT prefix::text, rir::text FROM rirstats
			WHERE prefix <<= $1::cidr OR prefix >> $1::cidr
			LIMIT 10000
		`, prefix.String())
		if err != nil {
			return nil, nil, err
		}
		for rirRows.Next() {
			var prefixText string
			var rirName string
			if err := rirRows.Scan(&prefixText, &rirName); err != nil {
				rirRows.Close()
				return nil, nil, err
			}
			parsed, err := netip.ParsePrefix(prefixText)
			if err != nil {
				continue
			}
			rirValue := rirName
			rir = append(rir, domain.RouteInfo{Prefix: parsed.Masked(), RIR: &rirValue})
		}
		rirRows.Close()
	}
	return bgp, rir, nil
}

func (s *PostgresStore) QueryBGPByASN(ctx context.Context, asn int) ([]domain.RouteInfo, error) {
	rows, err := s.pool.Query(ctx, `SELECT prefix::text, asn, rpki_status FROM bgp WHERE asn = $1 LIMIT 10000`, asn)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]domain.RouteInfo, 0)
	for rows.Next() {
		var prefixText string
		var scannedASN int
		var rpkiStatus *string
		if err := rows.Scan(&prefixText, &scannedASN, &rpkiStatus); err != nil {
			return nil, err
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
	return results, nil
}

func (s *PostgresStore) GetLastImporterUpdate(ctx context.Context) (*time.Time, error) {
	row := s.pool.QueryRow(ctx, `SELECT last_data_import FROM last_data_import LIMIT 1`)
	var value time.Time
	if err := row.Scan(&value); err != nil {
		return nil, err
	}
	return &value, nil
}
