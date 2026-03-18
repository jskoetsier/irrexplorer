package httpapi

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/netip"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/config"
	"github.com/sebastiaan/irrexplorer/go-backend/internal/datasources"
	"github.com/sebastiaan/irrexplorer/go-backend/internal/domain"
	"github.com/sebastiaan/irrexplorer/go-backend/internal/irrd"
	"github.com/sebastiaan/irrexplorer/go-backend/internal/store"
)

type Server struct {
	cfg         config.Config
	logger      *slog.Logger
	mux         *http.ServeMux
	irrdClient  irrdClient
	importerUTC func() any
	store       prefixStore
	rdapClient  *datasources.RDAPClient
	pdbClient   *datasources.PeeringDBClient
	lgClient    *datasources.LookingGlassClient
}

type irrdClient interface {
	QueryLastUpdate(ctx context.Context) (map[string]string, error)
	QueryASN(ctx context.Context, asn int) ([]irrd.RouteInfo, error)
	QueryPrefixesAny(ctx context.Context, prefixes []netip.Prefix) ([]irrd.RouteInfo, error)
	QueryMemberOf(ctx context.Context, target string, objectClass string) (irrd.MemberOfResult, error)
	QuerySetMembers(ctx context.Context, names []string) ([]irrd.SetMemberResult, error)
}

type prefixStore interface {
	QueryPrefixesAny(ctx context.Context, prefixes []netip.Prefix) ([]domain.RouteInfo, []domain.RouteInfo, error)
	QueryBGPByASN(ctx context.Context, asn int) ([]domain.RouteInfo, error)
	GetLastImporterUpdate(ctx context.Context) (*time.Time, error)
}

func NewServer(cfg config.Config, logger *slog.Logger) *Server {
	s := &Server{
		cfg:        cfg,
		logger:     logger,
		mux:        http.NewServeMux(),
		irrdClient: irrd.New(cfg.IRRDEndpoint),
		importerUTC: func() any {
			return nil
		},
		rdapClient: datasources.NewRDAPClient(30 * time.Second),
		pdbClient:  datasources.NewPeeringDBClient(30 * time.Second),
		lgClient:   datasources.NewLookingGlassClient(cfg.LookingGlassURL, 30*time.Second),
	}

	if cfg.DatabaseURL != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		postgresStore, err := store.New(ctx, cfg.DatabaseURL)
		if err != nil {
			logger.Warn("postgres store init failed", "error", err)
		} else {
			s.store = postgresStore
			s.importerUTC = func() any {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				value, err := postgresStore.GetLastImporterUpdate(ctx)
				if err != nil || value == nil {
					if cfg.ImporterLastUpdate != "" {
						if t, parseErr := time.Parse(time.RFC3339Nano, cfg.ImporterLastUpdate); parseErr == nil {
							return irrd.FormatPythonTime(t)
						}
						return cfg.ImporterLastUpdate
					}
					return nil
				}
				return irrd.FormatPythonTime(*value)
			}
		}
	}

	s.registerRoutes()
	return s
}

func (s *Server) Handler() http.Handler {
	return s.loggingMiddleware(s.mux)
}

func (s *Server) registerRoutes() {
	s.mux.HandleFunc("/healthz", s.handleHealthz)
	s.mux.HandleFunc("/go-healthz", s.handleHealthz)
	s.mux.HandleFunc("/api/clean_query/", s.handleCleanQuery)
	s.mux.HandleFunc("/api/metadata/", s.handleMetadata)
	s.mux.HandleFunc("/api/prefixes/prefix/", s.handlePrefix)
	s.mux.HandleFunc("/api/prefixes/asn/", s.handleASN)
	s.mux.HandleFunc("/api/sets/member-of/", s.handleMemberOf)
	s.mux.HandleFunc("/api/sets/expand/", s.handleSetExpand)
	s.mux.HandleFunc("/api/datasources/lg/prefix/", s.handleLookingGlassPrefix)
	s.mux.HandleFunc("/api/datasources/lg/asn/", s.handleLookingGlassASN)
	s.mux.HandleFunc("/api/datasources/lg/route/", s.handleLookingGlassRoute)
	s.mux.HandleFunc("/api/datasources/lg/peers", s.handleLookingGlassPeers)
	s.mux.HandleFunc("/api/datasources/rdap/ip/", s.handleRDAPIP)
	s.mux.HandleFunc("/api/datasources/rdap/asn/", s.handleRDAPASN)
	s.mux.HandleFunc("/api/datasources/rdap/domain/", s.handleRDAPDomain)
	s.mux.HandleFunc("/api/datasources/peeringdb/asn/", s.handlePeeringDBASN)
	s.mux.HandleFunc("/api/datasources/peeringdb/facility/", s.handlePeeringDBFacility)
	s.mux.HandleFunc("/api/datasources/peeringdb/ix/", s.handlePeeringDBIX)
	s.mux.HandleFunc("/api/datasources/peeringdb/search", s.handlePeeringDBSearch)
}

