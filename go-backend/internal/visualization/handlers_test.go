package visualization_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/visualization"
)

type fakeVizStore struct{}

func (f *fakeVizStore) PrefixAllocation(_ context.Context) ([]visualization.RIRCount, error) {
	return []visualization.RIRCount{{RIR: "RIPE", Count: 1000}}, nil
}
func (f *fakeVizStore) RIRDistribution(_ context.Context) ([]visualization.RIRCount, error) {
	return []visualization.RIRCount{}, nil
}
func (f *fakeVizStore) PrefixDistribution(_ context.Context) ([]visualization.PrefixLengthCount, error) {
	return []visualization.PrefixLengthCount{}, nil
}
func (f *fakeVizStore) ASNRelationships(_ context.Context, _ int) ([]visualization.ASNEdge, error) {
	return []visualization.ASNEdge{}, nil
}
func (f *fakeVizStore) Timeline(_ context.Context) ([]visualization.TimelinePoint, error) {
	return []visualization.TimelinePoint{}, nil
}

func TestPrefixAllocationHandler(t *testing.T) {
	h := visualization.NewHandlers(&fakeVizStore{}, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/viz/prefix-allocation", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body) != 1 || body[0]["rir"] != "RIPE" {
		t.Fatalf("unexpected body: %v", body)
	}
}
