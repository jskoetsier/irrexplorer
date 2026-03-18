package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/middleware"
)

func TestRateLimiterAllows(t *testing.T) {
	// Create a rate limiter allowing 100 requests per minute (burst = 100)
	rl := middleware.NewRateLimiter(100)

	// Create a simple handler that returns 200
	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Create a request with RemoteAddr "192.0.2.1:12345"
	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "192.0.2.1:12345"

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
}

func TestRateLimiterBlocks(t *testing.T) {
	// Create a rate limiter allowing only 1 request per minute (burst = 1)
	rl := middleware.NewRateLimiter(1)

	// Create a simple handler that returns 200
	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// First request with same IP should succeed
	req1 := httptest.NewRequest("GET", "/", nil)
	req1.RemoteAddr = "192.0.2.1:12345"
	w1 := httptest.NewRecorder()
	handler.ServeHTTP(w1, req1)

	if w1.Code != http.StatusOK {
		t.Errorf("first request: expected status 200, got %d", w1.Code)
	}

	// Second request with same IP should be blocked (429)
	req2 := httptest.NewRequest("GET", "/", nil)
	req2.RemoteAddr = "192.0.2.1:12345"
	w2 := httptest.NewRecorder()
	handler.ServeHTTP(w2, req2)

	if w2.Code != http.StatusTooManyRequests {
		t.Errorf("second request: expected status 429, got %d", w2.Code)
	}

	// Check Retry-After header
	retryAfter := w2.Header().Get("Retry-After")
	if retryAfter != "60" {
		t.Errorf("expected Retry-After: 60, got %s", retryAfter)
	}
}
