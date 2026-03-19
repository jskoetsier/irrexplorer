package store

import (
	"context"
	"net/netip"
	"sync"
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
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &PostgresStore{pool: pool}, nil
}

func (s *PostgresStore) QueryPrefixesAny(ctx context.Context, prefixes []netip.Prefix) ([]domain.RouteInfo, []domain.RouteInfo, error) {
	if len(prefixes) == 0 {
		return []domain.RouteInfo{}, []domain.RouteInfo{}, nil
	}

	// Use parallel processing for large prefix lists
	const maxConcurrency = 10

	type queryResult struct {
		bgp []domain.RouteInfo
		rir []domain.RouteInfo
		err error
	}

	resultsChan := make(chan queryResult, len(prefixes))
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, maxConcurrency)

	for _, prefix := range prefixes {
		wg.Add(1)
		go func(p netip.Prefix) {
			defer wg.Done()

			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			bgpResults := make([]domain.RouteInfo, 0)
			rirResults := make([]domain.RouteInfo, 0)

			// Query BGP table
			rows, err := s.pool.Query(ctx, `
				SELECT prefix::text, asn, rpki_status FROM bgp
				WHERE prefix <<= $1::cidr OR prefix >> $1::cidr
				LIMIT 10000
			`, p.String())
			if err != nil {
				resultsChan <- queryResult{err: err}
				return
			}
			for rows.Next() {
				var prefixText string
				var asn int
				var rpkiStatus *string
				if err := rows.Scan(&prefixText, &asn, &rpkiStatus); err != nil {
					rows.Close()
					resultsChan <- queryResult{err: err}
					return
				}
				parsed, err := netip.ParsePrefix(prefixText)
				if err != nil {
					continue
				}
				status := ""
				if rpkiStatus != nil {
					status = *rpkiStatus
				}
				bgpResults = append(bgpResults, domain.RouteInfo{Prefix: parsed.Masked(), ASN: asn, RPKIStatus: status})
			}
			rows.Close()
			if err := rows.Err(); err != nil {
				resultsChan <- queryResult{err: err}
				return
			}

			// Query RIR stats table
			rirRows, err := s.pool.Query(ctx, `
				SELECT prefix::text, rir::text FROM rirstats
				WHERE prefix <<= $1::cidr OR prefix >> $1::cidr
				LIMIT 10000
			`, p.String())
			if err != nil {
				resultsChan <- queryResult{err: err}
				return
			}
			for rirRows.Next() {
				var prefixText string
				var rirName string
				if err := rirRows.Scan(&prefixText, &rirName); err != nil {
					rirRows.Close()
					resultsChan <- queryResult{err: err}
					return
				}
				parsed, err := netip.ParsePrefix(prefixText)
				if err != nil {
					continue
				}
				rirValue := rirName
				rirResults = append(rirResults, domain.RouteInfo{Prefix: parsed.Masked(), RIR: &rirValue})
			}
			rirRows.Close()
			if err := rirRows.Err(); err != nil {
				resultsChan <- queryResult{err: err}
				return
			}

			resultsChan <- queryResult{bgp: bgpResults, rir: rirResults}
		}(prefix)
	}

	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	allBGP := make([]domain.RouteInfo, 0)
	allRIR := make([]domain.RouteInfo, 0)
	for res := range resultsChan {
		if res.err != nil {
			return nil, nil, res.err
		}
		allBGP = append(allBGP, res.bgp...)
		allRIR = append(allRIR, res.rir...)
	}

	return allBGP, allRIR, nil
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
	if err := rows.Err(); err != nil {
		return nil, err
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
