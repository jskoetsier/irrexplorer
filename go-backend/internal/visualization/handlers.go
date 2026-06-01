package visualization

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/httputil"
)

type vizStore interface {
	PrefixAllocation(ctx context.Context) ([]RIRCount, error)
	RIRDistribution(ctx context.Context) ([]RIRCount, error)
	PrefixDistribution(ctx context.Context) ([]PrefixLengthCount, error)
	ASNRelationships(ctx context.Context, asn int64) ([]ASNEdge, error)
}

type cacheAccessor interface {
	Get(ctx context.Context, key string, dest any) bool
	Set(ctx context.Context, key string, value any, ttl time.Duration)
}

type Handlers struct {
	store vizStore
	cache cacheAccessor
}

func NewHandlers(store vizStore, cache cacheAccessor) *Handlers {
	return &Handlers{store: store, cache: cache}
}

func (h *Handlers) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/viz/prefix-allocation", h.prefixAllocation)
	mux.HandleFunc("/api/viz/rir-distribution", h.rirDistribution)
	mux.HandleFunc("/api/viz/prefix-distribution", h.prefixDistribution)
	mux.HandleFunc("/api/viz/asn-relationships/", h.asnRelationships)
}

func (h *Handlers) prefixAllocation(w http.ResponseWriter, r *http.Request) {
	h.cached(w, r, "go:viz:prefix-allocation", 60*time.Minute, func(ctx context.Context) (any, error) {
		return h.store.PrefixAllocation(ctx)
	})
}

func (h *Handlers) rirDistribution(w http.ResponseWriter, r *http.Request) {
	h.cached(w, r, "go:viz:rir-distribution", 60*time.Minute, func(ctx context.Context) (any, error) {
		return h.store.RIRDistribution(ctx)
	})
}

func (h *Handlers) prefixDistribution(w http.ResponseWriter, r *http.Request) {
	h.cached(w, r, "go:viz:prefix-distribution", 60*time.Minute, func(ctx context.Context) (any, error) {
		return h.store.PrefixDistribution(ctx)
	})
}

func (h *Handlers) asnRelationships(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimPrefix(r.URL.Path, "/api/viz/asn-relationships/")
	raw = strings.TrimPrefix(strings.ToUpper(raw), "AS")
	asn, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid ASN"})
		return
	}
	key := "go:viz:asn-relationships:" + strconv.FormatInt(asn, 10)
	h.cached(w, r, key, 30*time.Minute, func(ctx context.Context) (any, error) {
		return h.store.ASNRelationships(ctx, asn)
	})
}

// cached serves a response from Redis if available, otherwise calls fn and caches the result.
// On cache hit the raw JSON bytes are written directly to avoid double-encoding.
func (h *Handlers) cached(w http.ResponseWriter, r *http.Request, key string, ttl time.Duration, fn func(context.Context) (any, error)) {
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
