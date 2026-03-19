package cache

import (
	"encoding/json"
	"net/http"
)

type AdminHandlers struct {
	cache *Cache
}

func NewAdminHandlers(c *Cache) *AdminHandlers {
	return &AdminHandlers{cache: c}
}

func (h *AdminHandlers) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/cache/stats", h.handleStats)
	mux.HandleFunc("/api/cache/clear", h.handleClear)
}

func (h *AdminHandlers) handleStats(w http.ResponseWriter, r *http.Request) {
	if h.cache == nil {
		http.Error(w, "cache not configured", http.StatusServiceUnavailable)
		return
	}
	ctx := r.Context()
	info, err := h.cache.client.Info(ctx, "memory", "stats").Result()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	keyCount, err := h.cache.client.Keys(ctx, "go:*").Result()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"redis_info":   info,
		"go_key_count": len(keyCount),
	})
}

func (h *AdminHandlers) handleClear(w http.ResponseWriter, r *http.Request) {
	if h.cache == nil {
		http.Error(w, "cache not configured", http.StatusServiceUnavailable)
		return
	}
	ctx := r.Context()
	keys, err := h.cache.client.Keys(ctx, "go:*").Result()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	deleted := 0
	for _, key := range keys {
		if err := h.cache.client.Del(ctx, key).Err(); err == nil {
			deleted++
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"deleted": deleted,
	})
}
