package middleware

import (
	"net"
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// ipEntry tracks the rate limiter and last seen time for an IP address.
type ipEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// RateLimiter enforces per-IP rate limiting.
type RateLimiter struct {
	requestsPerMinute int
	mu                sync.Mutex
	limiters          map[string]*ipEntry
	stopCleanup       chan struct{}
}

// NewRateLimiter creates a rate limiter allowing requestsPerMinute per IP.
func NewRateLimiter(requestsPerMinute int) *RateLimiter {
	rl := &RateLimiter{
		requestsPerMinute: requestsPerMinute,
		limiters:          make(map[string]*ipEntry),
		stopCleanup:       make(chan struct{}),
	}
	go rl.cleanupRoutine()
	return rl
}

func (rl *RateLimiter) cleanupRoutine() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			rl.mu.Lock()
			now := time.Now()
			for ip, entry := range rl.limiters {
				if now.Sub(entry.lastSeen) > 5*time.Minute {
					delete(rl.limiters, ip)
				}
			}
			rl.mu.Unlock()
		case <-rl.stopCleanup:
			return
		}
	}
}

// Middleware returns http.Handler that enforces the rate limit.
// Behind a reverse proxy the real client IP is typically in X-Forwarded-For.
// Without a trusted-proxy list we can't safely trust that header, so we
// rate-limit on RemoteAddr (the ingress/proxy IP). Move rate-limiting to
// the ingress controller when per-client limiting is critical.
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := extractIP(r.RemoteAddr)

		rl.mu.Lock()
		entry, exists := rl.limiters[ip]
		if !exists {
			entry = &ipEntry{
				limiter:  rate.NewLimiter(rate.Limit(float64(rl.requestsPerMinute)/60.0), rl.requestsPerMinute),
				lastSeen: time.Now(),
			}
			rl.limiters[ip] = entry
		} else {
			entry.lastSeen = time.Now()
		}
		rl.mu.Unlock()

		if !entry.limiter.Allow() {
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// extractIP uses net.SplitHostPort to correctly handle both IPv4 and IPv6 addresses.
func extractIP(remoteAddr string) string {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		return remoteAddr
	}
	return host
}
