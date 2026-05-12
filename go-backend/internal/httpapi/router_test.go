package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"
	"time"

	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/config"
	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/domain"
	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/irrd"
	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/middleware"
)

type fakeIRRDClient struct {
	result       map[string]string
	err          error
	asnRoutes    []irrd.RouteInfo
	prefixRoutes []irrd.RouteInfo
	memberOf     irrd.MemberOfResult
	setMembers   []irrd.SetMemberResult
}

func (f fakeIRRDClient) QueryLastUpdate(_ context.Context) (map[string]string, error) {
	return f.result, f.err
}

func (f fakeIRRDClient) QueryASN(_ context.Context, _ int64) ([]irrd.RouteInfo, error) {
	return f.asnRoutes, nil
}

func (f fakeIRRDClient) QueryPrefixesAny(_ context.Context, _ []netip.Prefix) ([]irrd.RouteInfo, error) {
	return f.prefixRoutes, nil
}

func (f fakeIRRDClient) QueryMemberOf(_ context.Context, _ string, _ string) (irrd.MemberOfResult, error) {
	return f.memberOf, nil
}

func (f fakeIRRDClient) QuerySetMembers(_ context.Context, _ []string) ([]irrd.SetMemberResult, error) {
	return f.setMembers, nil
}

type fakeStore struct {
	bgpByASN       []domain.RouteInfo
	bgpByPrefix    []domain.RouteInfo
	rirByPrefix    []domain.RouteInfo
	queryPrefixErr error
	queryASNErr    error
	importedAt     *time.Time
	rirFreshness   map[string]int64
}

func (f fakeStore) QueryPrefixesAny(_ context.Context, _ []netip.Prefix) ([]domain.RouteInfo, []domain.RouteInfo, error) {
	return f.bgpByPrefix, f.rirByPrefix, f.queryPrefixErr
}

func (f fakeStore) QueryBGPByASN(_ context.Context, _ int64, _ int, _ int) ([]domain.RouteInfo, int, error) {
	return f.bgpByASN, len(f.bgpByASN), f.queryASNErr
}

func (f fakeStore) GetLastImporterUpdate(_ context.Context) (*time.Time, error) {
	return f.importedAt, nil
}

func (f fakeStore) QueryRIRFreshness(_ context.Context) (map[string]int64, error) {
	if f.rirFreshness != nil {
		return f.rirFreshness, nil
	}
	return map[string]int64{}, nil
}

func newTestServer(cfg config.Config) *Server {
	s := &Server{
		cfg:         cfg,
		logger:      slog.New(slog.NewTextHandler(io.Discard, nil)),
		mux:         http.NewServeMux(),
		irrdClient:  fakeIRRDClient{},
		rateLimiter: middleware.NewRateLimiter(1000),
	}
	s.registerRoutes()
	return s
}

func TestMetadataHandler(t *testing.T) {
	s := newTestServer(config.Config{
		ImporterLastUpdate: "2023-01-02T00:00:00Z",
	})
	s.irrdClient = fakeIRRDClient{
		result: map[string]string{
			"DEMO": "2023-01-01 00:00:00 +0000 UTC",
		},
	}
	s.store = fakeStore{}

	req := httptest.NewRequest(http.MethodGet, "/api/metadata/", nil)
	rec := httptest.NewRecorder()

	s.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	lastUpdate, ok := body["last_update"].(map[string]any)
	if !ok {
		t.Fatalf("missing last_update object: %v", body)
	}

	if got := lastUpdate["importer"]; got != "2023-01-02 00:00:00Z" {
		t.Fatalf("unexpected importer value: %v", got)
	}
}

