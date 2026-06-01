package httpapi

import (
	"net/http"
	"net/netip"
	"slices"
	"strconv"
	"strings"

	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/domain"
	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/httputil"
	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/irrd"
)

func (s *Server) handleASN(w http.ResponseWriter, r *http.Request) {
	rawASN := strings.TrimPrefix(r.URL.Path, "/api/prefixes/asn/")
	rawASN = strings.TrimPrefix(strings.ToUpper(rawASN), "AS")
	asn, err := strconv.ParseInt(rawASN, 10, 64)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	key := cacheKey("asn", strconv.FormatInt(asn, 10))
	if s.tryCache(w, r, key) {
		return
	}

	limit := 1000
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 10000 {
			limit = parsed
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	irrdRoutes, err := s.irrdClient.QueryASN(r.Context(), asn)
	if err != nil {
		s.logger.Warn("irrd asn query failed", "asn", asn, "error", err)
		irrdRoutes = []irrd.RouteInfo{}
	}
	bgpRoutes, totalCount, err := s.store.QueryBGPByASN(r.Context(), asn, limit, offset)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if totalCount > limit {
		s.logger.Info("asn query results truncated", "asn", asn, "total", totalCount, "returned", len(bgpRoutes), "limit", limit)
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
		httputil.WriteJSON(w, http.StatusOK, domain.ASNPrefixes{
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
		if slices.Contains(summary.BGPOrigins, asn) || slices.Contains(summary.RPKIOrigins(), asn) || slices.Contains(summary.IRROrigins(), asn) {
			result.DirectOrigin = append(result.DirectOrigin, summary)
		} else {
			result.Overlaps = append(result.Overlaps, summary)
		}
	}
	s.setCache(key, result, ttlASN)
	httputil.WriteJSON(w, http.StatusOK, result)
}
