package export_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/export"
)

func TestExportPDFReturns501(t *testing.T) {
	h := export.NewHandlers(nil)
	mux := http.NewServeMux()
	h.Register(mux)

	body, _ := json.Marshal(map[string]any{"query": "AS64500"})
	req := httptest.NewRequest(http.MethodPost, "/api/export/pdf", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotImplemented {
		t.Fatalf("expected 501, got %d", rec.Code)
	}
}

func TestBulkQueryEmpty(t *testing.T) {
	h := export.NewHandlers(nil)
	mux := http.NewServeMux()
	h.Register(mux)

	body, _ := json.Marshal(map[string]any{"queries": []string{}})
	req := httptest.NewRequest(http.MethodPost, "/api/bulk-query", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}