func (s *Server) handleHealthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"service": "irrexplorer-go-backend",
	})
}

func (s *Server) handleMetadata(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Cache-Control", "public, max-age=60")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	irrUpdates, err := s.irrdClient.QueryLastUpdate(ctx)
	if err != nil {
		s.logger.Warn("irrd last-update query failed", "error", err)
		irrUpdates = map[string]string{}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"last_update": map[string]any{
			"irr":      irrUpdates,
			"importer": s.importerUTC(),
		},
	})
}

func (s *Server) handleCleanQuery(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimPrefix(r.URL.Path, "/api/clean_query/")
	if query == "" {
		http.Error(w, "missing query", http.StatusBadRequest)
		return
	}

	result, err := CleanQuery(query, s.cfg.MinimumPrefixIPv4, s.cfg.MinimumPrefixIPv6)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handlePrefix(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		http.Error(w, "database store not configured", http.StatusServiceUnavailable)
		return
	}

	rawPrefix := strings.TrimPrefix(r.URL.Path, "/api/prefixes/prefix/")
	prefix, err := netip.ParsePrefix(normalizePrefixInput(rawPrefix))
	if err != nil {
		http.Error(w, "Invalid prefix: "+err.Error(), http.StatusBadRequest)
		return
	}
	prefix = prefix.Masked()

	minimum := s.cfg.MinimumPrefixIPv4
	if prefix.Addr().Is6() {
		minimum = s.cfg.MinimumPrefixIPv6
	}
	if prefix.Bits() < minimum {
		writeJSON(w, http.StatusOK, []domain.PrefixSummary{})
		return
	}

	summaries, err := s.collectForPrefixes(r.Context(), []netip.Prefix{prefix})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	domain.EnrichPrefixSummariesWithReport(summaries)
	writeJSON(w, http.StatusOK, summaries)
}

