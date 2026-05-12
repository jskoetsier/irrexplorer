package httpapi

import (
	"net/http"
	"strconv"
	"strings"

	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/httputil"
)

func (s *Server) handlePeeringDBASN(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimPrefix(r.URL.Path, "/api/datasources/peeringdb/asn/")
	asn, err := strconv.ParseInt(strings.TrimPrefix(strings.ToUpper(raw), "AS"), 10, 64)
	if err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid ASN format"})
		return
	}
	httputil.WriteJSON(w, http.StatusOK, s.pdbClient.QueryASN(r.Context(), asn))
}

func (s *Server) handlePeeringDBFacility(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimPrefix(r.URL.Path, "/api/datasources/peeringdb/facility/")
	id, err := strconv.Atoi(raw)
	if err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid facility ID format"})
		return
	}
	httputil.WriteJSON(w, http.StatusOK, s.pdbClient.QueryFacility(r.Context(), id))
}

func (s *Server) handlePeeringDBIX(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimPrefix(r.URL.Path, "/api/datasources/peeringdb/ix/")
	id, err := strconv.Atoi(raw)
	if err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid IX ID format"})
		return
	}
	httputil.WriteJSON(w, http.StatusOK, s.pdbClient.QueryIX(r.Context(), id))
}

func (s *Server) handlePeeringDBSearch(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if len(query) < 2 {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Query parameter must be at least 2 characters"})
		return
	}
	results := s.pdbClient.SearchNetworks(r.Context(), query)
	httputil.WriteJSON(w, http.StatusOK, map[string]any{"results": results, "total": len(results)})
}
