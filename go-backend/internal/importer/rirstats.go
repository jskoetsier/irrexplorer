package importer

import (
	"bufio"
	"context"
	"fmt"
	"log/slog"
	"math/bits"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/sync/errgroup"
)

// RIR delegation file URLs (one per registry).
// Map keys must match the PostgreSQL rir enum: RIPENCC, ARIN, AFRINIC, LACNIC, APNIC, REGISTROBR.
var rirURLs = map[string]string{
	"APNIC":      "https://ftp.apnic.net/stats/apnic/delegated-apnic-latest",
	"ARIN":       "https://ftp.arin.net/pub/stats/arin/delegated-arin-extended-latest",
	"RIPENCC":    "https://ftp.ripe.net/pub/stats/ripencc/delegated-ripencc-latest",
	"LACNIC":     "https://ftp.lacnic.net/pub/stats/lacnic/delegated-lacnic-latest",
	"AFRINIC":    "https://ftp.afrinic.net/pub/stats/afrinic/delegated-afrinic-latest",
	"REGISTROBR": "https://ftp.registro.br/pub/numeracao/origin/nicbr-asn-blk-latest.txt",
}

// RIREntry is a parsed prefix from a delegation file.
type RIREntry struct {
	Prefix string
	RIR    string
}

// ParseRIRLine parses a single line from a RIR delegation file.
// Format: registry|cc|type|start|value|date|status
// Returns (entry, true) for IPv4/IPv6 lines; (_, false) otherwise.
func ParseRIRLine(line, rir string) (RIREntry, bool) {
	line = strings.TrimSpace(line)
	if line == "" || strings.HasPrefix(line, "#") {
		return RIREntry{}, false
	}
	parts := strings.Split(line, "|")
	if len(parts) < 5 {
		return RIREntry{}, false
	}
	recType := strings.ToLower(parts[2])
	start := parts[3]
	valueStr := parts[4]

	switch recType {
	case "ipv4":
		value, err := strconv.Atoi(valueStr)
		if err != nil || value <= 0 {
			return RIREntry{}, false
		}
		// Convert host count to prefix length: /prefixLen = 32 - log2(value)
		if value&(value-1) != 0 {
			return RIREntry{}, false // not a power of 2
		}
		prefixLen := 32 - bits.Len(uint(value)) + 1
		prefix := fmt.Sprintf("%s/%d", start, prefixLen)
		if net.ParseIP(start) == nil {
			return RIREntry{}, false
		}
		return RIREntry{Prefix: prefix, RIR: rir}, true

	case "ipv6":
		prefixLen, err := strconv.Atoi(valueStr)
		if err != nil {
			return RIREntry{}, false
		}
		prefix := fmt.Sprintf("%s/%d", start, prefixLen)
		if net.ParseIP(start) == nil {
			return RIREntry{}, false
		}
		return RIREntry{Prefix: prefix, RIR: rir}, true

	default:
		return RIREntry{}, false
	}
}

// ImportRIRStats downloads all RIR delegation files concurrently, parses them,
// and inserts into rirstats (replacing all rows).
func ImportRIRStats(ctx context.Context, pool *pgxpool.Pool, httpClient *http.Client, logger *slog.Logger) error {
	type sourceResult struct {
		rir     string
		entries []RIREntry
		err     error
	}

	results := make([]sourceResult, 0, len(rirURLs))
	var mu sync.Mutex

	g, gCtx := errgroup.WithContext(ctx)
	for rir, url := range rirURLs {
		rir, url := rir, url
		g.Go(func() error {
			entries, err := fetchRIR(gCtx, httpClient, url, rir)
			mu.Lock()
			results = append(results, sourceResult{rir: rir, entries: entries, err: err})
			mu.Unlock()
			return nil // never abort sibling downloads on error
		})
	}
	_ = g.Wait()

	// Collect all entries, log per-source errors.
	var allEntries []RIREntry
	for _, r := range results {
		if r.err != nil {
			// Per-source failure: log and continue with other sources.
			logger.Warn("RIR source failed", "rir", r.rir, "error", r.err)
			continue
		}
		allEntries = append(allEntries, r.entries...)
	}

	if len(allEntries) == 0 {
		return fmt.Errorf("all RIR sources failed, aborting rirstats import")
	}

	// Replace rirstats atomically.
	if _, err := pool.Exec(ctx, "TRUNCATE rirstats"); err != nil {
		return fmt.Errorf("truncate rirstats: %w", err)
	}

	conn, err := pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	rows := make([][]any, len(allEntries))
	for i, e := range allEntries {
		rows[i] = []any{e.Prefix, e.RIR}
	}
	_, err = conn.Conn().CopyFrom(ctx,
		pgx.Identifier{"rirstats"},
		[]string{"prefix", "rir"},
		pgx.CopyFromRows(rows),
	)
	return err
}

func fetchRIR(ctx context.Context, client *http.Client, url, rir string) ([]RIREntry, error) {
	req, err := newRequestWithContext(ctx, url)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var entries []RIREntry
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		if e, ok := ParseRIRLine(scanner.Text(), rir); ok {
			entries = append(entries, e)
		}
	}
	return entries, scanner.Err()
}

func newRequestWithContext(ctx context.Context, url string) (*http.Request, error) {
	return http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
}
