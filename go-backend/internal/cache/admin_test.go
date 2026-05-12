package cache_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/cache"
)

func TestCacheStatsHandlerNilCache(t *testing.T) {
	h := cache.NewAdminHandlers(nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/cache/stats", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rec.Code)
	}
}
