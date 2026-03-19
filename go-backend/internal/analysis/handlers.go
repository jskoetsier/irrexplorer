package analysis

import (
	"context"
	"encoding/json"
	"net/http"
	"net/netip"
	"strings"
	"time"
)

type analysisStore interface {
	RPKIDashboard(ctx context.Context) ([]RPKIDashboardRow, error)
	HijackDetection(ctx context.Context) ([]HijackEntry, error)
	PrefixOverlap(ctx context.Context, prefix netip.Prefix) ([]PrefixOverlapEntry, error)
	ROACoverage(ctx context.Context) ([]ROACoverageRow, error)
	IRRConsistency(ctx context.Context) ([]IRRConsistencyRow, error)
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
	mux.HandleFunc("/api/analysis/irr-consistency", h.cachedHandler("go:analysis:irr-consistency", cacheTTL, h.irrConsistency))
	mux.HandleFunc("/api/analysis/as-path/", h.asPath)
	mux.HandleFunc("/api/analysis/prefix-overlap/", h.prefixOverlap)
	mux.HandleFunc("/api/analysis/whois/", h.whois)
	mux.HandleFunc("/api/filter-options", h.filterOptions)
	mux.HandleFunc("/api/advanced-search", h.advancedSearch)
}

// cachedHandler wraps a handler function with a fixed cache key and TTL.
func (h *Handlers) cachedHandler(key string, ttl time.Duration, fn func(context.Context) (any, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if h.cache != nil {
			var cached json.RawMessage
			if h.cache.Get(r.Context(), key, &cached) {
				writeJSON(w, http.StatusOK, cached)
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
		writeJSON(w, http.StatusOK, result)
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

func (h *Handlers) irrConsistency(ctx context.Context) (any, error) {
	return h.store.IRRConsistency(ctx)
}

// asPath delegates to the existing IRRd GraphQL client via the server's irrd handler.
// The query param `asn` is forwarded to the existing /api/prefixes/asn/ path.
func (h *Handlers) asPath(w http.ResponseWriter, r *http.Request) {
	asn := strings.TrimPrefix(r.URL.Path, "/api/analysis/as-path/")
	http.Redirect(w, r, "/api/prefixes/asn/"+asn, http.StatusTemporaryRedirect)
}

func (h *Handlers) prefixOverlap(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimPrefix(r.URL.Path, "/api/analysis/prefix-overlap/")
	prefix, err := netip.ParsePrefix(raw)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid prefix"})
		return
	}
	results, err := h.store.PrefixOverlap(r.Context(), prefix)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, results)
}

// whois delegates to the RDAP datasource — handled by wiring in the server.
// For now return a redirect hint; the server registers the real RDAP route.
func (h *Handlers) whois(w http.ResponseWriter, r *http.Request) {
	target := strings.TrimPrefix(r.URL.Path, "/api/analysis/whois/")
	http.Redirect(w, r, "/api/datasources/rdap/ip/"+target, http.StatusTemporaryRedirect)
}

// filterOptions returns the valid vocabulary for frontend filter controls.
// The irr_sources list is a static stub; a follow-up can derive it from
// a DISTINCT query on the IRR routes table or from application config.
func (h *Handlers) filterOptions(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"rpki_status": []string{"VALID", "INVALID", "UNKNOWN", "NOT_FOUND"},
		"irr_sources": []string{"RIPE", "ARIN", "APNIC", "AFRINIC", "LACNIC", "RADB", "RPKI"},
	})
}

// advancedSearch accepts query params: q, rpki_status, irr_source.
// Delegates to clean_query then prefix/ASN handler logic.
func (h *Handlers) advancedSearch(w http.ResponseWriter, r *http.Request) {
	// Redirect to the existing prefix/ASN handler with the query — frontend already handles dispatch.
	q := r.URL.Query().Get("q")
	if q == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "q parameter required"})
		return
	}
	http.Redirect(w, r, "/api/clean_query/"+q, http.StatusTemporaryRedirect)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