func (s *Server) handleASN(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		http.Error(w, "database store not configured", http.StatusServiceUnavailable)
		return
	}

	rawASN := strings.TrimPrefix(r.URL.Path, "/api/prefixes/asn/")
	rawASN = strings.TrimPrefix(strings.ToUpper(rawASN), "AS")
	asn, err := strconv.Atoi(rawASN)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	irrdRoutes, err := s.irrdClient.QueryASN(r.Context(), asn)
	if err != nil {
		s.logger.Warn("irrd asn query failed", "asn", asn, "error", err)
		irrdRoutes = []irrd.RouteInfo{}
	}
	bgpRoutes, err := s.store.QueryBGPByASN(r.Context(), asn)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	prefixSet := make(map[string]netip.Prefix)
	for _, route := range irrdRoutes {
		prefixSet[route.Prefix.String()] = route.Prefix
	}
	for _, route := range bgpRoutes {
		prefixSet[route.Prefix.String()] = route.Prefix
	}

	prefixes := make([]netip.Prefix, 0, len(prefixSet))
	for _, prefix := range prefixSet {
		prefixes = append(prefixes, prefix)
	}
	if len(prefixes) == 0 {
		writeJSON(w, http.StatusOK, domain.ASNPrefixes{
			DirectOrigin: []domain.PrefixSummary{},
			Overlaps:     []domain.PrefixSummary{},
		})
		return
	}

	summaries, err := s.collectForPrefixes(r.Context(), prefixes)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	domain.EnrichPrefixSummariesWithReport(summaries)

	result := domain.ASNPrefixes{
		DirectOrigin: []domain.PrefixSummary{},
		Overlaps:     []domain.PrefixSummary{},
	}
	for _, summary := range summaries {
		if containsASN(summary.BGPOrigins, asn) || containsASN(summary.RPKIOrigins(), asn) || containsASN(summary.IRROrigins(), asn) {
			result.DirectOrigin = append(result.DirectOrigin, summary)
		} else {
			result.Overlaps = append(result.Overlaps, summary)
		}
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleMemberOf(w http.ResponseWriter, r *http.Request) {
	trimmed := strings.TrimPrefix(r.URL.Path, "/api/sets/member-of/")
	parts := strings.Split(trimmed, "/")

	objectClass := "as-set"
	target := ""
	switch len(parts) {
	case 1:
		target = parts[0]
	case 2:
		objectClass = parts[0]
		target = parts[1]
	default:
		http.NotFound(w, r)
		return
	}

	if objectClass != "as-set" && objectClass != "route-set" {
		http.Error(w, "Unknown object class: "+objectClass, http.StatusNotFound)
		return
	}
	if isNumeric(target) {
		target = "AS" + target
	}

	result, err := s.irrdClient.QueryMemberOf(r.Context(), target, objectClass)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	memberOf := domain.MemberOf{
		IRRsSeen:   []string{},
		SetsPerIRR: map[string][]string{},
	}
	irrsSeen := make(map[string]struct{})
	setsPerIRR := make(map[string]map[string]struct{})

	for _, foundSet := range result.Set {
		irrsSeen[foundSet.Source] = struct{}{}
		addSet(setsPerIRR, foundSet.Source, foundSet.RPSLPK)
	}

	if objectClass == "as-set" {
		for _, autNum := range result.AutNum {
			for _, memberOfObj := range autNum.MemberOfObjs {
				expected := make(map[string]struct{})
				for _, ref := range memberOfObj.MbrsByRef {
					expected[ref] = struct{}{}
				}
				if _, ok := expected["ANY"]; ok || intersectsStringSets(autNum.MntBy, memberOfObj.MbrsByRef) {
					irrsSeen[memberOfObj.Source] = struct{}{}
					addSet(setsPerIRR, memberOfObj.Source, memberOfObj.RPSLPK)
				}
			}
		}
	}

	for irr := range irrsSeen {
		memberOf.IRRsSeen = append(memberOf.IRRsSeen, irr)
	}
	slices.Sort(memberOf.IRRsSeen)
	for irr, values := range setsPerIRR {
		items := make([]string, 0, len(values))
		for value := range values {
			items = append(items, value)
		}
		slices.Sort(items)
		memberOf.SetsPerIRR[irr] = items
	}

	writeJSON(w, http.StatusOK, memberOf)
}

func (s *Server) handleSetExpand(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/api/sets/expand/")
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	resolved := map[string]map[string][]string{name: {}}
	toResolve := map[string]struct{}{name: {}}

	for depth := 0; depth < 20 && len(toResolve) > 0; depth++ {
		names := make([]string, 0, len(toResolve))
		for item := range toResolve {
			names = append(names, item)
		}
		results, err := s.irrdClient.QuerySetMembers(ctx, names)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		next := make(map[string]struct{})
		for _, item := range results {
			if _, ok := resolved[item.RPSLPK]; !ok {
				resolved[item.RPSLPK] = map[string][]string{}
			}
			resolved[item.RPSLPK][item.RootSource] = item.Members
			for _, member := range item.Members {
				if isSet(member) {
					if _, done := resolved[member]; !done {
						next[member] = struct{}{}
					}
				}
			}
		}
		toResolve = next
		if len(toResolve) > 1000 || len(resolved) > 1000 {
			break
		}
	}

	results := make([]domain.SetExpansion, 0)
	var traverse func(string, int, []string)
	traverse = func(stub string, depth int, path []string) {
		if containsString(path, stub) {
			return
		}
		path = append(append([]string{}, path...), stub)
		depth++
		for source, members := range resolved[stub] {
			items := append([]string{}, members...)
			slices.Sort(items)
			results = append(results, domain.SetExpansion{
				Name:    stub,
				Source:  source,
				Depth:   depth,
				Path:    path,
				Members: items,
			})
		}
		for _, members := range resolved[stub] {
			for _, member := range members {
				if _, ok := resolved[member]; ok {
					traverse(member, depth, path)
				}
			}
		}
	}

	traverse(name, 0, nil)
	slices.SortStableFunc(results, func(a, b domain.SetExpansion) int {
		if a.Depth != b.Depth {
			return a.Depth - b.Depth
		}
		if a.Name < b.Name {
			return -1
		}
		if a.Name > b.Name {
			return 1
		}
		if a.Source < b.Source {
			return -1
		}
		if a.Source > b.Source {
			return 1
		}
		return 0
	})

	writeJSON(w, http.StatusOK, results)
}

func (s *Server) collectForPrefixes(ctx context.Context, prefixes []netip.Prefix) ([]domain.PrefixSummary, error) {
	irrdRoutes, err := s.irrdClient.QueryPrefixesAny(ctx, prefixes)
	if err != nil {
		s.logger.Warn("irrd prefix query failed", "error", err)
		irrdRoutes = []irrd.RouteInfo{}
	}

	bgpRoutes, rirRoutes, err := s.store.QueryPrefixesAny(ctx, prefixes)
	if err != nil {
		return nil, err
	}

	irrdByPrefix := make(map[string][]irrd.RouteInfo)
	bgpByPrefix := make(map[string][]domain.RouteInfo)
	allPrefixes := make(map[string]netip.Prefix)

	for _, route := range irrdRoutes {
		key := route.Prefix.String()
		irrdByPrefix[key] = append(irrdByPrefix[key], route)
		allPrefixes[key] = route.Prefix
	}
	for _, route := range bgpRoutes {
		key := route.Prefix.String()
		bgpByPrefix[key] = append(bgpByPrefix[key], route)
		allPrefixes[key] = route.Prefix
	}

	keys := make([]string, 0, len(allPrefixes))
	for key := range allPrefixes {
		keys = append(keys, key)
	}
	slices.Sort(keys)

	summaries := make([]domain.PrefixSummary, 0, len(keys))
	for _, key := range keys {
		prefix := allPrefixes[key]
		summary := domain.PrefixSummary{
			Prefix:     prefix,
			RPKIRoutes: []domain.PrefixIRRDetail{},
			IRRRoutes:  map[string][]domain.PrefixIRRDetail{},
			Messages:   []domain.ReportMessage{},
		}
		summary.RIR = rirForPrefix(prefix, rirRoutes)

		origins := make(map[int]struct{})
		for _, route := range bgpByPrefix[key] {
			if route.ASN != 0 {
				origins[route.ASN] = struct{}{}
			}
		}
		for asn := range origins {
			summary.BGPOrigins = append(summary.BGPOrigins, asn)
		}
		slices.Sort(summary.BGPOrigins)

		for _, entry := range irrdByPrefix[key] {
			detail := domain.PrefixIRRDetail{
				ASN:           entry.ASN,
				RPSLText:      entry.RPSLText,
				RPSLPK:        entry.RPSLPK,
				RPKIStatus:    entry.RPKIStatus,
				RPKIMaxLength: entry.RPKIMaxLength,
			}
			if entry.IRRSource == "RPKI" {
				summary.RPKIRoutes = append(summary.RPKIRoutes, detail)
				continue
			}
			summary.IRRRoutes[entry.IRRSource] = append(summary.IRRRoutes[entry.IRRSource], detail)
		}
		summaries = append(summaries, summary)
	}

	return summaries, nil
}

func rirForPrefix(prefix netip.Prefix, rirstats []domain.RouteInfo) *string {
	var relevant *domain.RouteInfo
	for i := range rirstats {
		current := &rirstats[i]
		if !domain.Overlaps(current.Prefix, prefix) {
			continue
		}
		if relevant == nil || current.Prefix.Bits() > relevant.Prefix.Bits() {
			relevant = current
			if current.RIR != nil && *current.RIR == "Registro.BR" {
				break
			}
		}
	}
	if relevant == nil {
		return nil
	}
	return relevant.RIR
}

func containsASN(values []int, target int) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func intersectsStringSets(a, b []string) bool {
	for _, left := range a {
		for _, right := range b {
			if left == right {
				return true
			}
		}
	}
	return false
}

func addSet(sets map[string]map[string]struct{}, key, value string) {
	if _, ok := sets[key]; !ok {
		sets[key] = map[string]struct{}{}
	}
	sets[key][value] = struct{}{}
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func isSet(name string) bool {
	if !strings.HasPrefix(name, "AS") {
		return true
	}
	if len(name) <= 2 {
		return true
	}
	for _, ch := range name[2:] {
		if ch < '0' || ch > '9' {
			return true
		}
	}
	return false
}

func isNumeric(value string) bool {
	if value == "" {
		return false
	}
	for _, ch := range value {
		if ch < '0' || ch > '9' {
			return false
		}
	}
	return true
}

func (s *Server) handleLookingGlassPrefix(w http.ResponseWriter, r *http.Request) {
	prefix := strings.TrimPrefix(r.URL.Path, "/api/datasources/lg/prefix/")
	if prefix == "" {
		http.Error(w, `{"error":"Prefix parameter required"}`, http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusOK, s.lgClient.QueryPrefix(r.Context(), prefix))
}

func (s *Server) handleLookingGlassASN(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimPrefix(r.URL.Path, "/api/datasources/lg/asn/")
	asn, err := strconv.Atoi(strings.TrimPrefix(strings.ToUpper(raw), "AS"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid ASN format"})
		return
	}
	writeJSON(w, http.StatusOK, s.lgClient.QueryASN(r.Context(), asn))
}

func (s *Server) handleLookingGlassRoute(w http.ResponseWriter, r *http.Request) {
	prefix := strings.TrimPrefix(r.URL.Path, "/api/datasources/lg/route/")
	if prefix == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Prefix parameter required"})
		return
	}
	writeJSON(w, http.StatusOK, s.lgClient.QueryRoute(r.Context(), prefix, r.URL.Query().Get("peer")))
}

func (s *Server) handleLookingGlassPeers(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"peers": s.lgClient.Peers(r.Context())})
}

func (s *Server) handleRDAPIP(w http.ResponseWriter, r *http.Request) {
	ip := strings.TrimPrefix(r.URL.Path, "/api/datasources/rdap/ip/")
	if ip == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "IP address parameter required"})
		return
	}
	writeJSON(w, http.StatusOK, s.rdapClient.QueryIP(r.Context(), ip, strings.ToLower(r.URL.Query().Get("rir"))))
}

