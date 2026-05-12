package importer

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const bgpToolsURL = "https://bgp.tools/table.jsonl"

// BGPEntry is one line from bgp.tools/table.jsonl.
// bgp.tools uses uppercase keys: {"CIDR":"...","ASN":...,"Hits":...}
// ASN is int64 because 4-byte ASNs (e.g. 4200001401) exceed the 32-bit signed
// range and pgx COPY rejects them when the destination column is int4. The
// matching DB column is bigint.
type BGPEntry struct {
	Prefix string `json:"CIDR"`
	ASN    int64  `json:"ASN"`
}

// ParseBGPLine parses a single JSONL line. Exported for testing.
func ParseBGPLine(data []byte) (BGPEntry, error) {
	var e BGPEntry
	if err := json.Unmarshal(data, &e); err != nil {
		return BGPEntry{}, err
	}
	if e.Prefix == "" {
		return BGPEntry{}, fmt.Errorf("empty prefix in line")
	}
	return e, nil
}

// ImportBGP downloads bgp.tools/table.jsonl, streams into bgp_staging via COPY,
// builds the GIST index on staging, then atomically swaps bgp_staging → bgp.
func ImportBGP(ctx context.Context, pool *pgxpool.Pool, httpClient *http.Client, logger *slog.Logger) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, bgpToolsURL, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("User-Agent", "irrexplorer/2.3 (https://irrexplorer.rxtx.nl)")
	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("download bgp.tools: %w", err)
	}
	defer resp.Body.Close()

	// Truncate staging table before loading.
	if _, err := pool.Exec(ctx, "TRUNCATE bgp_staging"); err != nil {
		return fmt.Errorf("truncate bgp_staging: %w", err)
	}

	// Stream JSONL into bgp_staging via COPY protocol.
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire conn: %w", err)
	}
	defer conn.Release()

	rows := make([][]any, 0, 1000)
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	count := 0

	flushRows := func() error {
		if len(rows) == 0 {
			return nil
		}
		_, err := conn.Conn().CopyFrom(ctx,
			pgx.Identifier{"bgp_staging"},
			[]string{"prefix", "asn"},
			pgx.CopyFromRows(rows),
		)
		rows = rows[:0]
		return err
	}

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		entry, err := ParseBGPLine(line)
		if err != nil {
			continue // skip malformed lines
		}
		rows = append(rows, []any{entry.Prefix, entry.ASN})
		count++
		if len(rows) >= 10000 {
			if err := flushRows(); err != nil {
				return fmt.Errorf("copy rows: %w", err)
			}
		}
	}
	if err := flushRows(); err != nil {
		return fmt.Errorf("copy final rows: %w", err)
	}
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("scan error: %w", err)
	}

	// Build GIST index on staging before the swap (this is the slow part).
	// Drop first in case it was carried over from a previous cycle or LIKE INCLUDING ALL.
	if _, err := pool.Exec(ctx, `DROP INDEX IF EXISTS ix_bgp_staging_prefix`); err != nil {
		return fmt.Errorf("drop old staging index: %w", err)
	}
	if _, err := pool.Exec(ctx, `CREATE INDEX ix_bgp_staging_prefix ON bgp_staging USING GIST (prefix inet_ops)`); err != nil {
		return fmt.Errorf("build staging index: %w", err)
	}

	// Atomic swap: bgp_staging → bgp (metadata-only lock, microseconds).
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin swap tx: %w", err)
	}
	if _, err := tx.Exec(ctx, "ALTER TABLE bgp RENAME TO bgp_old"); err != nil {
		_ = tx.Rollback(ctx)
		return fmt.Errorf("rename bgp to bgp_old: %w", err)
	}
	if _, err := tx.Exec(ctx, "ALTER TABLE bgp_staging RENAME TO bgp"); err != nil {
		_ = tx.Rollback(ctx)
		return fmt.Errorf("rename bgp_staging to bgp: %w", err)
	}
	if _, err := tx.Exec(ctx, "CREATE TABLE bgp_staging (LIKE bgp INCLUDING DEFAULTS INCLUDING CONSTRAINTS)"); err != nil {
		_ = tx.Rollback(ctx)
		return fmt.Errorf("create fresh bgp_staging: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit swap: %w", err)
	}

	// Drop old table outside transaction (non-blocking).
	if _, err := pool.Exec(ctx, "DROP TABLE bgp_old"); err != nil {
		return fmt.Errorf("drop bgp_old: %w", err)
	}

	logger.Info("bgp import complete", "rows", count)
	return nil
}
