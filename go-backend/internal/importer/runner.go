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

	// Update last_data_import: delete existing row then insert current timestamp.
	tx, err := pool.Begin(ctx)
	if err != nil {
		logger.Warn("failed to begin last_data_import transaction", "error", err)
	} else {
		if _, execErr := tx.Exec(ctx, "DELETE FROM last_data_import"); execErr != nil {
			logger.Warn("failed to delete last_data_import", "error", execErr)
			_ = tx.Rollback(ctx)
		} else if _, execErr := tx.Exec(ctx, "INSERT INTO last_data_import (last_data_import) VALUES (NOW())"); execErr != nil {
			logger.Warn("failed to insert last_data_import", "error", execErr)
			_ = tx.Rollback(ctx)
		} else if commitErr := tx.Commit(ctx); commitErr != nil {
			logger.Warn("failed to commit last_data_import", "error", commitErr)
		}
	}

	return nil
}
