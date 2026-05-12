package httpapi

import (
	"net/http"
	"strconv"
	"strings"

	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/httputil"
)

func (s *Server) handleLookingGlassPrefix(w http.ResponseWriter, r *http.Request) {
	prefix := strings.TrimPrefix(r.URL.Path, "/api/datasources/lg/prefix/")
	if prefix == "" {
		http.Error(w, `{"error":"Prefix parameter required"}`, http.StatusBadRequest)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, s.lgClient.QueryPrefix(r.Context(), prefix))
}

func (s *Server) handleLookingGlassASN(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimPrefix(r.URL.Path, "/api/datasources/lg/asn/")
	asn, err := strconv.ParseInt(strings.TrimPrefix(strings.ToUpper(raw), "AS"), 10, 64)
	if err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid ASN format"})
		return
	}
	httputil.WriteJSON(w, http.StatusOK, s.lgClient.QueryASN(r.Context(), asn))
}

func (s *Server) handleLookingGlassRoute(w http.ResponseWriter, r *http.Request) {
	prefix := strings.TrimPrefix(r.URL.Path, "/api/datasources/lg/route/")
	if prefix == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Prefix parameter required"})
		return
	}
	httputil.WriteJSON(w, http.StatusOK, s.lgClient.QueryRoute(r.Context(), prefix, r.URL.Query().Get("peer")))
}

func (s *Server) handleLookingGlassPeers(w http.ResponseWriter, r *http.Request) {
	httputil.WriteJSON(w, http.StatusOK, map[string]any{"peers": s.lgClient.Peers(r.Context())})
}