func (s *Server) handleRDAPASN(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimPrefix(r.URL.Path, "/api/datasources/rdap/asn/")
	asn, err := strconv.Atoi(strings.TrimPrefix(strings.ToUpper(raw), "AS"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid ASN format"})
		return
	}
	writeJSON(w, http.StatusOK, s.rdapClient.QueryASN(r.Context(), asn, strings.ToLower(r.URL.Query().Get("rir"))))
}

func (s *Server) handleRDAPDomain(w http.ResponseWriter, r *http.Request) {
	domainName := strings.TrimPrefix(r.URL.Path, "/api/datasources/rdap/domain/")
	if domainName == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Domain parameter required"})
		return
	}
	writeJSON(w, http.StatusOK, s.rdapClient.QueryDomain(r.Context(), domainName))
}

func (s *Server) handlePeeringDBASN(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimPrefix(r.URL.Path, "/api/datasources/peeringdb/asn/")
	asn, err := strconv.Atoi(strings.TrimPrefix(strings.ToUpper(raw), "AS"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid ASN format"})
		return
	}
	writeJSON(w, http.StatusOK, s.pdbClient.QueryASN(r.Context(), asn))
}

func (s *Server) handlePeeringDBFacility(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimPrefix(r.URL.Path, "/api/datasources/peeringdb/facility/")
	id, err := strconv.Atoi(raw)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid facility ID format"})
		return
	}
	writeJSON(w, http.StatusOK, s.pdbClient.QueryFacility(r.Context(), id))
}

func (s *Server) handlePeeringDBIX(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimPrefix(r.URL.Path, "/api/datasources/peeringdb/ix/")
	id, err := strconv.Atoi(raw)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid IX ID format"})
		return
	}
	writeJSON(w, http.StatusOK, s.pdbClient.QueryIX(r.Context(), id))
}

func (s *Server) handlePeeringDBSearch(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if len(query) < 2 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Query parameter must be at least 2 characters"})
		return
	}
	results := s.pdbClient.SearchNetworks(r.Context(), query)
	writeJSON(w, http.StatusOK, map[string]any{"results": results, "total": len(results)})
}

func (s *Server) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.logger.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"remote_addr", r.RemoteAddr,
		)
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
