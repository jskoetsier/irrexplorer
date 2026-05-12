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
	rirErr := ImportRIRStats(ctx, pool, httpClient, logger)
	if rirErr != nil {
		logger.Error("RIR stats import failed", "error", rirErr)
	} else {
		logger.Info("RIR stats import complete")
	}

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

	if rirErr != nil {
		return fmt.Errorf("RIR stats import failed (BGP import succeeded): %w", rirErr)
	}
	return nil
}
