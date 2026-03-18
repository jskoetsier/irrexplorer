package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/config"
	"github.com/sebastiaan/irrexplorer/go-backend/internal/httpapi"
)

func main() {
	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	server := httpapi.NewServer(cfg, logger)

	addr := fmt.Sprintf(":%d", cfg.Port)
	httpServer := &http.Server{
		Addr:              addr,
		Handler:           server.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		logger.Info("starting go backend scaffold", "addr", addr, "debug", cfg.Debug)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server exited", "error", err)
			os.Exit(1)
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	logger.Info("shutting down go backend scaffold")
	if err := httpServer.Shutdown(ctx); err != nil {
		logger.Error("shutdown failed", "error", err)
		os.Exit(1)
	}
}
