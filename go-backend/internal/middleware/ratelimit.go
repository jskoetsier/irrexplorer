package middleware

import (
	"net/http"
	"strings"
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
// burst is set equal to requestsPerMinute.
func NewRateLimiter(requestsPerMinute int) *RateLimiter {
	rl := &RateLimiter{
		requestsPerMinute: requestsPerMinute,
		limiters:          make(map[string]*ipEntry),
		stopCleanup:       make(chan struct{}),
	}

	// Start background cleanup goroutine
	go rl.cleanupRoutine()

	return rl
}

// cleanupRoutine periodically removes entries with lastSeen > 5 minutes ago.
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
// Extracts IP from r.RemoteAddr (strip port with strings.LastIndex).
// Returns 429 + Retry-After: 60 header on breach.
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract IP from RemoteAddr, stripping the port
		ip := rl.extractIP(r.RemoteAddr)

		// Get or create the rate limiter for this IP
		rl.mu.Lock()
		entry, exists := rl.limiters[ip]
		if !exists {
			// Create a new rate limiter for this IP with burst equal to requestsPerMinute
			entry = &ipEntry{
				limiter:  rate.NewLimiter(rate.Limit(float64(rl.requestsPerMinute)/60.0), rl.requestsPerMinute),
				lastSeen: time.Now(),
			}
			rl.limiters[ip] = entry
		} else {
			// Update lastSeen time
			entry.lastSeen = time.Now()
		}
		rl.mu.Unlock()

		// Check if the request is allowed
		if !entry.limiter.Allow() {
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}

		// Request is allowed, proceed to next handler
		next.ServeHTTP(w, r)
	})
}

// extractIP extracts the IP address from RemoteAddr, stripping the port.
func (rl *RateLimiter) extractIP(remoteAddr string) string {
	// Find the last colon to separate IP from port
	lastColonIdx := strings.LastIndex(remoteAddr, ":")
	if lastColonIdx == -1 {
		// No port, return as is
		return remoteAddr
	}
	return remoteAddr[:lastColonIdx]
}
