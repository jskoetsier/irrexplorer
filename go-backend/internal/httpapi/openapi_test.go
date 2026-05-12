package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOpenAPISchemaEndpoint(t *testing.T) {
	mux := http.NewServeMux()
	s := &Server{}
	mux.HandleFunc("/api/docs/openapi.json", s.handleOpenAPISchema)

	req := httptest.NewRequest(http.MethodGet, "/api/docs/openapi.json", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("expected valid JSON: %v", err)
	}
	if body["openapi"] != "3.0.0" {
		t.Fatalf("expected openapi 3.0.0, got %v", body["openapi"])
	}
}