func TestPrefixHandler(t *testing.T) {
	s := newTestServer(config.Config{
		MinimumPrefixIPv4: 9,
		MinimumPrefixIPv6: 29,
	})
	s.store = fakeStore{
		bgpByPrefix: []domain.RouteInfo{
			{Prefix: netip.MustParsePrefix("192.0.2.0/24"), ASN: 64500},
		},
		rirByPrefix: []domain.RouteInfo{
			{Prefix: netip.MustParsePrefix("192.0.0.0/8"), RIR: stringPtr("RIPE NCC")},
			{Prefix: netip.MustParsePrefix("192.0.0.0/9"), RIR: stringPtr("Registro.BR")},
		},
	}
	s.irrdClient = fakeIRRDClient{
		prefixRoutes: []irrd.RouteInfo{
			{
				Prefix:     netip.MustParsePrefix("192.0.2.0/24"),
				ASN:        64501,
				RPSLPK:     "192.0.2.0/24AS64501",
				IRRSource:  "TESTDB",
				RPSLText:   "rpsl object text",
				RPKIStatus: "INVALID",
			},
			{
				Prefix:        netip.MustParsePrefix("192.0.2.0/24"),
				ASN:           64502,
				RPSLPK:        "192.0.2.0/24AS64502ML24",
				IRRSource:     "RPKI",
				RPSLText:      "rpsl object text",
				RPKIStatus:    "VALID",
				RPKIMaxLength: intPtr(24),
			},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/api/prefixes/prefix/192.0.2.0/24", nil)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode prefix response: %v", err)
	}
	if len(body) != 1 {
		t.Fatalf("expected one prefix summary, got %d", len(body))
	}
	if got := body[0]["rir"]; got != "Registro.BR" {
		t.Fatalf("unexpected rir: %v", got)
	}
	if got := body[0]["categoryOverall"]; got != "danger" {
		t.Fatalf("unexpected categoryOverall: %v", got)
	}
}

func TestASNHandlerNoData(t *testing.T) {
	s := newTestServer(config.Config{})
	s.store = fakeStore{}
	s.irrdClient = fakeIRRDClient{}

	req := httptest.NewRequest(http.MethodGet, "/api/prefixes/asn/64500", nil)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body map[string][]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode asn response: %v", err)
	}
	if len(body["directOrigin"]) != 0 || len(body["overlaps"]) != 0 {
		t.Fatalf("expected empty response, got %v", body)
	}
}

func TestMemberOfHandler(t *testing.T) {
	s := newTestServer(config.Config{})
	s.irrdClient = fakeIRRDClient{
		memberOf: irrd.MemberOfResult{
			Set: []irrd.MemberOfSet{
				{RPSLPK: "AS-DIRECT", Source: "TEST"},
			},
			AutNum: []irrd.MemberOfAutNum{
				{
					MntBy: []string{"TEST-MNT"},
					MemberOfObjs: []irrd.MemberOfObj{
						{RPSLPK: "AS-VALID-MNTNER", Source: "TEST", MbrsByRef: []string{"TEST-MNT"}},
						{RPSLPK: "AS-VALID-ANY", Source: "TEST", MbrsByRef: []string{"ANY"}},
						{RPSLPK: "AS-NOT-VALID-EXCLUDE", Source: "TEST", MbrsByRef: []string{"OTHER-MNT"}},
					},
				},
			},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/api/sets/member-of/as-set/64500", nil)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode member-of response: %v", err)
	}
	if got := body["irrsSeen"].([]any); len(got) != 1 || got[0] != "TEST" {
		t.Fatalf("unexpected irrsSeen: %v", body["irrsSeen"])
	}
}

func TestSetExpandHandler(t *testing.T) {
	s := newTestServer(config.Config{})
	s.irrdClient = fakeIRRDClient{
		setMembers: []irrd.SetMemberResult{
			{RPSLPK: "AS-DEMO-1", RootSource: "DEMO", Members: []string{"AS64500", "AS-DEMO-2"}},
			{RPSLPK: "AS-DEMO-2", RootSource: "DEMO", Members: []string{"AS-DEMO-3", "AS64501"}},
			{RPSLPK: "AS-DEMO-3", RootSource: "DEMO1", Members: []string{"AS-DEMO-4", "AS-DEMO-1", "AS64502"}},
			{RPSLPK: "AS-DEMO-3", RootSource: "DEMO2", Members: []string{"AS64503"}},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/api/sets/expand/AS-DEMO-1", nil)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode set expand response: %v", err)
	}
	if len(body) != 4 {
		t.Fatalf("expected 4 expansion rows, got %d", len(body))
	}
}

func stringPtr(value string) *string { return &value }
func intPtr(value int) *int          { return &value }
