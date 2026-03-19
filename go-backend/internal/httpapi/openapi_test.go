package httpapi_test

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/config"
	"github.com/sebastiaan/irrexplorer/go-backend/internal/httpapi"
)

func TestOpenAPISchemaEndpoint(t *testing.T) {
	s := httpapi.NewServer(config.Config{}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	req := httptest.NewRequest(http.MethodGet, "/api/docs/openapi.json", nil)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)

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
