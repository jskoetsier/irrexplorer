package analysis_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/analysis"
)

type fakeAnalysisStore struct{}

func (f *fakeAnalysisStore) RPKIDashboard(_ context.Context) ([]analysis.RPKIDashboardRow, error) {
	return []analysis.RPKIDashboardRow{{Status: "VALID", Count: 100}}, nil
}
func (f *fakeAnalysisStore) HijackDetection(_ context.Context) ([]analysis.HijackEntry, error) {
	return []analysis.HijackEntry{}, nil
}
func (f *fakeAnalysisStore) PrefixOverlap(_ context.Context, _ netip.Prefix) ([]analysis.PrefixOverlapEntry, error) {
	return []analysis.PrefixOverlapEntry{}, nil
}
func (f *fakeAnalysisStore) ROACoverage(_ context.Context) ([]analysis.ROACoverageRow, error) {
	return []analysis.ROACoverageRow{}, nil
}
func (f *fakeAnalysisStore) IRRConsistency(_ context.Context) ([]analysis.IRRConsistencyRow, error) {
	return []analysis.IRRConsistencyRow{}, nil
}

func TestRPKIDashboardHandler(t *testing.T) {
	h := analysis.NewHandlers(&fakeAnalysisStore{}, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/analysis/rpki-dashboard", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body) != 1 || body[0]["status"] != "VALID" {
		t.Fatalf("unexpected body: %v", body)
	}
}
