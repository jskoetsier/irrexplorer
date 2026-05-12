package httpapi

import (
	"net/http"
	"strconv"
	"strings"

	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/httputil"
)

func (s *Server) handleRDAPIP(w http.ResponseWriter, r *http.Request) {
	ip := strings.TrimPrefix(r.URL.Path, "/api/datasources/rdap/ip/")
	if ip == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "IP address parameter required"})
		return
	}
	httputil.WriteJSON(w, http.StatusOK, s.rdapClient.QueryIP(r.Context(), ip, strings.ToLower(r.URL.Query().Get("rir"))))
}

func (s *Server) handleRDAPASN(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimPrefix(r.URL.Path, "/api/datasources/rdap/asn/")
	asn, err := strconv.ParseInt(strings.TrimPrefix(strings.ToUpper(raw), "AS"), 10, 64)
	if err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid ASN format"})
		return
	}
	httputil.WriteJSON(w, http.StatusOK, s.rdapClient.QueryASN(r.Context(), asn, strings.ToLower(r.URL.Query().Get("rir"))))
}

func (s *Server) handleRDAPDomain(w http.ResponseWriter, r *http.Request) {
	domainName := strings.TrimPrefix(r.URL.Path, "/api/datasources/rdap/domain/")
	if domainName == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Domain parameter required"})
		return
	}
	httputil.WriteJSON(w, http.StatusOK, s.rdapClient.QueryDomain(r.Context(), domainName))
}
