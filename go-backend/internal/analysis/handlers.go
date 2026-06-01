package analysis

import (
	"context"
	"encoding/json"
	"net/http"
	"net/netip"
	"strings"
	"time"

	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/httputil"
)

type analysisStore interface {
	RPKIDashboard(ctx context.Context) ([]RPKIDashboardRow, error)
	HijackDetection(ctx context.Context) ([]HijackEntry, error)
	PrefixOverlap(ctx context.Context, prefix netip.Prefix) ([]PrefixOverlapEntry, error)
	ROACoverage(ctx context.Context) ([]ROACoverageRow, error)
}

type cacheAccessor interface {
	Get(ctx context.Context, key string, dest any) bool
	Set(ctx context.Context, key string, value any, ttl time.Duration)
}

const cacheTTL = 5 * time.Minute

type Handlers struct {
	store analysisStore
	cache cacheAccessor
}

func NewHandlers(store analysisStore, cache cacheAccessor) *Handlers {
	return &Handlers{store: store, cache: cache}
}

func (h *Handlers) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/analysis/rpki-dashboard", h.cachedHandler("go:analysis:rpki-dashboard", cacheTTL, h.rpkiDashboard))
	mux.HandleFunc("/api/analysis/hijack-detection", h.cachedHandler("go:analysis:hijack-detection", cacheTTL, h.hijackDetection))
	mux.HandleFunc("/api/analysis/roa-coverage", h.cachedHandler("go:analysis:roa-coverage", cacheTTL, h.roaCoverage))
	mux.HandleFunc("/api/analysis/prefix-overlap/", h.prefixOverlap)
	mux.HandleFunc("/api/filter-options", h.filterOptions)
}

// cachedHandler wraps a handler function with a fixed cache key and TTL.
// On cache hit the raw JSON bytes are written directly to avoid double-encoding.
func (h *Handlers) cachedHandler(key string, ttl time.Duration, fn func(context.Context) (any, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if h.cache != nil {
			var raw json.RawMessage
			if h.cache.Get(r.Context(), key, &raw) {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("X-Cache", "HIT")
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write(raw)
				_, _ = w.Write([]byte("\n"))
				return
			}
		}
		result, err := fn(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if h.cache != nil {
			h.cache.Set(context.Background(), key, result, ttl)
		}
		httputil.WriteJSON(w, http.StatusOK, result)
	}
}

func (h *Handlers) rpkiDashboard(ctx context.Context) (any, error) {
	return h.store.RPKIDashboard(ctx)
}

func (h *Handlers) hijackDetection(ctx context.Context) (any, error) {
	return h.store.HijackDetection(ctx)
}

func (h *Handlers) roaCoverage(ctx context.Context) (any, error) {
	return h.store.ROACoverage(ctx)
}

func (h *Handlers) prefixOverlap(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimPrefix(r.URL.Path, "/api/analysis/prefix-overlap/")
	prefix, err := netip.ParsePrefix(raw)
	if err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid prefix"})
		return
	}
	results, err := h.store.PrefixOverlap(r.Context(), prefix)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, results)
}

// filterOptions returns the valid vocabulary for frontend filter controls.
func (h *Handlers) filterOptions(w http.ResponseWriter, r *http.Request) {
	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"rpki_status": []string{"VALID", "INVALID", "UNKNOWN", "NOT_FOUND"},
		"irr_sources": []string{"RIPE", "ARIN", "APNIC", "AFRINIC", "LACNIC", "RADB", "RPKI"},
	})
}
