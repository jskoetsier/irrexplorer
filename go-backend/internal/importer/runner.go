package importer

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Run executes the full import cycle: BGP first, then RIR stats.
// Updates last_data_import only if BGP import succeeded.
func Run(ctx context.Context, pool *pgxpool.Pool, logger *slog.Logger) error {
	httpClient := &http.Client{Timeout: 10 * time.Minute}

	logger.Info("starting BGP import")
	if err := ImportBGP(ctx, pool, httpClient, logger); err != nil {
		return fmt.Errorf("BGP import failed: %w", err)
	}
	logger.Info("BGP import complete")

	logger.Info("starting RIR stats import")
	if err := ImportRIRStats(ctx, pool, httpClient, logger); err != nil {
		// RIR failure is non-fatal: log but don't abort the timestamp update.
		logger.Warn("RIR stats import failed (non-fatal)", "error", err)
	} else {
		logger.Info("RIR stats import complete")
	}

	if _, err := pool.Exec(ctx, `
		INSERT INTO last_data_import (last_data_import) VALUES (NOW())
		ON CONFLICT (id) DO UPDATE SET last_data_import = NOW()
	`); err != nil {
		logger.Warn("failed to update last_data_import", "error", err)
	}

	return nil
}
