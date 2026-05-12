package httpapi

import (
	"context"
	"net/http"
	"net/netip"
	"slices"
	"strings"

	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/domain"
	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/httputil"
	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/irrd"
)

func (s *Server) handlePrefix(w http.ResponseWriter, r *http.Request) {
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
		httputil.WriteJSON(w, http.StatusOK, []domain.PrefixSummary{})
		return
	}

	key := cacheKey("prefix", prefix.String())
	if s.tryCache(w, key) {
		return
	}

	summaries, err := s.collectForPrefixes(r.Context(), []netip.Prefix{prefix})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	domain.EnrichPrefixSummariesWithReport(summaries)
	s.setCache(key, summaries, ttlPrefix)
	httputil.WriteJSON(w, http.StatusOK, summaries)
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

		origins := make(map[int64]struct{})
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
