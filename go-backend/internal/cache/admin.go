package cache

import (
	"context"
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

// scanGoKeys scans all keys matching "go:*" using cursor-based SCAN (non-blocking).
func (h *AdminHandlers) scanGoKeys(ctx context.Context) ([]string, error) {
	client := h.cache.Client()
	var keys []string
	var cursor uint64
	for {
		batch, next, err := client.Scan(ctx, cursor, "go:*", 100).Result()
		if err != nil {
			return nil, err
		}
		keys = append(keys, batch...)
		cursor = next
		if cursor == 0 {
			break
		}
	}
	return keys, nil
}

func (h *AdminHandlers) handleStats(w http.ResponseWriter, r *http.Request) {
	if h.cache == nil {
		http.Error(w, "cache not configured", http.StatusServiceUnavailable)
		return
	}
	ctx := r.Context()
	info, err := h.cache.Client().Info(ctx, "memory", "stats").Result()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	keys, err := h.scanGoKeys(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"redis_info":   info,
		"go_key_count": len(keys),
	})
}

func (h *AdminHandlers) handleClear(w http.ResponseWriter, r *http.Request) {
	if h.cache == nil {
		http.Error(w, "cache not configured", http.StatusServiceUnavailable)
		return
	}
	ctx := r.Context()
	keys, err := h.scanGoKeys(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	deleted := 0
	if len(keys) > 0 {
		n, err := h.cache.Client().Del(ctx, keys...).Result()
		if err == nil {
			deleted = int(n)
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"deleted": deleted,
	})
}
