package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestCORSPreflightOptions: OPTIONS request → expect 204, expect Access-Control-Allow-Methods header set
func TestCORSPreflightOptions(t *testing.T) {
	handler := CORS("*")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("OPTIONS", "/", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("expected status %d, got %d", http.StatusNoContent, w.Code)
	}

	if w.Header().Get("Access-Control-Allow-Methods") == "" {
		t.Errorf("expected Access-Control-Allow-Methods header to be set")
	}

	expectedMethods := "GET, POST, DELETE, OPTIONS"
	if w.Header().Get("Access-Control-Allow-Methods") != expectedMethods {
		t.Errorf("expected Access-Control-Allow-Methods '%s', got '%s'", expectedMethods, w.Header().Get("Access-Control-Allow-Methods"))
	}
}

// TestCORSPassthrough: GET request with matching origin → expect handler called, Access-Control-Allow-Origin echoed
func TestCORSPassthrough(t *testing.T) {
	handlerCalled := false
	handler := CORS("https://example.com")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Origin", "https://example.com")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if !handlerCalled {
		t.Errorf("expected handler to be called")
	}

	if w.Header().Get("Access-Control-Allow-Origin") != "https://example.com" {
		t.Errorf("expected Access-Control-Allow-Origin 'https://example.com', got '%s'", w.Header().Get("Access-Control-Allow-Origin"))
	}
}
