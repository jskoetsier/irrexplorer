package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

const (
	ttlMetadata  = 1 * time.Minute
	ttlPrefix    = 5 * time.Minute
	ttlASN       = 5 * time.Minute
	ttlSetExpand = 5 * time.Minute
	ttlMemberOf  = 5 * time.Minute
)

func cacheKey(parts ...string) string {
	return "go:" + strings.Join(parts, ":")
}

func (s *Server) tryCache(w http.ResponseWriter, r *http.Request, key string) bool {
	if s.cache == nil {
		return false
	}
	var raw json.RawMessage
	if !s.cache.Get(r.Context(), key, &raw) {
		return false
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache", "HIT")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
	_, _ = w.Write([]byte("\n"))
	return true
}

func (s *Server) setCache(key string, value any, ttl time.Duration) {
	if s.cache == nil {
		return
	}
	s.cache.Set(context.Background(), key, value, ttl)
}
